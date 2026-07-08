"""SQLAlchemy models for PulsePoint AI."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    client_name: Mapped[Optional[str]] = mapped_column(String(255))
    pm_name: Mapped[Optional[str]] = mapped_column(String(255))
    start_date: Mapped[Optional[date]] = mapped_column(Date)
    planned_end_date: Mapped[Optional[date]] = mapped_column(Date)
    budget_total: Mapped[Optional[float]] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    snapshots: Mapped[list[ProjectSnapshot]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    milestones: Mapped[list[Milestone]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    risks_blockers: Mapped[list[RiskBlocker]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    alerts: Mapped[list[Alert]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ProjectSnapshot(Base):
    __tablename__ = "project_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    run_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    raw_payload_json: Mapped[Optional[str]] = mapped_column(Text)
    data_confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    parse_warnings_json: Mapped[Optional[str]] = mapped_column(Text)

    project: Mapped[Project] = relationship(back_populates="snapshots")
    score_result: Mapped[Optional[ScoreResult]] = relationship(
        back_populates="snapshot",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )
    narrative: Mapped[Optional[Narrative]] = relationship(
        back_populates="snapshot",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )
    risks_blockers: Mapped[list[RiskBlocker]] = relationship(
        back_populates="snapshot",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    alerts: Mapped[list[Alert]] = relationship(
        back_populates="snapshot",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ScoreResult(Base):
    __tablename__ = "score_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    snapshot_id: Mapped[int] = mapped_column(
        ForeignKey("project_snapshots.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    composite_score: Mapped[float] = mapped_column(Float, nullable=False)
    rag_status: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    schedule_score: Mapped[Optional[float]] = mapped_column(Float)
    budget_score: Mapped[Optional[float]] = mapped_column(Float)
    milestone_score: Mapped[Optional[float]] = mapped_column(Float)
    blocker_score: Mapped[Optional[float]] = mapped_column(Float)
    sentiment_score: Mapped[Optional[float]] = mapped_column(Float)
    scope_penalty: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    snapshot: Mapped[ProjectSnapshot] = relationship(back_populates="score_result")


class Narrative(Base):
    __tablename__ = "narratives"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    snapshot_id: Mapped[int] = mapped_column(
        ForeignKey("project_snapshots.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    narrative_text: Mapped[str] = mapped_column(Text, nullable=False)
    top_risks_json: Mapped[Optional[str]] = mapped_column(Text)
    recommended_actions_json: Mapped[Optional[str]] = mapped_column(Text)
    reasoning_trace_json: Mapped[Optional[str]] = mapped_column(Text)
    llm_provider_used: Mapped[Optional[str]] = mapped_column(String(64))

    snapshot: Mapped[ProjectSnapshot] = relationship(back_populates="narrative")


class Milestone(Base):
    __tablename__ = "milestones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    due_date: Mapped[Optional[date]] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="unknown")
    is_critical_path: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    project: Mapped[Project] = relationship(back_populates="milestones")


class RiskBlocker(Base):
    __tablename__ = "risks_blockers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    snapshot_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("project_snapshots.id", ondelete="CASCADE"),
        index=True,
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(32), nullable=False, default="Low")
    opened_date: Mapped[Optional[date]] = mapped_column(Date)
    resolved_date: Mapped[Optional[date]] = mapped_column(Date)

    project: Mapped[Project] = relationship(back_populates="risks_blockers")
    snapshot: Mapped[Optional[ProjectSnapshot]] = relationship(back_populates="risks_blockers")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    snapshot_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("project_snapshots.id", ondelete="CASCADE"),
        index=True,
    )
    alert_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    acknowledged: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    project: Mapped[Project] = relationship(back_populates="alerts")
    snapshot: Mapped[Optional[ProjectSnapshot]] = relationship(back_populates="alerts")


class ScoringConfig(Base):
    __tablename__ = "scoring_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    signal_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    weight: Mapped[Optional[float]] = mapped_column(Float)
    thresholds_json: Mapped[Optional[str]] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class ScoringConfigVersion(Base):
    __tablename__ = "scoring_config_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    config_json: Mapped[str] = mapped_column(Text, nullable=False)
    change_reason: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    entity_type: Mapped[Optional[str]] = mapped_column(String(128))
    entity_id: Mapped[Optional[str]] = mapped_column(String(128), index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    details_json: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
