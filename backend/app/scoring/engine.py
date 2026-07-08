"""Config-driven deterministic scoring engine.

The RAG status is computed deterministically here without LLM involvement.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path
import re
from typing import Any

import yaml

from app.ingestion.schemas import NormalizedProjectPlan, NormalizedRisk
from app.ingestion.validators import validate_project_plan
from app.scoring.schemas import ScoreResult, SignalBreakdown


CONFIG_PATH = Path(__file__).with_name("scoring_config.yaml")


def load_scoring_config(path: Path = CONFIG_PATH) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as file:
        return yaml.safe_load(file)


def rag_from_score(score: float, config: dict[str, Any] | None = None) -> str:
    """Return the threshold-based RAG status for a composite score."""
    return _rag_from_score(score, config or load_scoring_config())


def score_project_plan(
    plan: NormalizedProjectPlan,
    *,
    run_date: date | None = None,
    config: dict[str, Any] | None = None,
) -> ScoreResult:
    config = config or load_scoring_config()
    run_date = run_date or date.today()
    validation = validate_project_plan(plan)

    signal_results = {
        "schedule": _score_schedule(plan, run_date, config),
        "budget": _score_budget(plan, config),
        "milestones": _score_milestones(plan, run_date, config),
        "blockers": _score_blockers(plan, run_date, config),
        "sentiment": _score_sentiment(plan, config),
    }
    scope_penalty = _score_scope_penalty(plan, config)
    weighted_score, breakdown = _weighted_composite(signal_results, config)
    composite = _clamp(weighted_score + scope_penalty)
    rag_status = _rag_from_score(composite, config)
    override_reasons = _override_reasons(plan, run_date, config)
    rag_status = _apply_overrides(rag_status, override_reasons)

    return ScoreResult(
        rag_status=rag_status,
        composite_score=round(composite, 1),
        data_confidence=validation.data_confidence,
        sub_scores={signal: result["score"] for signal, result in signal_results.items()},
        scope_penalty=scope_penalty,
        top_risks=_top_risks(plan, signal_results, override_reasons),
        recommended_actions=_recommended_actions(signal_results, override_reasons),
        override_reasons=override_reasons,
        breakdown=breakdown,
    )


def _score_schedule(plan: NormalizedProjectPlan, run_date: date, config: dict[str, Any]) -> dict[str, Any]:
    metadata = plan.metadata
    if metadata.start_date is None or metadata.planned_end_date is None or metadata.actual_percent_complete is None:
        return _unavailable("Schedule requires start date, planned end date, and actual percent complete.")

    total_days = max(1, (metadata.planned_end_date - metadata.start_date).days)
    elapsed_days = (run_date - metadata.start_date).days
    expected_complete = _clamp((elapsed_days / total_days) * 100)
    variance = metadata.actual_percent_complete - expected_complete

    green = float(config["schedule"]["variance_green"])
    red = float(config["schedule"]["variance_red"])
    if variance >= green:
        score = 100.0
    elif variance <= red:
        score = 0.0
    else:
        score = ((variance - red) / (green - red)) * 100

    return {
        "score": round(_clamp(score), 1),
        "available": True,
        "reason": f"Schedule variance is {variance:.1f} percentage points against expected progress.",
    }


def _score_budget(plan: NormalizedProjectPlan, config: dict[str, Any]) -> dict[str, Any]:
    metadata = plan.metadata
    if not metadata.budget_total or metadata.budget_spent is None or metadata.actual_percent_complete in (None, 0):
        return _unavailable("Budget requires total budget, spend to date, and non-zero work completion.")

    budget_spent_percent = (metadata.budget_spent / metadata.budget_total) * 100
    burn_ratio = budget_spent_percent / metadata.actual_percent_complete
    green = float(config["budget"]["burn_ratio_green"])
    red = float(config["budget"]["burn_ratio_red"])

    if burn_ratio <= green:
        score = 100.0
    elif burn_ratio >= red:
        score = 0.0
    else:
        score = (1 - ((burn_ratio - green) / (red - green))) * 100

    return {
        "score": round(_clamp(score), 1),
        "available": True,
        "reason": f"Budget burn ratio is {burn_ratio:.2f}x.",
        "burn_ratio": burn_ratio,
    }


def _score_milestones(plan: NormalizedProjectPlan, run_date: date, config: dict[str, Any]) -> dict[str, Any]:
    if not plan.milestones:
        return _unavailable("No milestone data available.")

    score = 100.0
    overdue = 0
    at_risk = 0
    missing_due = 0
    for milestone in plan.milestones:
        status = (milestone.status or "").lower()
        if milestone.due_date is None:
            missing_due += 1
            score -= float(config["milestones"]["missing_due_date_penalty"])
            continue
        if milestone.due_date < run_date and status not in {"done", "complete", "completed"}:
            overdue += 1
            score -= float(config["milestones"]["overdue_penalty"])
        elif 0 <= (milestone.due_date - run_date).days <= 14 and status in {"at risk", "blocked", "delayed"}:
            at_risk += 1
            score -= float(config["milestones"]["at_risk_penalty"])

    return {
        "score": round(_clamp(score), 1),
        "available": True,
        "reason": f"{overdue} overdue, {at_risk} near-term at risk, {missing_due} missing due dates.",
    }


def _score_blockers(plan: NormalizedProjectPlan, run_date: date, config: dict[str, Any]) -> dict[str, Any]:
    open_risks = [_risk for _risk in plan.risks if _is_open_risk(_risk)]
    if not open_risks:
        return {"score": 100.0, "available": True, "reason": "No open risks or blockers found."}

    severity_points = config["blockers"]["severity_points"]
    age_penalty_per_week = float(config["blockers"]["age_penalty_per_week"])
    max_age_penalty = float(config["blockers"]["max_age_penalty"])

    penalty = 0.0
    for risk in open_risks:
        severity = risk.severity.lower()
        penalty += float(severity_points.get(severity, severity_points["low"]))
        if risk.opened_date:
            age_days = max(0, (run_date - risk.opened_date).days)
            penalty += min(max_age_penalty, (age_days // 7) * age_penalty_per_week)

    score = _clamp(100 - penalty)
    return {
        "score": round(score, 1),
        "available": True,
        "reason": f"{len(open_risks)} open risks/blockers with weighted severity and age penalty.",
    }


def _score_sentiment(plan: NormalizedProjectPlan, config: dict[str, Any]) -> dict[str, Any]:
    notes = plan.metadata.status_notes
    if not notes:
        return {
            "score": float(config["sentiment"]["absent"]),
            "available": True,
            "reason": "No commentary supplied; sentiment defaults to neutral.",
        }

    lowered = notes.lower()
    negative_terms = {"blocked", "risk", "at risk", "delayed", "pressure", "concern", "issue", "escalat"}
    positive_terms = {"on track", "positive", "healthy", "ahead", "resolved", "stable"}
    negative_hits = sum(1 for term in negative_terms if term in lowered)
    positive_hits = sum(1 for term in positive_terms if term in lowered)

    if negative_hits > positive_hits:
        label = "negative"
    elif positive_hits > negative_hits:
        label = "positive"
    else:
        label = "neutral"

    return {
        "score": float(config["sentiment"][label]),
        "available": True,
        "reason": f"Rule-based sentiment classified commentary as {label}.",
    }


def _score_scope_penalty(plan: NormalizedProjectPlan, config: dict[str, Any]) -> float:
    penalty_per_change = float(config["scope_penalty"]["penalty_per_scope_change"])
    max_penalty = float(config["scope_penalty"]["max_penalty"])
    return max(max_penalty, len(plan.scope_changes) * penalty_per_change)


def _weighted_composite(signal_results: dict[str, dict[str, Any]], config: dict[str, Any]) -> tuple[float, dict[str, SignalBreakdown]]:
    weights = config["weights"]
    available_weight = sum(float(weights[signal]) for signal, result in signal_results.items() if result["available"])
    breakdown: dict[str, SignalBreakdown] = {}

    if available_weight == 0:
        return 0.0, {
            signal: SignalBreakdown(
                score=result["score"],
                available=False,
                weight=float(weights[signal]),
                adjusted_weight=0.0,
                reason=result["reason"],
            )
            for signal, result in signal_results.items()
        }

    composite = 0.0
    for signal, result in signal_results.items():
        base_weight = float(weights[signal])
        adjusted_weight = base_weight / available_weight if result["available"] else 0.0
        if result["available"]:
            composite += float(result["score"]) * adjusted_weight
        breakdown[signal] = SignalBreakdown(
            score=result["score"],
            available=result["available"],
            weight=base_weight,
            adjusted_weight=round(adjusted_weight, 4),
            reason=result["reason"],
        )
    return composite, breakdown


def _override_reasons(plan: NormalizedProjectPlan, run_date: date, config: dict[str, Any]) -> list[str]:
    reasons: list[str] = []
    budget_result = _score_budget(plan, config)
    burn_ratio = budget_result.get("burn_ratio")
    if burn_ratio is not None and burn_ratio >= float(config["overrides"]["budget_burn_ratio_red"]):
        reasons.append(f"red: Budget burn ratio is {burn_ratio:.2f}x, above the {config['overrides']['budget_burn_ratio_red']}x override threshold.")

    for risk in plan.risks:
        if not _is_open_risk(risk) or risk.opened_date is None:
            continue
        age_days = (run_date - risk.opened_date).days
        severity = risk.severity.lower()
        if severity == "critical" and age_days > int(config["overrides"]["critical_blocker_open_days_red"]):
            reasons.append(f"red: Critical blocker open for {age_days} days.")
        elif severity == "high" and age_days > int(config["overrides"]["high_blocker_open_days_cap_amber"]):
            reasons.append(f"amber_cap: High severity blocker open for {age_days} days.")
    return reasons


def _apply_overrides(rag_status: str, override_reasons: list[str]) -> str:
    if any(reason.startswith("red:") for reason in override_reasons):
        return "Red"
    if any(reason.startswith("amber_cap:") for reason in override_reasons) and rag_status == "Green":
        return "Amber"
    return rag_status


def _rag_from_score(score: float, config: dict[str, Any]) -> str:
    if score >= float(config["rag_thresholds"]["green_min"]):
        return "Green"
    if score >= float(config["rag_thresholds"]["amber_min"]):
        return "Amber"
    return "Red"


def _top_risks(plan: NormalizedProjectPlan, signal_results: dict[str, dict[str, Any]], override_reasons: list[str]) -> list[str]:
    risks = [re.sub(r"^(red|amber_cap):\s*", "", reason) for reason in override_reasons]
    for signal, result in sorted(signal_results.items(), key=lambda item: item[1]["score"] if item[1]["score"] is not None else 101):
        if result["available"] and result["score"] is not None and result["score"] < 60:
            risks.append(f"{signal.title()} signal is weak: {result['reason']}")
    for risk in plan.risks:
        if _is_open_risk(risk) and risk.severity.lower() in {"high", "critical"}:
            risks.append(f"{risk.severity} risk: {risk.description}")
    return _dedupe(risks)[:5]


def _recommended_actions(signal_results: dict[str, dict[str, Any]], override_reasons: list[str]) -> list[str]:
    actions: list[str] = []
    if any("Budget burn" in reason for reason in override_reasons) or _is_weak(signal_results, "budget"):
        actions.append("Reforecast remaining budget and confirm delivery scope with the project owner.")
    if _is_weak(signal_results, "schedule"):
        actions.append("Review the critical path and reset near-term delivery commitments.")
    if _is_weak(signal_results, "milestones"):
        actions.append("Escalate overdue or at-risk milestones in the next governance meeting.")
    if _is_weak(signal_results, "blockers") or any("blocker" in reason.lower() for reason in override_reasons):
        actions.append("Assign an owner and target resolution date for the highest-severity blocker.")
    if not actions:
        actions.append("Continue weekly monitoring and keep current governance cadence.")
    return actions[:5]


def _is_weak(signal_results: dict[str, dict[str, Any]], signal: str) -> bool:
    result = signal_results[signal]
    return result["available"] and result["score"] is not None and result["score"] < 60


def _is_open_risk(risk: NormalizedRisk) -> bool:
    status = (risk.status or "").lower()
    return risk.resolved_date is None and status not in {"closed", "resolved", "done"}


def _unavailable(reason: str) -> dict[str, Any]:
    return {"score": None, "available": False, "reason": reason}


def _clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, value))


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            deduped.append(item)
    return deduped
