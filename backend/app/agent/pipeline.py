"""Project analysis pipeline orchestration."""

from __future__ import annotations

from datetime import date
import json
import re
from typing import Any
from uuid import uuid4

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.audit import record_audit_event
from app.db import models
from app.agent.reasoning_loop import AgentNarrativeResult, run_reasoning_loop
from app.ingestion.parsers import parse_upload
from app.ingestion.schemas import NormalizedProjectPlan, ParseWarning
from app.ingestion.validators import validate_project_plan
from app.llm.client import LLMClient, build_llm_client
from app.schemas.projects import (
    AnalysisResponse,
    CriticalPathUpdate,
    LatestHealth,
    ProjectCreate,
    ProjectOverviewRow,
    ProjectOverviewTableResponse,
    ProjectRead,
    ScoreBreakdownResponse,
    ScenarioSimulationRequest,
    ScenarioSimulationResponse,
    SnapshotRead,
    UploadResponse,
)
from app.reports.weekly_pdf import build_weekly_report_pdf
from app.scoring.engine import rag_from_score, score_project_plan
from app.scoring.schemas import ScoreResult


class ProjectNotFoundError(ValueError):
    """Raised when a requested project or project artifact is not available."""


def create_project(db: Session, payload: ProjectCreate) -> models.Project:
    project_id = payload.id or f"proj_{uuid4().hex[:8]}"
    project = models.Project(
        id=project_id,
        name=payload.name,
        client_name=payload.client_name,
        pm_name=payload.pm_name,
        start_date=payload.start_date,
        planned_end_date=payload.planned_end_date,
        budget_total=payload.budget_total,
    )
    db.add(project)
    record_audit_event(
        db,
        event_type="project_created",
        entity_type="project",
        entity_id=project_id,
        message=f"Project {payload.name} created.",
        details={"project_id": project_id, "client_name": payload.client_name},
    )
    db.commit()
    db.refresh(project)
    return project


def list_projects(db: Session) -> list[ProjectRead]:
    projects = db.scalars(select(models.Project).order_by(models.Project.created_at.desc())).all()
    return [_project_to_read(project, _latest_health(db, project.id)) for project in projects]


def get_project(db: Session, project_id: str) -> models.Project:
    project = db.get(models.Project, project_id)
    if project is None:
        raise ProjectNotFoundError(f"Project {project_id} not found.")
    return project


def delete_project(db: Session, project_id: str) -> None:
    project = get_project(db, project_id)
    project_name = project.name
    db.delete(project)
    record_audit_event(
        db,
        event_type="project_deleted",
        entity_type="project",
        entity_id=project_id,
        message=f"Project {project_name} deleted.",
        details={"project_id": project_id},
    )
    db.commit()


def upload_project_plan(db: Session, project_id: str, filename: str, content: bytes) -> UploadResponse:
    project = get_project(db, project_id)
    plan = parse_upload(filename, content)
    validation = validate_project_plan(plan)
    _sync_project_metadata(project, plan)
    _replace_project_reference_data(db, project, plan)
    record_audit_event(
        db,
        event_type="project_uploaded",
        entity_type="project",
        entity_id=project.id,
        message=f"Project plan uploaded for {project.name}.",
        details={
            "filename": filename,
            "source_type": plan.source_type,
            "data_confidence": validation.data_confidence,
            "missing_fields": validation.missing_fields,
        },
    )
    db.commit()

    return UploadResponse(
        project_id=project.id,
        source_type=plan.source_type,
        data_confidence=validation.data_confidence,
        parse_warnings=_warning_messages(validation.warnings),
        missing_fields=validation.missing_fields,
        normalized_counts=_normalized_counts(plan),
    )


