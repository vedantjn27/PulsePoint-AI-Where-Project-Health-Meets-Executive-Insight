"""Operational API schemas for alerts, dashboard, scheduler, and demo mode."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class AlertRead(BaseModel):
    id: int
    project_id: str
    snapshot_id: int | None
    alert_type: str
    message: str
    created_at: datetime
    acknowledged: bool


class DashboardProjectHealth(BaseModel):
    project_id: str
    project_name: str
    rag_status: str | None
    composite_score: float | None
    data_confidence: float | None


class DashboardSummary(BaseModel):
    total_projects: int
    rag_counts: dict[str, int]
    average_data_confidence: float
    open_critical_alerts: int
    latest_projects: list[DashboardProjectHealth] = Field(default_factory=list)


class SchedulerStatus(BaseModel):
    running: bool
    cron: str
    next_run_time: str | None = None
    last_run_time: str | None = None
    last_run_result: dict | None = None


class SchedulerConfigUpdate(BaseModel):
    cron: str


class RunAllResult(BaseModel):
    attempted: int
    analyzed: int
    skipped: int
    errors: list[str] = Field(default_factory=list)


class DemoSeedResult(BaseModel):
    projects_created: int
    snapshots_created: int
    message: str


class AskRequest(BaseModel):
    question: str


class AskResponse(BaseModel):
    answer: str
    reasoning_trace: list[dict] = Field(default_factory=list)
    projects_considered: int
    llm_provider_used: str


class AuditLogRead(BaseModel):
    id: int
    event_type: str
    entity_type: str | None
    entity_id: str | None
    message: str
    details: dict
    created_at: datetime


class ScoringConfigUpdateRequest(BaseModel):
    config: dict
    change_reason: str | None = None


class ScoringConfigVersionRead(BaseModel):
    id: int
    version: int
    config: dict
    change_reason: str | None
    created_at: datetime
