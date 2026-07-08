"""Sample data seeding utilities backed by internship-provided XLSX files."""

from __future__ import annotations

from copy import deepcopy
from datetime import date, timedelta
import json
from pathlib import Path
import re

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import record_audit_event
from app.db import models
from app.ingestion.parsers import parse_project_plan
from app.ingestion.schemas import (
    NormalizedMilestone,
    NormalizedProjectPlan,
    NormalizedRisk,
    NormalizedTask,
    ProjectMetadata,
)
from app.ingestion.validators import validate_project_plan
from app.scoring.engine import score_project_plan
from app.schemas.operations import DemoSeedResult


SAMPLE_DIR = Path(__file__).resolve().parents[1] / "sample_data"


def seed_demo_data(db: Session, *, reset_demo: bool = True) -> DemoSeedResult:
    """Seed only the two XLSX workbooks in sample_data/. Curated demo plans are
    NOT seeded automatically — they are retained only for reference."""
    if reset_demo:
        _clear_sample_projects(db)

    snapshots_created = 0
    projects_created = 0
    sample_files = sorted(SAMPLE_DIR.glob("*.xlsx"))
    for index, file_path in enumerate(sample_files, start=1):
        project_id = f"demo_{_slug(file_path.stem)}"
        if db.get(models.Project, project_id) is not None:
            continue

        plan = _enriched_plan(file_path, project_id, display_name=f"Project {index}")
        created, snapshots = _seed_plan(db, plan, source_label=file_path.name)
        projects_created += created
        snapshots_created += snapshots

    for plan, source_label in _curated_rag_demo_plans():
        if db.get(models.Project, plan.metadata.project_id) is not None:
            continue
        created, snapshots = _seed_plan(db, plan, source_label=source_label)
        projects_created += created
        snapshots_created += snapshots

    record_audit_event(
        db,
        event_type="sample_data_seeded",
        entity_type="demo_seed",
        entity_id="sample_data",
        message="Internship sample workbooks and curated RAG demos loaded.",
        details={
            "projects_created": projects_created,
            "snapshots_created": snapshots_created,
            "sample_files": [path.name for path in sample_files],
            "curated_demo_projects": [plan.metadata.project_id for plan, _ in _curated_rag_demo_plans()],
        },
    )
    db.commit()
    return DemoSeedResult(
        projects_created=projects_created,
        snapshots_created=snapshots_created,
        message="Internship sample workbooks and curated RAG demos loaded.",
    )


def _seed_plan(db: Session, plan: NormalizedProjectPlan, *, source_label: str) -> tuple[int, int]:
    validation = validate_project_plan(plan)
    project = models.Project(
        id=plan.metadata.project_id,
        name=plan.metadata.project_name or plan.metadata.project_id,
        client_name=plan.metadata.client_name,
        pm_name=plan.metadata.pm_name,
        start_date=plan.metadata.start_date,
        planned_end_date=plan.metadata.planned_end_date,
        budget_total=plan.metadata.budget_total,
    )
    db.add(project)
    db.flush()

    snapshots_created = 0
    for index, historical_plan in enumerate(_historical_plans(plan)):
        run_date = date.today() - timedelta(days=(3 - index) * 7)
        scoring = score_project_plan(historical_plan, run_date=run_date)
        snapshot = models.ProjectSnapshot(
            project_id=project.id,
            run_date=run_date,
            raw_payload_json=json.dumps(historical_plan.model_dump(), default=str),
            data_confidence=validation.data_confidence,
            parse_warnings_json=json.dumps([warning.model_dump() for warning in validation.warnings]),
        )
        db.add(snapshot)
        db.flush()
        db.add(_score_model(snapshot.id, scoring))
        db.add(
            models.Narrative(
                snapshot_id=snapshot.id,
                narrative_text=f"{project.name} sample snapshot: {scoring.rag_status}.",
                top_risks_json=json.dumps(scoring.top_risks),
                recommended_actions_json=json.dumps(scoring.recommended_actions),
                reasoning_trace_json=json.dumps([]),
                llm_provider_used="sample-seed",
            )
        )
        snapshots_created += 1

    db.add(
        models.Alert(
            project_id=project.id,
            alert_type="sample_seed",
            message=f"{project.name} loaded from {source_label}.",
            acknowledged=True,
        )
    )
    return 1, snapshots_created