def analyze_project_plan(
    db: Session,
    project_id: str,
    filename: str,
    content: bytes,
    *,
    run_date: date | None = None,
    llm_client: LLMClient | None = None,
) -> AnalysisResponse:
    project = get_project(db, project_id)
    run_date = run_date or date.today()
    plan = parse_upload(filename, content)
    validation = validate_project_plan(plan)
    scoring = score_project_plan(plan, run_date=run_date)
    warning_messages = _warning_messages(validation.warnings)
    previous_snapshot = _latest_snapshot_model(db, project.id, require_project=False)

    _sync_project_metadata(project, plan)
    snapshot = models.ProjectSnapshot(
        project_id=project.id,
        run_date=run_date,
        raw_payload_json=_json_dumps(plan.model_dump()),
        data_confidence=validation.data_confidence,
        parse_warnings_json=_json_dumps([warning.model_dump() for warning in validation.warnings]),
    )
    db.add(snapshot)
    db.flush()

    db.add(_score_model(snapshot.id, scoring))
    agent_result = run_reasoning_loop(
        db,
        project_id=project.id,
        project_name=project.name,
        scoring=scoring,
        parse_warnings=warning_messages,
        llm_client=llm_client if llm_client is not None else build_llm_client(),
    )
    db.add(
        models.Narrative(
            snapshot_id=snapshot.id,
            narrative_text=agent_result.narrative,
            top_risks_json=_json_dumps(agent_result.top_risks),
            recommended_actions_json=_json_dumps(agent_result.recommended_actions),
            reasoning_trace_json=_json_dumps(agent_result.reasoning_trace),
            llm_provider_used=agent_result.llm_provider_used,
        )
    )
    _replace_project_reference_data(db, project, plan, snapshot_id=snapshot.id)
    _create_alerts(db, project, snapshot.id, scoring, previous_snapshot)
    record_audit_event(
        db,
        event_type="project_analyzed",
        entity_type="snapshot",
        entity_id=str(snapshot.id),
        message=f"{project.name} analyzed as {scoring.rag_status}.",
        details={
            "project_id": project.id,
            "filename": filename,
            "composite_score": scoring.composite_score,
            "rag_status": scoring.rag_status,
            "data_confidence": validation.data_confidence,
        },
    )
    db.commit()
    db.refresh(snapshot)

    return _analysis_response(project, snapshot, scoring, warning_messages, agent_result)


def list_snapshots(db: Session, project_id: str) -> list[SnapshotRead]:
    get_project(db, project_id)
    snapshots = db.scalars(
        select(models.ProjectSnapshot)
        .where(models.ProjectSnapshot.project_id == project_id)
        .order_by(models.ProjectSnapshot.run_date.desc(), models.ProjectSnapshot.id.desc())
    ).all()
    return [_snapshot_to_read(snapshot) for snapshot in snapshots]


def latest_snapshot(db: Session, project_id: str) -> SnapshotRead:
    snapshot = _latest_snapshot_model(db, project_id)
    if snapshot is None:
        raise ProjectNotFoundError(f"No snapshots found for project {project_id}.")
    return _snapshot_to_read(snapshot)


def project_overview_table(db: Session, project_id: str) -> ProjectOverviewTableResponse:
    snapshot = _latest_snapshot_model(db, project_id)
    if snapshot is None or not snapshot.raw_payload_json:
        raise ProjectNotFoundError(f"No snapshot data found for project {project_id}.")
    plan = NormalizedProjectPlan.model_validate(json.loads(snapshot.raw_payload_json))
    scoring = score_project_plan(plan, run_date=snapshot.run_date)
    rows: list[ProjectOverviewRow] = []

    signal_text = {
        signal: _plain_signal_reason(signal, item.reason)
        for signal, item in scoring.breakdown.items()
    }

    for index, task in enumerate(plan.tasks):
        rows.append(
            ProjectOverviewRow(
                row_type="task",
                index=index,
                name=task.name,
                status=task.status,
                start_date=task.start_date,
                end_date=task.end_date,
                percent_complete=_task_completion(task.status, task.percent_complete),
                critical=task.is_critical_path,
                schedule_slippage=_task_schedule_summary(task, snapshot.run_date),
                budget_burn=signal_text["budget"],
                milestone_health=_task_milestone_summary(task),
                blockers=_task_blocker_summary(task, signal_text["blockers"]),
                stakeholder_sentiment=signal_text["sentiment"],
                other_indicators={
                    "linked_milestone": task.milestone,
                    "scope_changes": len(plan.scope_changes),
                    "source": plan.source_type,
                },
            )
        )

    for index, milestone in enumerate(plan.milestones):
        rows.append(
            ProjectOverviewRow(
                row_type="milestone",
                index=index,
                name=milestone.name,
                status=milestone.status,
                end_date=milestone.due_date,
                percent_complete=_task_completion(milestone.status, None),
                critical=milestone.is_critical_path,
                schedule_slippage=_milestone_schedule_summary(milestone, snapshot.run_date),
                budget_burn=signal_text["budget"],
                milestone_health=f"Milestone is {milestone.status or 'not updated'} with due date {milestone.due_date or 'missing'}.",
                blockers=signal_text["blockers"],
                stakeholder_sentiment=signal_text["sentiment"],
                other_indicators={"source": plan.source_type},
            )
        )

    if not rows:
        rows.append(
            ProjectOverviewRow(
                row_type="summary",
                index=0,
                name=plan.metadata.project_name or project_id,
                status="No task rows available",
                percent_complete=plan.metadata.actual_percent_complete,
                schedule_slippage=signal_text["schedule"],
                budget_burn=signal_text["budget"],
                milestone_health=signal_text["milestones"],
                blockers=signal_text["blockers"],
                stakeholder_sentiment=signal_text["sentiment"],
                other_indicators={"source": plan.source_type},
            )
        )

    return ProjectOverviewTableResponse(
        project_id=project_id,
        snapshot_id=snapshot.id,
        run_date=snapshot.run_date,
        rows=rows,
    )


