"""Alert feed and acknowledgement endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db import models
from app.db.session import get_db
from app.schemas.operations import AlertRead


router = APIRouter(prefix="/alerts", tags=["Alerts"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[AlertRead])
def list_alerts(db: DbSession, acknowledged: bool | None = None, limit: int = 50) -> list[AlertRead]:
    query = select(models.Alert).order_by(desc(models.Alert.created_at), desc(models.Alert.id)).limit(limit)
    if acknowledged is not None:
        query = query.where(models.Alert.acknowledged == acknowledged)
    alerts = db.scalars(query).all()
    return [_alert_to_read(alert) for alert in alerts]


@router.post("/{alert_id}/acknowledge", response_model=AlertRead)
def acknowledge_alert(alert_id: int, db: DbSession) -> AlertRead:
    alert = db.get(models.Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found.")
    alert.acknowledged = True
    db.commit()
    db.refresh(alert)
    return _alert_to_read(alert)


def _alert_to_read(alert: models.Alert) -> AlertRead:
    return AlertRead(
        id=alert.id,
        project_id=alert.project_id,
        snapshot_id=alert.snapshot_id,
        alert_type=alert.alert_type,
        message=alert.message,
        created_at=alert.created_at,
        acknowledged=alert.acknowledged,
    )
