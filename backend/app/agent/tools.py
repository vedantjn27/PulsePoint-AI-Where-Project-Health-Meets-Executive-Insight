"""Read-only agent tool definitions and schemas."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db import models
from app.scoring.engine import load_scoring_config


@dataclass(frozen=True)
class ToolCallRecord:
    tool: str
    args: dict[str, Any]
    why: str
    result: dict[str, Any]


def get_project_history(db: Session, project_id: str, weeks: int = 4) -> dict[str, Any]:
    snapshots = db.scalars(
        select(models.ProjectSnapshot)
        .where(models.ProjectSnapshot.project_id == project_id)
        .order_by(desc(models.ProjectSnapshot.run_date), desc(models.ProjectSnapshot.id))
        .limit(max(1, weeks))
    ).all()
    return {
        "project_id": project_id,
        "history": [
            {
                "snapshot_id": snapshot.id,
                "run_date": snapshot.run_date.isoformat(),
                "rag_status": snapshot.score_result.rag_status if snapshot.score_result else None,
                "composite_score": snapshot.score_result.composite_score if snapshot.score_result else None,
                "data_confidence": snapshot.data_confidence,
            }
            for snapshot in snapshots
        ],
    }


def get_risk_detail(db: Session, risk_id: int) -> dict[str, Any]:
    risk = db.get(models.RiskBlocker, risk_id)
    if risk is None:
        return {"risk_id": risk_id, "found": False}
    return {
        "risk_id": risk.id,
        "found": True,
        "project_id": risk.project_id,
        "snapshot_id": risk.snapshot_id,
        "description": risk.description,
        "severity": risk.severity,
        "opened_date": risk.opened_date.isoformat() if risk.opened_date else None,
        "resolved_date": risk.resolved_date.isoformat() if risk.resolved_date else None,
    }


def get_similar_past_projects(db: Session, signal_profile: str, limit: int = 5) -> dict[str, Any]:
    query = select(models.ProjectSnapshot).join(models.ScoreResult).order_by(desc(models.ProjectSnapshot.run_date))
    snapshots = db.scalars(query.limit(50)).all()
    profile = signal_profile.lower()
    matches = []
    for snapshot in snapshots:
        score = snapshot.score_result
        if score is None:
            continue
        if _matches_profile(score, profile):
            matches.append(
                {
                    "project_id": snapshot.project_id,
                    "snapshot_id": snapshot.id,
                    "run_date": snapshot.run_date.isoformat(),
                    "rag_status": score.rag_status,
                    "composite_score": score.composite_score,
                    "profile_match": profile,
                }
            )
        if len(matches) >= limit:
            break
    return {"signal_profile": signal_profile, "matches": matches}


def get_scoring_config() -> dict[str, Any]:
    return load_scoring_config()


def recompute_subscore_sensitivity(
    composite_score: float,
    signal: str,
    delta: float,
    adjusted_weight: float,
) -> dict[str, Any]:
    adjusted_delta = delta * adjusted_weight
    new_composite = max(0.0, min(100.0, composite_score + adjusted_delta))
    return {
        "signal": signal,
        "delta": delta,
        "adjusted_weight": adjusted_weight,
        "current_composite": composite_score,
        "new_composite": round(new_composite, 1),
        "movement": round(adjusted_delta, 1),
    }


def execute_tool(db: Session, name: str, args: dict[str, Any]) -> dict[str, Any]:
    if name == "get_project_history":
        return get_project_history(db, str(args["project_id"]), int(args.get("weeks", 4)))
    if name == "get_risk_detail":
        return get_risk_detail(db, int(args["risk_id"]))
    if name == "get_similar_past_projects":
        return get_similar_past_projects(db, str(args["signal_profile"]), int(args.get("limit", 5)))
    if name == "get_scoring_config":
        return get_scoring_config()
    if name == "recompute_subscore_sensitivity":
        return recompute_subscore_sensitivity(
            float(args["composite_score"]),
            str(args["signal"]),
            float(args["delta"]),
            float(args["adjusted_weight"]),
        )
    return {"error": f"Unknown tool: {name}"}


def default_tool_plan(project_id: str, top_risks: list[str], rag_status: str) -> list[dict[str, Any]]:
    plan = [
        {
            "tool": "get_project_history",
            "args": {"project_id": project_id, "weeks": 4},
            "why": "Check whether the current health status is new or part of an existing trend.",
        },
        {
            "tool": "get_scoring_config",
            "args": {},
            "why": "Ground the explanation in the current scoring weights and thresholds.",
        },
    ]
    if top_risks:
        plan.append(
            {
                "tool": "get_similar_past_projects",
                "args": {"signal_profile": _profile_from_risk(top_risks[0])},
                "why": "Compare this signal pattern with similar scored snapshots.",
            }
        )
    if rag_status == "Red":
        plan.append(
            {
                "tool": "get_similar_past_projects",
                "args": {"signal_profile": "red"},
                "why": "Find comparable Red snapshots for stronger intervention framing.",
            }
        )
    return plan


def _matches_profile(score: models.ScoreResult, profile: str) -> bool:
    if "red" in profile:
        return score.rag_status == "Red"
    if "budget" in profile:
        return score.budget_score is not None and score.budget_score < 60
    if "schedule" in profile:
        return score.schedule_score is not None and score.schedule_score < 60
    if "blocker" in profile or "risk" in profile:
        return score.blocker_score is not None and score.blocker_score < 60
    if "milestone" in profile:
        return score.milestone_score is not None and score.milestone_score < 60
    return True


def _profile_from_risk(risk: str) -> str:
    lowered = risk.lower()
    if "budget" in lowered:
        return "budget"
    if "schedule" in lowered:
        return "schedule"
    if "blocker" in lowered or "risk" in lowered:
        return "blocker"
    if "milestone" in lowered:
        return "milestone"
    return "general"
