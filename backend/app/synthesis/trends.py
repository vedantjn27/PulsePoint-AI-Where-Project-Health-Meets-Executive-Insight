"""Cross-project trend analysis for monthly synthesis."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import models
from app.schemas.synthesis import Mover, PortfolioTrendPoint, ProjectHealthSummary, SignalHealthSummary, SynthesisResponse


def generate_monthly_synthesis(db: Session) -> SynthesisResponse:
    projects = db.scalars(select(models.Project)).all()
    latest_snapshots = [_latest_snapshot(db, project.id) for project in projects]
    latest_snapshots = [snapshot for snapshot in latest_snapshots if snapshot and snapshot.score_result]

    rag_distribution = Counter(snapshot.score_result.rag_status for snapshot in latest_snapshots)
    for status in ("Green", "Amber", "Red"):
        rag_distribution.setdefault(status, 0)
    rag_distribution["Unknown"] = max(0, len(projects) - len(latest_snapshots))

    confidences = [snapshot.data_confidence for snapshot in latest_snapshots]
    trend_points = _trend_points(db)
    movers = _movers(db, projects)
    themes = _systemic_themes(latest_snapshots)
    emerging_risks = _emerging_risks(latest_snapshots)
    recommendations = _recommendations(rag_distribution, themes, emerging_risks)
    signal_health = _signal_health(latest_snapshots)
    project_health = _project_health(latest_snapshots)

    return SynthesisResponse(
        period=date.today().strftime("%B %Y"),
        generated_date=date.today(),
        total_projects=len(projects),
        rag_distribution=dict(rag_distribution),
        average_confidence=round(sum(confidences) / len(confidences), 2) if confidences else 0.0,
        portfolio_trend=_portfolio_trend(trend_points),
        trend_points=trend_points,
        movers=movers,
        systemic_themes=themes,
        emerging_risks=emerging_risks,
        recommendations=recommendations,
        signal_health=signal_health,
        project_health=project_health,
    )


def _latest_snapshot(db: Session, project_id: str) -> models.ProjectSnapshot | None:
    return db.scalars(
        select(models.ProjectSnapshot)
        .where(models.ProjectSnapshot.project_id == project_id)
        .order_by(models.ProjectSnapshot.run_date.desc(), models.ProjectSnapshot.id.desc())
        .limit(1)
    ).first()


def _trend_points(db: Session) -> list[PortfolioTrendPoint]:
    snapshots = db.scalars(select(models.ProjectSnapshot).join(models.ScoreResult).order_by(models.ProjectSnapshot.run_date)).all()
    by_date_project: dict[date, dict[str, models.ProjectSnapshot]] = defaultdict(dict)
    for snapshot in snapshots:
        current = by_date_project[snapshot.run_date].get(snapshot.project_id)
        if current is None or snapshot.id > current.id:
            by_date_project[snapshot.run_date][snapshot.project_id] = snapshot

    points = []
    for run_date, project_snapshots in sorted(by_date_project.items())[-5:]:
        items = list(project_snapshots.values())
        scores = [item.score_result.composite_score for item in items if item.score_result]
        rag_counts = Counter(item.score_result.rag_status for item in items if item.score_result)
        for status in ("Green", "Amber", "Red"):
            rag_counts.setdefault(status, 0)
        points.append(
            PortfolioTrendPoint(
                run_date=run_date,
                average_score=round(sum(scores) / len(scores), 1) if scores else 0.0,
                rag_counts=dict(rag_counts),
            )
        )
    return points


def _movers(db: Session, projects: list[models.Project]) -> list[Mover]:
    movers = []
    for project in projects:
        snapshots = db.scalars(
            select(models.ProjectSnapshot)
            .where(models.ProjectSnapshot.project_id == project.id)
            .order_by(models.ProjectSnapshot.run_date.desc(), models.ProjectSnapshot.id.desc())
            .limit(2)
        ).all()
        if len(snapshots) < 2 or not snapshots[0].score_result or not snapshots[1].score_result:
            continue
        current = snapshots[0].score_result
        previous = snapshots[1].score_result
        if current.rag_status != previous.rag_status:
            movers.append(
                Mover(
                    project_id=project.id,
                    project_name=project.name,
                    from_status=previous.rag_status,
                    to_status=current.rag_status,
                    score_delta=round(current.composite_score - previous.composite_score, 1),
                    reason=_weakest_signal_reason(current),
                )
            )
    return movers


def _systemic_themes(snapshots: list[models.ProjectSnapshot]) -> list[str]:
    weak = Counter()
    for snapshot in snapshots:
        score = snapshot.score_result
        if not score:
            continue
        if score.budget_score is not None and score.budget_score < 60:
            weak["Budget pressure"] += 1
        if score.schedule_score is not None and score.schedule_score < 60:
            weak["Schedule slippage"] += 1
        if score.blocker_score is not None and score.blocker_score < 60:
            weak["Blocker escalation"] += 1
        if score.milestone_score is not None and score.milestone_score < 60:
            weak["Milestone risk"] += 1
    return [f"{theme} is affecting {count} project(s)." for theme, count in weak.most_common(4)]


def _emerging_risks(snapshots: list[models.ProjectSnapshot]) -> list[str]:
    risks = []
    for snapshot in snapshots:
        if not snapshot.narrative or not snapshot.narrative.top_risks_json:
            continue
        for risk in json.loads(snapshot.narrative.top_risks_json):
            if len(risks) < 5 and risk not in risks:
                risks.append(risk)
    return risks


def _recommendations(rag_distribution: Counter, themes: list[str], emerging_risks: list[str]) -> list[str]:
    recommendations = []
    if rag_distribution.get("Red", 0):
        recommendations.append("Prioritize executive intervention for Red projects before the next governance checkpoint.")
    if any("Budget" in theme for theme in themes):
        recommendations.append("Run a portfolio budget review for projects with burn rates outpacing delivery.")
    if any("Blocker" in theme for theme in themes) or any("blocker" in risk.lower() for risk in emerging_risks):
        recommendations.append("Assign named owners and target resolution dates for high-severity blockers.")
    if not recommendations:
        recommendations.append("Maintain current governance cadence and continue weekly monitoring.")
    return recommendations[:5]


def _signal_health(snapshots: list[models.ProjectSnapshot]) -> list[SignalHealthSummary]:
    signals = {
        "Schedule": "schedule_score",
        "Budget": "budget_score",
        "Milestones": "milestone_score",
        "Blockers": "blocker_score",
        "Sentiment": "sentiment_score",
    }
    summaries = []
    for label, attr in signals.items():
        values = [getattr(snapshot.score_result, attr) for snapshot in snapshots if snapshot.score_result and getattr(snapshot.score_result, attr) is not None]
        weak_projects = sum(1 for value in values if value < 60)
        summaries.append(
            SignalHealthSummary(
                signal=label,
                average_score=round(sum(values) / len(values), 1) if values else None,
                weak_projects=weak_projects,
            )
        )
    return summaries


def _project_health(snapshots: list[models.ProjectSnapshot]) -> list[ProjectHealthSummary]:
    rows = []
    for snapshot in snapshots:
        score = snapshot.score_result
        if not score:
            continue
        top_risks: list[str] = []
        recommended_actions: list[str] = []
        if snapshot.narrative:
            top_risks = json.loads(snapshot.narrative.top_risks_json or "[]")[:3]
            recommended_actions = json.loads(snapshot.narrative.recommended_actions_json or "[]")[:3]
        rows.append(
            ProjectHealthSummary(
                project_id=snapshot.project.id,
                project_name=snapshot.project.name,
                rag_status=score.rag_status,
                composite_score=score.composite_score,
                data_confidence=snapshot.data_confidence,
                schedule_score=score.schedule_score,
                budget_score=score.budget_score,
                milestone_score=score.milestone_score,
                blocker_score=score.blocker_score,
                sentiment_score=score.sentiment_score,
                top_risks=top_risks,
                recommended_actions=recommended_actions,
            )
        )
    status_order = {"Red": 0, "Amber": 1, "Green": 2}
    return sorted(rows, key=lambda row: (status_order.get(row.rag_status, 3), row.composite_score))


def _portfolio_trend(points: list[PortfolioTrendPoint]) -> str:
    if len(points) < 2:
        return "stable"
    delta = points[-1].average_score - points[0].average_score
    if delta > 3:
        return "improving"
    if delta < -3:
        return "declining"
    return "stable"


def _weakest_signal_reason(score: models.ScoreResult) -> str:
    values = {
        "schedule": score.schedule_score,
        "budget": score.budget_score,
        "milestones": score.milestone_score,
        "blockers": score.blocker_score,
        "sentiment": score.sentiment_score,
    }
    available = {key: value for key, value in values.items() if value is not None}
    if not available:
        return "Status changed based on available project signals."
    weakest = min(available, key=lambda key: available[key])
    return f"{weakest.title()} is the weakest signal."