def update_task_critical_path(
    db: Session,
    project_id: str,
    task_index: int,
    payload: CriticalPathUpdate,
) -> ProjectOverviewTableResponse:
    snapshot = _latest_snapshot_model(db, project_id)
    if snapshot is None or not snapshot.raw_payload_json:
        raise ProjectNotFoundError(f"No snapshot data found for project {project_id}.")
    plan = NormalizedProjectPlan.model_validate(json.loads(snapshot.raw_payload_json))
    if task_index < 0 or task_index >= len(plan.tasks):
        raise ValueError("Task index is out of range.")

    plan.tasks[task_index].is_critical_path = payload.critical
    snapshot.raw_payload_json = _json_dumps(plan.model_dump())
    scoring = score_project_plan(plan, run_date=snapshot.run_date)
    if snapshot.score_result:
        snapshot.score_result.composite_score = scoring.composite_score
        snapshot.score_result.rag_status = scoring.rag_status
        snapshot.score_result.schedule_score = scoring.sub_scores["schedule"]
        snapshot.score_result.budget_score = scoring.sub_scores["budget"]
        snapshot.score_result.milestone_score = scoring.sub_scores["milestones"]
        snapshot.score_result.blocker_score = scoring.sub_scores["blockers"]
        snapshot.score_result.sentiment_score = scoring.sub_scores["sentiment"]
        snapshot.score_result.scope_penalty = scoring.scope_penalty
    record_audit_event(
        db,
        event_type="task_critical_path_updated",
        entity_type="snapshot",
        entity_id=str(snapshot.id),
        message=f"Critical path flag updated for task {plan.tasks[task_index].name}.",
        details={"project_id": project_id, "task_index": task_index, "critical": payload.critical},
    )
    db.commit()
    return project_overview_table(db, project_id)


def score_breakdown(db: Session, project_id: str) -> ScoreBreakdownResponse:
    snapshot = _latest_snapshot_model(db, project_id)
    if snapshot is None or snapshot.score_result is None:
        raise ProjectNotFoundError(f"No scored snapshot found for project {project_id}.")

    raw = json.loads(snapshot.raw_payload_json or "{}")
    plan = NormalizedProjectPlan.model_validate(raw)
    scoring = score_project_plan(plan, run_date=snapshot.run_date)
    score = snapshot.score_result

    return ScoreBreakdownResponse(
        project_id=project_id,
        snapshot_id=snapshot.id,
        rag_status=score.rag_status,
        composite_score=score.composite_score,
        data_confidence=snapshot.data_confidence,
        sub_scores={
            "schedule": score.schedule_score,
            "budget": score.budget_score,
            "milestones": score.milestone_score,
            "blockers": score.blocker_score,
            "sentiment": score.sentiment_score,
        },
        scope_penalty=score.scope_penalty,
        breakdown={key: value.model_dump() for key, value in scoring.breakdown.items()},
        override_reasons=scoring.override_reasons,
    )


