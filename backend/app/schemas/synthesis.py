"""Monthly synthesis API schemas."""

from __future__ import annotations

from datetime import date
import re

from pydantic import BaseModel, Field, field_validator


class PortfolioTrendPoint(BaseModel):
    run_date: date
    average_score: float
    rag_counts: dict[str, int]


class Mover(BaseModel):
    project_id: str
    project_name: str
    from_status: str
    to_status: str
    score_delta: float
    reason: str


class SignalHealthSummary(BaseModel):
    signal: str
    average_score: float | None = None
    weak_projects: int = 0


class ProjectHealthSummary(BaseModel):
    project_id: str
    project_name: str
    rag_status: str
    composite_score: float
    data_confidence: float
    schedule_score: float | None = None
    budget_score: float | None = None
    milestone_score: float | None = None
    blocker_score: float | None = None
    sentiment_score: float | None = None
    top_risks: list[str] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)


class SynthesisResponse(BaseModel):
    period: str
    generated_date: date
    total_projects: int
    rag_distribution: dict[str, int]
    average_confidence: float
    portfolio_trend: str
    trend_points: list[PortfolioTrendPoint] = Field(default_factory=list)
    movers: list[Mover] = Field(default_factory=list)
    systemic_themes: list[str] = Field(default_factory=list)
    emerging_risks: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    signal_health: list[SignalHealthSummary] = Field(default_factory=list)
    project_health: list[ProjectHealthSummary] = Field(default_factory=list)


class DeckGenerationResponse(BaseModel):
    filename: str
    path: str
    download_url: str
    slides: int
    branding_applied: bool = False


class DeckBrandingConfig(BaseModel):
    use_default_branding: bool = True
    client_name: str | None = None
    primary_color: str | None = None
    accent_color: str | None = None
    logo_path: str | None = None

    @field_validator("primary_color", "accent_color")
    @classmethod
    def validate_hex_color(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = value.strip()
        if not re.fullmatch(r"#?[0-9a-fA-F]{6}", normalized):
            raise ValueError("Color must be a 6-digit hex value, for example #1F2A44.")
        return normalized


class DeckGenerationRequest(BaseModel):
    branding: DeckBrandingConfig | None = None


class SynthesisHistoryItem(BaseModel):
    filename: str
    path: str
    download_url: str
    size_bytes: int
    modified_at: str
