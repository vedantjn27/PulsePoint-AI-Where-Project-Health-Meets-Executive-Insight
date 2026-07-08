"""Scoring result schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field


class SignalBreakdown(BaseModel):
    score: float | None
    available: bool
    weight: float
    adjusted_weight: float
    reason: str


class ScoreResult(BaseModel):
    rag_status: str
    composite_score: float
    sub_scores: dict[str, float | None]
    scope_penalty: float
    data_confidence: float
    top_risks: list[str] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)
    override_reasons: list[str] = Field(default_factory=list)
    breakdown: dict[str, SignalBreakdown]

