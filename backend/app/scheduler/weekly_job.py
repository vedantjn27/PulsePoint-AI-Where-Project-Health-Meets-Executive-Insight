"""APScheduler weekly portfolio run job."""

from __future__ import annotations

from datetime import UTC, date, datetime
import json
from typing import Any

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db import models
from app.db.session import SessionLocal
from app.ingestion.schemas import NormalizedProjectPlan
from app.scoring.engine import score_project_plan
from app.schemas.operations import RunAllResult, SchedulerStatus


_scheduler = BackgroundScheduler(timezone="UTC")
_cron = get_settings().scheduler_cron
_last_run_time: str | None = None
_last_run_result: dict[str, Any] | None = None


def start_scheduler() -> None:
    if not _scheduler.running:
        _ensure_job()
        _scheduler.start()


def shutdown_scheduler() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)


def configure_scheduler(cron: str) -> SchedulerStatus:
    global _cron
    CronTrigger.from_crontab(cron)
    _cron = cron
    if _scheduler.running:
        _scheduler.reschedule_job("weekly_portfolio_run", trigger=CronTrigger.from_crontab(_cron))
    else:
        _ensure_job()
    return scheduler_status()


def scheduler_status() -> SchedulerStatus:
    job = _scheduler.get_job("weekly_portfolio_run") if _scheduler.running else None
    return SchedulerStatus(
        running=_scheduler.running,
        cron=_cron,
        next_run_time=job.next_run_time.isoformat() if job and job.next_run_time else None,
        last_run_time=_last_run_time,
        last_run_result=_last_run_result,
    )


def run_all_now() -> RunAllResult:
    global _last_run_time, _last_run_result
    with SessionLocal() as db:
        result = _run_all_now(db)
    _last_run_time = datetime.now(UTC).isoformat()
    _last_run_result = result.model_dump()
    return result


def _run_all_now(db: Session) -> RunAllResult:
    projects = db.scalars(select(models.Project)).all()
    attempted = len(projects)
    analyzed = 0
    skipped = 0
    errors: list[str] = []
    for project in projects:
        latest = db.scalars(
            select(models.ProjectSnapshot)
            .where(models.ProjectSnapshot.project_id == project.id)
            .order_by(models.ProjectSnapshot.run_date.desc(), models.ProjectSnapshot.id.desc())
            .limit(1)
        ).first()
        if latest is None or not latest.raw_payload_json:
            skipped += 1
            continue
        try:
            plan = NormalizedProjectPlan.model_validate(json.loads(latest.raw_payload_json))
            scoring = score_project_plan(plan, run_date=date.today())
            snapshot = models.ProjectSnapshot(
                project_id=project.id,
                run_date=date.today(),
                raw_payload_json=latest.raw_payload_json,
                data_confidence=scoring.data_confidence,
                parse_warnings_json=latest.parse_warnings_json,
            )
            db.add(snapshot)
            db.flush()
            db.add(
                models.ScoreResult(
                    snapshot_id=snapshot.id,
                    composite_score=scoring.composite_score,
                    rag_status=scoring.rag_status,
                    schedule_score=scoring.sub_scores["schedule"],
                    budget_score=scoring.sub_scores["budget"],
                    milestone_score=scoring.sub_scores["milestones"],
                    blocker_score=scoring.sub_scores["blockers"],
                    sentiment_score=scoring.sub_scores["sentiment"],
                    scope_penalty=scoring.scope_penalty,
                )
            )
            db.add(
                models.Narrative(
                    snapshot_id=snapshot.id,
                    narrative_text=f"{project.name} was rescored by the scheduled portfolio run.",
                    top_risks_json=json.dumps(scoring.top_risks),
                    recommended_actions_json=json.dumps(scoring.recommended_actions),
                    reasoning_trace_json=json.dumps([]),
                    llm_provider_used="scheduled-deterministic",
                )
            )
            analyzed += 1
        except Exception as exc:
            errors.append(f"{project.id}: {exc}")
    db.commit()
    return RunAllResult(attempted=attempted, analyzed=analyzed, skipped=skipped, errors=errors)


def _ensure_job() -> None:
    if _scheduler.get_job("weekly_portfolio_run") is None:
        _scheduler.add_job(run_all_now, CronTrigger.from_crontab(_cron), id="weekly_portfolio_run", replace_existing=True)
