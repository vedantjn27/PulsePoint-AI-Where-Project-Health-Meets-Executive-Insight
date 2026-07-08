"""Portfolio dashboard summary endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import models
from app.db.session import get_db
from app.demo_seed import seed_demo_if_empty
from app.schemas.operations import DashboardProjectHealth, DashboardSummary


router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(db: DbSession) -> DashboardSummary:
    seed_demo_if_empty(db)
    projects = db.scalars(select(models.Project)).all()
    latest = [_latest_health(db, project) for project in projects]

    rag_counts = {"Green": 0, "Amber": 0, "Red": 0, "Unknown": 0}
    confidences: list[float] = []
    for item in latest:
        if item.rag_status is None:
            rag_counts["Unknown"] += 1
        else:
            rag_counts[item.rag_status] = rag_counts.get(item.rag_status, 0) + 1
        if item.data_confidence is not None:
            confidences.append(item.data_confidence)

    open_critical_alerts = db.scalar(
        select(func.count(models.Alert.id)).where(
            models.Alert.alert_type == "critical_blocker",
            models.Alert.acknowledged.is_(False),
        )
    ) or 0

    return DashboardSummary(
        total_projects=len(projects),
        rag_counts=rag_counts,
        average_data_confidence=round(sum(confidences) / len(confidences), 2) if confidences else 0.0,
        open_critical_alerts=open_critical_alerts,
        latest_projects=latest,
    )


def _latest_health(db: Session, project: models.Project) -> DashboardProjectHealth:
    snapshot = db.scalars(
        select(models.ProjectSnapshot)
        .where(models.ProjectSnapshot.project_id == project.id)
        .order_by(models.ProjectSnapshot.run_date.desc(), models.ProjectSnapshot.id.desc())
        .limit(1)
    ).first()
    score = snapshot.score_result if snapshot and snapshot.score_result else None
    return DashboardProjectHealth(
        project_id=project.id,
        project_name=project.name,
        rag_status=score.rag_status if score else None,
        composite_score=score.composite_score if score else None,
        data_confidence=snapshot.data_confidence if snapshot else None,
    )
