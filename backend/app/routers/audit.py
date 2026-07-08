"""Audit log endpoints."""

from __future__ import annotations

import json
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.audit import list_audit_events
from app.db.session import get_db
from app.schemas.operations import AuditLogRead


router = APIRouter(prefix="/audit-log", tags=["Audit"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[AuditLogRead])
def get_audit_log(db: DbSession, limit: int = 100) -> list[AuditLogRead]:
    return [
        AuditLogRead(
            id=entry.id,
            event_type=entry.event_type,
            entity_type=entry.entity_type,
            entity_id=entry.entity_id,
            message=entry.message,
            details=json.loads(entry.details_json or "{}"),
            created_at=entry.created_at,
        )
        for entry in list_audit_events(db, limit=limit)
    ]