def simulate_project_scenario(
    db: Session,
    project_id: str,
    payload: ScenarioSimulationRequest,
) -> ScenarioSimulationResponse:
    breakdown = score_breakdown(db, project_id)
    signal = payload.signal.lower().strip()
    if signal not in breakdown.breakdown:
        raise ValueError("Signal must be one of: schedule, budget, milestones, blockers, sentiment.")

    item = breakdown.breakdown[signal]
    current_signal_score = breakdown.sub_scores.get(signal)
    if current_signal_score is None or not item.available:
        simulated_signal_score = None
        simulated_composite = breakdown.composite_score
        movement = 0.0
        note = f"{signal} is unavailable in the latest snapshot, so the scenario cannot move the composite score."
    else:
        simulated_signal_score = round(_clamp(current_signal_score + payload.delta), 1)
        movement = round((simulated_signal_score - current_signal_score) * item.adjusted_weight, 1)
        simulated_composite = round(_clamp(breakdown.composite_score + movement), 1)
        note = (
            f"Scenario applies a {payload.delta:+.1f} point change to {signal}; "
            f"the adjusted portfolio weight is {item.adjusted_weight:.2%}."
        )

    return ScenarioSimulationResponse(
        project_id=project_id,
        snapshot_id=breakdown.snapshot_id,
        signal=signal,
        delta=payload.delta,
        adjusted_weight=item.adjusted_weight,
        current_signal_score=current_signal_score,
        simulated_signal_score=simulated_signal_score,
        current_composite_score=breakdown.composite_score,
        simulated_composite_score=simulated_composite,
        current_rag_status=breakdown.rag_status,
        simulated_rag_status=rag_from_score(simulated_composite),
        movement=movement,
        note=note,
    )


def export_project_report(db: Session, project_id: str) -> str:
    project = get_project(db, project_id)
    snapshot = _latest_snapshot_model(db, project_id, require_project=False)
    if snapshot is None or snapshot.score_result is None:
        raise ProjectNotFoundError(f"No scored snapshot found for project {project_id}.")

    score = snapshot.score_result
    narrative = snapshot.narrative
    top_risks = json.loads(narrative.top_risks_json or "[]") if narrative else []
    actions = json.loads(narrative.recommended_actions_json or "[]") if narrative else []
    warnings = [warning["message"] for warning in json.loads(snapshot.parse_warnings_json or "[]")]

    report = "\n".join(
        [
            f"# {project.name} Weekly Status Report",
            "",
            f"- Project ID: {project.id}",
            f"- Run date: {snapshot.run_date.isoformat()}",
            f"- RAG status: {score.rag_status}",
            f"- Composite score: {score.composite_score}",
            f"- Data confidence: {snapshot.data_confidence:.0%}",
            "",
            "## Narrative",
            narrative.narrative_text if narrative else "No narrative available.",
            "",
            "## Sub-Scores",
            f"- Schedule: {score.schedule_score}",
            f"- Budget: {score.budget_score}",
            f"- Milestones: {score.milestone_score}",
            f"- Blockers: {score.blocker_score}",
            f"- Sentiment: {score.sentiment_score}",
            f"- Scope penalty: {score.scope_penalty}",
            "",
            "## Top Risks",
            *[f"- {risk}" for risk in (top_risks or ["No top risks recorded."])],
            "",
            "## Recommended Actions",
            *[f"- {action}" for action in (actions or ["Continue weekly monitoring."])],
            "",
            "## Parse Warnings",
            *[f"- {warning}" for warning in (warnings or ["No parse warnings."])],
        ]
    )
    record_audit_event(
        db,
        event_type="weekly_markdown_exported",
        entity_type="snapshot",
        entity_id=str(snapshot.id),
        message=f"Weekly Markdown report exported for {project.name}.",
        details={"project_id": project.id, "format": "markdown"},
    )
    db.commit()
    return report


def export_project_report_pdf(db: Session, project_id: str) -> str:
    project = get_project(db, project_id)
    snapshot = _latest_snapshot_model(db, project_id, require_project=False)
    if snapshot is None or snapshot.score_result is None:
        raise ProjectNotFoundError(f"No scored snapshot found for project {project_id}.")

    path = build_weekly_report_pdf(project, snapshot)
    record_audit_event(
        db,
        event_type="weekly_pdf_exported",
        entity_type="snapshot",
        entity_id=str(snapshot.id),
        message=f"Weekly PDF report exported for {project.name}.",
        details={"project_id": project.id, "filename": path.name, "storage": "backend outputs/reports"},
    )
    db.commit()
    return str(path)


