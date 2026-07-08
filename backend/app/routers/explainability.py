"""Score breakdown and scoring configuration endpoints."""

from __future__ import annotations

from pathlib import Path
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
import yaml
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.audit import record_audit_event
from app.db import models
from app.db.session import get_db
from app.schemas.operations import ScoringConfigVersionRead
from app.scoring.engine import CONFIG_PATH, load_scoring_config


router = APIRouter(tags=["Explainability"])


@router.get("/scoring-config")
def get_scoring_config() -> dict[str, Any]:
    return load_scoring_config()


@router.put("/scoring-config")
def update_scoring_config(payload: dict[str, Any], db: Session = Depends(get_db)) -> dict[str, Any]:
    config = payload.get("config") if "config" in payload else payload
    change_reason = payload.get("change_reason") if "config" in payload else None
    if not isinstance(config, dict):
        raise HTTPException(status_code=400, detail="config must be an object.")

    _validate_scoring_config(config)
    new_version = _next_config_version(db)
    config["version"] = new_version
    _write_config(CONFIG_PATH, config)
    db.add(
        models.ScoringConfigVersion(
            version=new_version,
            config_json=json.dumps(config, default=str),
            change_reason=change_reason,
        )
    )
    record_audit_event(
        db,
        event_type="scoring_config_updated",
        entity_type="scoring_config",
        entity_id=str(new_version),
        message=f"Scoring config updated to version {new_version}.",
        details={"change_reason": change_reason},
    )
    db.commit()
    return load_scoring_config()


@router.get("/scoring-config/history", response_model=list[ScoringConfigVersionRead])
def scoring_config_history(db: Session = Depends(get_db)) -> list[ScoringConfigVersionRead]:
    _ensure_config_version(db)
    rows = db.scalars(
        select(models.ScoringConfigVersion)
        .order_by(desc(models.ScoringConfigVersion.version), desc(models.ScoringConfigVersion.id))
    ).all()
    return [
        ScoringConfigVersionRead(
            id=row.id,
            version=row.version,
            config=json.loads(row.config_json),
            change_reason=row.change_reason,
            created_at=row.created_at,
        )
        for row in rows
    ]


def _validate_scoring_config(config: dict[str, Any]) -> None:
    required_top_level = {"version", "weights", "rag_thresholds", "schedule", "budget", "milestones", "blockers", "sentiment", "scope_penalty", "overrides"}
    missing = required_top_level - set(config)
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing config sections: {sorted(missing)}")

    weights = config["weights"]
    required_weights = {"schedule", "budget", "milestones", "blockers", "sentiment"}
    missing_weights = required_weights - set(weights)
    if missing_weights:
        raise HTTPException(status_code=400, detail=f"Missing scoring weights: {sorted(missing_weights)}")

    total_weight = sum(float(weights[key]) for key in required_weights)
    if not 0.99 <= total_weight <= 1.01:
        raise HTTPException(status_code=400, detail="Scoring weights must sum to 1.0.")

    thresholds = config["rag_thresholds"]
    if float(thresholds["green_min"]) <= float(thresholds["amber_min"]):
        raise HTTPException(status_code=400, detail="green_min must be greater than amber_min.")


def _write_config(path: Path, config: dict[str, Any]) -> None:
    path.write_text(yaml.safe_dump(config, sort_keys=False), encoding="utf-8")


def _ensure_config_version(db: Session) -> None:
    existing = db.scalars(select(models.ScoringConfigVersion).limit(1)).first()
    if existing:
        return
    current = load_scoring_config()
    db.add(
        models.ScoringConfigVersion(
            version=int(current.get("version", 1)),
            config_json=json.dumps(current, default=str),
            change_reason="Initial config snapshot",
        )
    )
    db.commit()


def _next_config_version(db: Session) -> int:
    _ensure_config_version(db)
    latest = db.scalars(
        select(models.ScoringConfigVersion).order_by(desc(models.ScoringConfigVersion.version)).limit(1)
    ).first()
    return int(latest.version if latest else 1) + 1
