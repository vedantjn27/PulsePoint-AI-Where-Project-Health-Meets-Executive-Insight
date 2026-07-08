"""Project API schemas."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    id: str | None = None
    name: str
    client_name: str | None = None
    pm_name: str | None = None
    start_date: date | None = None
    planned_end_date: date | None = None
    budget_total: float | None = None


class LatestHealth(BaseModel):
    snapshot_id: int
    run_date: date
    rag_status: str
    composite_score: float
    data_confidence: float


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    client_name: str | None = None
    pm_name: str | None = None
    start_date: date | None = None
    planned_end_date: date | None = None
    budget_total: float | None = None
    created_at: datetime
    latest_health: LatestHealth | None = None


class UploadResponse(BaseModel):
    project_id: str
    source_type: str
    data_confidence: float
    parse_warnings: list[str] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)
    normalized_counts: dict[str, int]


class ScoreBreakdownItem(BaseModel):
    score: float | None
    available: bool
    weight: float
    adjusted_weight: float
    reason: str


class AnalysisResponse(BaseModel):
    project_id: str
    project_name: str
    run_date: date
    rag_status: str
    composite_score: float
    data_confidence: float
    sub_scores: dict[str, float | None]
    scope_penalty: float
    narrative: str
    top_risks: list[str]
    recommended_actions: list[str]
    trend_vs_last_week: str
    parse_warnings: list[str]
    reasoning_trace: list[dict[str, Any]]


class SnapshotRead(BaseModel):
    snapshot_id: int
    project_id: str
    run_date: date
    data_confidence: float
    parse_warnings: list[str]
    score: LatestHealth | None = None


class ProjectOverviewRow(BaseModel):
    row_type: str
    index: int
    name: str
    status: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    percent_complete: float | None = None
    critical: bool = False
    schedule_slippage: str
    budget_burn: str
    milestone_health: str
    blockers: str
    stakeholder_sentiment: str
    other_indicators: dict[str, Any] = Field(default_factory=dict)


class ProjectOverviewTableResponse(BaseModel):
    project_id: str
    snapshot_id: int
    run_date: date
    rows: list[ProjectOverviewRow]


class CriticalPathUpdate(BaseModel):
    critical: bool


class ScoreBreakdownResponse(BaseModel):
    project_id: str
    snapshot_id: int
    rag_status: str
    composite_score: float
    data_confidence: float
    sub_scores: dict[str, float | None]
    scope_penalty: float
    breakdown: dict[str, ScoreBreakdownItem]
    override_reasons: list[str]


class ScenarioSimulationRequest(BaseModel):
    signal: str = Field(
        description="Signal to adjust: schedule, budget, milestones, blockers, or sentiment.",
    )
    delta: float = Field(
        ge=-100,
        le=100,
        description="Point change to apply to the selected signal score.",
    )


class ScenarioSimulationResponse(BaseModel):
    project_id: str
    snapshot_id: int
    signal: str
    delta: float
    adjusted_weight: float
    current_signal_score: float | None
    simulated_signal_score: float | None
    current_composite_score: float
    simulated_composite_score: float
    current_rag_status: str
    simulated_rag_status: str
    movement: float
    note: str