def _project_to_read(project: models.Project, latest_health: LatestHealth | None = None) -> ProjectRead:
    return ProjectRead.model_validate(project).model_copy(update={"latest_health": latest_health})


def _latest_health(db: Session, project_id: str) -> LatestHealth | None:
    snapshot = _latest_snapshot_model(db, project_id)
    if snapshot is None or snapshot.score_result is None:
        return None
    return _latest_health_from_snapshot(snapshot)


def _latest_snapshot_model(db: Session, project_id: str, *, require_project: bool = True) -> models.ProjectSnapshot | None:
    if require_project:
        get_project(db, project_id)
    return db.scalars(
        select(models.ProjectSnapshot)
        .where(models.ProjectSnapshot.project_id == project_id)
        .order_by(desc(models.ProjectSnapshot.run_date), desc(models.ProjectSnapshot.id))
        .limit(1)
    ).first()


def _create_alerts(
    db: Session,
    project: models.Project,
    snapshot_id: int,
    scoring: ScoreResult,
    previous_snapshot: models.ProjectSnapshot | None,
) -> None:
    if previous_snapshot and previous_snapshot.score_result:
        previous_status = previous_snapshot.score_result.rag_status
        if previous_status != scoring.rag_status:
            db.add(
                models.Alert(
                    project_id=project.id,
                    snapshot_id=snapshot_id,
                    alert_type="status_flip",
                    message=f"{project.name} changed from {previous_status} to {scoring.rag_status}.",
                )
            )
        previous_budget = previous_snapshot.score_result.budget_score
        current_budget = scoring.sub_scores.get("budget")
        if previous_budget is not None and current_budget is not None and previous_budget - current_budget >= 20:
            db.add(
                models.Alert(
                    project_id=project.id,
                    snapshot_id=snapshot_id,
                    alert_type="budget_spike",
                    message=f"{project.name} budget health dropped by {previous_budget - current_budget:.1f} points.",
                )
            )

    for reason in scoring.override_reasons:
        if "Critical blocker" in reason:
            db.add(
                models.Alert(
                    project_id=project.id,
                    snapshot_id=snapshot_id,
                    alert_type="critical_blocker",
                    message=f"{project.name}: {reason}",
                )
            )
        if "Budget burn ratio" in reason:
            db.add(
                models.Alert(
                    project_id=project.id,
                    snapshot_id=snapshot_id,
                    alert_type="budget_spike",
                    message=f"{project.name}: {reason}",
                )
            )


def _latest_health_from_snapshot(snapshot: models.ProjectSnapshot) -> LatestHealth | None:
    if snapshot.score_result is None:
        return None
    score = snapshot.score_result
    return LatestHealth(
        snapshot_id=snapshot.id,
        run_date=snapshot.run_date,
        rag_status=score.rag_status,
        composite_score=score.composite_score,
        data_confidence=snapshot.data_confidence,
    )


def _snapshot_to_read(snapshot: models.ProjectSnapshot) -> SnapshotRead:
    return SnapshotRead(
        snapshot_id=snapshot.id,
        project_id=snapshot.project_id,
        run_date=snapshot.run_date,
        data_confidence=snapshot.data_confidence,
        parse_warnings=[warning["message"] for warning in json.loads(snapshot.parse_warnings_json or "[]")],
        score=_latest_health_from_snapshot(snapshot),
    )


def _task_completion(status: str | None, percent_complete: float | None) -> float | None:
    normalized = (status or "").strip().lower()
    percent_complete = _normalize_percent_complete(percent_complete)
    if normalized in {"completed", "complete", "done", "closed"}:
        return 100.0
    if normalized in {"not started", "not-started", "todo", "to do", "pending"}:
        return 0.0
    if normalized in {"blocked"}:
        return percent_complete if percent_complete is not None else 25.0
    if normalized in {"at risk", "delayed"}:
        return percent_complete if percent_complete is not None else 40.0
    if normalized in {"in progress", "active", "started"}:
        return percent_complete if percent_complete is not None else 50.0
    return percent_complete