def seed_demo_if_empty(db: Session) -> DemoSeedResult | None:
    has_project = db.scalars(select(models.Project).limit(1)).first()
    if has_project is not None:
        return None
    return seed_demo_data(db, reset_demo=False)


def _clear_sample_projects(db: Session) -> None:
    """Delete ALL projects so the database is completely clean before re-seeding."""
    projects = db.scalars(select(models.Project)).all()
    for project in projects:
        db.delete(project)
    db.commit()


def _enriched_plan(file_path: Path, project_id: str, *, display_name: str | None = None) -> NormalizedProjectPlan:
    plan = parse_project_plan(file_path)
    summary = _summary_metadata(file_path)
    plan.metadata.project_id = project_id
    plan.metadata.project_name = display_name or plan.metadata.project_name or summary.get("project_name") or _first_project_title(plan) or file_path.stem
    plan.metadata.pm_name = plan.metadata.pm_name or summary.get("pm_name")
    plan.metadata.start_date = plan.metadata.start_date or summary.get("start_date")
    plan.metadata.planned_end_date = plan.metadata.planned_end_date or summary.get("planned_end_date")
    if not plan.metadata.status_notes:
        plan.metadata.status_notes = _comments_summary(file_path)
    return plan


def _curated_rag_demo_plans() -> list[tuple[NormalizedProjectPlan, str]]:
    today = date.today()
    return [
        (
            NormalizedProjectPlan(
                source_type="curated_demo",
                metadata=ProjectMetadata(
                    project_id="demo_green_customer_onboarding",
                    project_name="Customer Onboarding Acceleration",
                    client_name="Northstar Retail",
                    pm_name="Priya Shah",
                    start_date=today - timedelta(days=35),
                    planned_end_date=today + timedelta(days=75),
                    budget_total=320000,
                    budget_spent=82000,
                    actual_percent_complete=42,
                    status_notes="Delivery is on track, stakeholders are responsive, and blockers are being resolved quickly.",
                ),
                tasks=[
                    NormalizedTask(name="Discovery", start_date=today - timedelta(days=35), end_date=today - timedelta(days=20), percent_complete=100, status="completed"),
                    NormalizedTask(name="Configuration", start_date=today - timedelta(days=19), end_date=today + timedelta(days=22), percent_complete=58, status="in progress", is_critical_path=True),
                ],
                milestones=[
                    NormalizedMilestone(name="Design Signoff", due_date=today - timedelta(days=8), status="completed", is_critical_path=True),
                    NormalizedMilestone(name="Pilot Launch", due_date=today + timedelta(days=28), status="not started", is_critical_path=True),
                ],
                risks=[
                    NormalizedRisk(description="Minor SME scheduling pressure during pilot planning.", severity="Low", opened_date=today - timedelta(days=5), status="open"),
                ],
                scope_changes=[],
            ),
            "Curated Green demo project",
        ),
        (
            NormalizedProjectPlan(
                source_type="curated_demo",
                metadata=ProjectMetadata(
                    project_id="demo_amber_data_migration",
                    project_name="Data Migration Stabilization",
                    client_name="Helio Finance",
                    pm_name="Marcus Chen",
                    start_date=today - timedelta(days=70),
                    planned_end_date=today + timedelta(days=70),
                    budget_total=420000,
                    budget_spent=178000,
                    actual_percent_complete=42,
                    status_notes="Delivery is recoverable but needs management attention due to data quality and milestone pressure.",
                ),
                tasks=[
                    NormalizedTask(name="Source Profiling", start_date=today - timedelta(days=70), end_date=today - timedelta(days=25), percent_complete=95, status="completed"),
                    NormalizedTask(name="Mapping Remediation", start_date=today - timedelta(days=24), end_date=today + timedelta(days=30), percent_complete=35, status="at risk", is_critical_path=True),
                ],
                milestones=[
                    NormalizedMilestone(name="Mock Load 1", due_date=today - timedelta(days=6), status="delayed", is_critical_path=True),
                    NormalizedMilestone(name="Mock Load 2", due_date=today + timedelta(days=12), status="at risk", is_critical_path=True),
                ],
                risks=[
                    NormalizedRisk(description="Data quality remediation is taking longer than expected.", severity="Medium", opened_date=today - timedelta(days=14), status="open"),
                ],
                scope_changes=[
                    {"description": "Additional legacy field mapping requested.", "change_date": today - timedelta(days=10), "impact": "Moderate rework"},
                ],
            ),
            "Curated Amber demo project",
        ),
        (
            NormalizedProjectPlan(
                source_type="curated_demo",
                metadata=ProjectMetadata(
                    project_id="demo_red_vendor_recovery",
                    project_name="Vendor Portal Recovery",
                    client_name="Contoso",
                    pm_name="Alex Morgan",
                    start_date=today - timedelta(days=80),
                    planned_end_date=today + timedelta(days=45),
                    budget_total=180000,
                    budget_spent=155000,
                    actual_percent_complete=45,
                    status_notes="Vendor dependency is creating schedule pressure and escalation is required.",
                ),
                tasks=[
                    NormalizedTask(name="Integration Mapping", start_date=today - timedelta(days=45), end_date=today + timedelta(days=10), percent_complete=45, status="blocked", is_critical_path=True),
                ],
                milestones=[
                    NormalizedMilestone(name="Cutover Readiness", due_date=today - timedelta(days=5), status="at risk", is_critical_path=True),
                ],
                risks=[
                    NormalizedRisk(description="Third-party API credentials not issued.", severity="Critical", opened_date=today - timedelta(days=21), status="open"),
                ],
                scope_changes=[
                    {"description": "Vendor security review added late.", "change_date": today - timedelta(days=7), "impact": "High delay risk"},
                ],
            ),
            "Curated Red demo project",
        ),
    ]


