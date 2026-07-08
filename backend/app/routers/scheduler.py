"""Scheduler status, configuration, and run-now endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.scheduler.weekly_job import configure_scheduler, run_all_now, scheduler_status
from app.schemas.operations import RunAllResult, SchedulerConfigUpdate, SchedulerStatus


router = APIRouter(prefix="/scheduler", tags=["Scheduler"])


@router.get("/status", response_model=SchedulerStatus)
def get_scheduler_status() -> SchedulerStatus:
    return scheduler_status()


@router.put("/config", response_model=SchedulerStatus)
def update_scheduler_config(payload: SchedulerConfigUpdate) -> SchedulerStatus:
    try:
        return configure_scheduler(payload.cron)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid cron expression: {payload.cron}") from exc


@router.post("/run-all-now", response_model=RunAllResult)
def run_all_now_endpoint() -> RunAllResult:
    return run_all_now()