def _normalize_percent_complete(value: float | None) -> float | None:
    if value is None:
        return None
    if 0 < value <= 1:
        return round(value * 100, 1)
    return value


def _task_schedule_summary(task, run_date: date) -> str:
    status = (task.status or "").strip().lower()
    if status in {"completed", "complete", "done", "closed"}:
        return "Completed work; no active schedule slippage on this row."
    if task.end_date and task.end_date < run_date and status not in {"completed", "complete", "done", "closed"}:
        return f"Past planned finish date by {(run_date - task.end_date).days} day(s)."
    if status in {"blocked", "delayed"}:
        return "Schedule risk is active because this task is blocked or delayed."
    if status == "not started":
        return "Not started yet; watch timing against the planned finish date."
    if task.end_date:
        return f"Planned to finish by {task.end_date.isoformat()}."
    return "No task-level finish date available."


def _task_milestone_summary(task) -> str:
    status = (task.status or "").strip().lower()
    if task.milestone:
        return f"Linked to milestone: {task.milestone}."
    if status in {"completed", "complete", "done"}:
        return "Task is complete, so milestone contribution is healthy."
    if status in {"blocked", "delayed", "at risk"}:
        return "Task status may put linked milestones at risk."
    return "No linked milestone recorded for this task."


def _task_blocker_summary(task, fallback: str) -> str:
    status = (task.status or "").strip().lower()
    if status == "blocked":
        return "This task is explicitly blocked and needs owner attention."
    if status in {"delayed", "at risk"}:
        return "This task is showing delivery risk."
    if status in {"completed", "complete", "done"}:
        return "No active blocker on this completed task."
    return fallback


def _milestone_schedule_summary(milestone, run_date: date) -> str:
    status = (milestone.status or "").strip().lower()
    if status in {"completed", "complete", "done", "closed"}:
        return "Milestone completed."
    if milestone.due_date and milestone.due_date < run_date:
        return f"Milestone is overdue by {(run_date - milestone.due_date).days} day(s)."
    if status in {"at risk", "blocked", "delayed"}:
        return "Milestone is actively at risk."
    if milestone.due_date:
        return f"Milestone due on {milestone.due_date.isoformat()}."
    return "No milestone due date available."


def _plain_signal_reason(signal: str, reason: str) -> str:
    if signal == "schedule":
        match = re.search(r"(-?\d+(?:\.\d+)?) percentage points", reason)
        if match:
            value = float(match.group(1))
            if value < -5:
                return f"Work is behind the expected pace by about {abs(value):.1f} points."
            if value > 5:
                return f"Work is ahead of the expected pace by about {value:.1f} points."
            return "Work is broadly tracking the expected schedule."
    if signal == "budget":
        match = re.search(r"(\d+(?:\.\d+)?)x", reason)
        if match:
            ratio = float(match.group(1))
            if ratio > 1.1:
                return f"Spend is running faster than delivery progress at about {ratio:.2f}x."
            return f"Spend is aligned with delivery progress at about {ratio:.2f}x."
    if signal == "milestones":
        return reason.replace("overdue", "overdue milestone(s)").replace("near-term at risk", "near-term at-risk milestone(s)")
    if signal == "blockers":
        return reason.replace("weighted severity and age penalty", "priority based on severity and how long they have been open")
    if signal == "sentiment":
        return reason.replace("Rule-based sentiment classified commentary as", "Project notes currently read as")
    return reason


def _sync_project_metadata(project: models.Project, plan: NormalizedProjectPlan) -> None:
    metadata = plan.metadata
    if metadata.project_name and not (project.id in {"demo_project_plan_b", "demo_s2p_project"} and project.name in {"Project 1", "Project 2"}):
        project.name = metadata.project_name
    if metadata.client_name:
        project.client_name = metadata.client_name
    if metadata.pm_name:
        project.pm_name = metadata.pm_name
    if metadata.start_date:
        project.start_date = metadata.start_date
    if metadata.planned_end_date:
        project.planned_end_date = metadata.planned_end_date
    if metadata.budget_total is not None:
        project.budget_total = metadata.budget_total


