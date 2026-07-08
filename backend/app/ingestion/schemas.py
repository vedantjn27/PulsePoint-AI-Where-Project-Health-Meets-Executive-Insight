"""Normalized ingestion schemas for uploaded project plans."""

from __future__ import annotations

from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


RagUnknown = Literal["Unknown"]


class ParseWarning(BaseModel):
    """A non-fatal issue found while parsing or validating source data."""

    code: str
    message: str
    location: str | None = None


class NormalizedTask(BaseModel):
    name: str
    start_date: date | None = None
    end_date: date | None = None
    percent_complete: float | None = Field(default=None, ge=0, le=100)
    status: str | None = None
    milestone: str | None = None
    is_critical_path: bool = False


class NormalizedMilestone(BaseModel):
    name: str
    due_date: date | None = None
    status: str | None = None
    is_critical_path: bool = False


class NormalizedRisk(BaseModel):
    description: str
    severity: str = "Low"
    opened_date: date | None = None
    resolved_date: date | None = None
    status: str | None = None


class NormalizedScopeChange(BaseModel):
    description: str
    change_date: date | None = None
    impact: str | None = None


class ProjectMetadata(BaseModel):
    project_id: str | None = None
    project_name: str | None = None
    client_name: str | None = None
    pm_name: str | None = None
    start_date: date | None = None
    planned_end_date: date | None = None
    budget_total: float | None = None
    budget_spent: float | None = None
    actual_percent_complete: float | None = Field(default=None, ge=0, le=100)
    status_notes: str | None = None


class NormalizedProjectPlan(BaseModel):
    """Canonical project plan shape used by scoring and persistence later."""

    model_config = ConfigDict(extra="allow")

    metadata: ProjectMetadata = Field(default_factory=ProjectMetadata)
    tasks: list[NormalizedTask] = Field(default_factory=list)
    milestones: list[NormalizedMilestone] = Field(default_factory=list)
    risks: list[NormalizedRisk] = Field(default_factory=list)
    scope_changes: list[NormalizedScopeChange] = Field(default_factory=list)
    source_type: str
    raw_payload: Any | None = None
    parse_warnings: list[ParseWarning] = Field(default_factory=list)


class ValidationResult(BaseModel):
    is_valid: bool
    data_confidence: float = Field(ge=0, le=1)
    warnings: list[ParseWarning] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)