def _historical_plans(plan: NormalizedProjectPlan) -> list[NormalizedProjectPlan]:
    current = plan.metadata.actual_percent_complete or _average_task_completion(plan) or 50
    values = [max(0, current - 18), max(0, current - 10), max(0, current - 5), current]
    historical = []
    for value in values:
        item = deepcopy(plan)
        item.metadata.actual_percent_complete = round(value, 1)
        for task in item.tasks:
            if task.percent_complete is not None:
                task.percent_complete = min(task.percent_complete, round(value, 1))
        historical.append(item)
    return historical


def _summary_metadata(file_path: Path) -> dict:
    try:
        summary = pd.read_excel(file_path, sheet_name="Summary", header=None)
    except Exception:
        return {}
    values = {}
    for _, row in summary.iterrows():
        key = str(row.iloc[0]).strip().lower() if len(row) > 0 else ""
        value = row.iloc[1] if len(row) > 1 else None
        if "project manager" in key:
            values["pm_name"] = str(value).strip()
        elif "project start" in key:
            values["start_date"] = pd.to_datetime(value, errors="coerce").date()
        elif "project end" in key:
            values["planned_end_date"] = pd.to_datetime(value, errors="coerce").date()
        elif key == "project name":
            values["project_name"] = str(value).strip()
    return {key: value for key, value in values.items() if str(value) != "NaT"}


def _comments_summary(file_path: Path) -> str | None:
    try:
        comments = pd.read_excel(file_path, sheet_name="Comments")
    except Exception:
        return None
    texts = []
    for _, row in comments.head(5).iterrows():
        for value in row.tolist():
            if isinstance(value, str) and len(value.strip()) > 20 and not value.startswith("Row "):
                texts.append(value.strip())
    return " ".join(texts[:3]) or None


def _first_project_title(plan: NormalizedProjectPlan) -> str | None:
    for task in plan.tasks:
        if "implementation" in task.name.lower():
            return task.name
    return plan.tasks[0].name if plan.tasks else None


def _average_task_completion(plan: NormalizedProjectPlan) -> float | None:
    values = [task.percent_complete for task in plan.tasks if task.percent_complete is not None]
    if not values:
        return None
    return round(sum(values) / len(values), 1)


def _score_model(snapshot_id: int, scoring):
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


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