def _replace_project_reference_data(
    db: Session,
    project: models.Project,
    plan: NormalizedProjectPlan,
    *,
    snapshot_id: int | None = None,
) -> None:
    db.query(models.Milestone).filter(models.Milestone.project_id == project.id).delete()
    if snapshot_id is None:
        db.query(models.RiskBlocker).filter(models.RiskBlocker.project_id == project.id).delete()
    else:
        db.query(models.RiskBlocker).filter(models.RiskBlocker.snapshot_id == snapshot_id).delete()

    for milestone in plan.milestones:
        db.add(
            models.Milestone(
                project_id=project.id,
                name=milestone.name,
                due_date=milestone.due_date,
                status=milestone.status or "unknown",
                is_critical_path=milestone.is_critical_path,
            )
        )
    for risk in plan.risks:
        db.add(
            models.RiskBlocker(
                project_id=project.id,
                snapshot_id=snapshot_id,
                description=risk.description,
                severity=risk.severity,
                opened_date=risk.opened_date,
                resolved_date=risk.resolved_date,
            )
        )


def _score_model(snapshot_id: int, scoring: ScoreResult) -> models.ScoreResult:
    return models.ScoreResult(
        snapshot_id=snapshot_id,
        composite_score=scoring.composite_score,
        rag_status=scoring.rag_status,
        schedule_score=scoring.sub_scores["schedule"],
        budget_score=scoring.sub_scores["budget"],
        milestone_score=scoring.sub_scores["milestones"],
        blocker_score=scoring.sub_scores["blockers"],
        sentiment_score=scoring.sub_scores["sentiment"],
        scope_penalty=scoring.scope_penalty,
    )


def _analysis_response(
    project: models.Project,
    snapshot: models.ProjectSnapshot,
    scoring: ScoreResult,
    warning_messages: list[str],
    agent_result: AgentNarrativeResult | None = None,
) -> AnalysisResponse:
    agent_result = agent_result or AgentNarrativeResult(
        narrative=snapshot.narrative.narrative_text if snapshot.narrative else _template_narrative(project.name, scoring),
        top_risks=json.loads(snapshot.narrative.top_risks_json or "[]") if snapshot.narrative else scoring.top_risks,
        recommended_actions=json.loads(snapshot.narrative.recommended_actions_json or "[]") if snapshot.narrative else scoring.recommended_actions,
        reasoning_trace=json.loads(snapshot.narrative.reasoning_trace_json or "[]") if snapshot.narrative else [],
        llm_provider_used=snapshot.narrative.llm_provider_used if snapshot.narrative else "deterministic-template",
    )
    return AnalysisResponse(
        project_id=project.id,
        project_name=project.name,
        run_date=snapshot.run_date,
        rag_status=scoring.rag_status,
        composite_score=scoring.composite_score,
        data_confidence=snapshot.data_confidence,
        sub_scores=scoring.sub_scores,
        scope_penalty=scoring.scope_penalty,
        narrative=agent_result.narrative,
        top_risks=agent_result.top_risks,
        recommended_actions=agent_result.recommended_actions,
        trend_vs_last_week="baseline",
        parse_warnings=warning_messages,
        reasoning_trace=agent_result.reasoning_trace,
    )


def _template_narrative(project_name: str, scoring: ScoreResult) -> str:
    if scoring.rag_status == "Green":
        return f"{project_name} is Green based on the current deterministic scoring model. The available delivery signals do not indicate material intervention needs."
    if scoring.rag_status == "Amber":
        return f"{project_name} is Amber because one or more delivery signals need management attention this week. The deterministic score should be reviewed alongside the listed risks and actions."
    return f"{project_name} is Red because the deterministic scoring model or override rules indicate active intervention is required."


def _normalized_counts(plan: NormalizedProjectPlan) -> dict[str, int]:
    return {
        "tasks": len(plan.tasks),
        "milestones": len(plan.milestones),
        "risks": len(plan.risks),
        "scope_changes": len(plan.scope_changes),
    }


def _warning_messages(warnings: list[ParseWarning]) -> list[str]:
    return [f"{warning.location}: {warning.message}" if warning.location else warning.message for warning in warnings]


def _json_dumps(value: Any) -> str:
    return json.dumps(value, default=str)


def _clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, value))
