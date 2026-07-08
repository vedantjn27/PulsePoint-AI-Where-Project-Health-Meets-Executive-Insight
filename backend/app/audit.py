"""Audit logging helpers."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db import models


def record_audit_event(
    db: Session,
    *,
    event_type: str,
    message: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> models.AuditLog:
    entry = models.AuditLog(
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        message=message,
        details_json=json.dumps(details or {}, default=str),
    )
    db.add(entry)
    return entry


def list_audit_events(db: Session, limit: int = 100) -> list[models.AuditLog]:
    return db.scalars(
        select(models.AuditLog)
        .order_by(desc(models.AuditLog.created_at), desc(models.AuditLog.id))
        .limit(limit)
    ).all()
