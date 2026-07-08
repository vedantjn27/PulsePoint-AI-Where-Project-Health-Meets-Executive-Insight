from datetime import date

from app.ingestion.parsers import parse_csv_plan, parse_project_plan
from app.ingestion.schemas import NormalizedProjectPlan, NormalizedRisk, NormalizedScopeChange, ProjectMetadata
from app.scoring.engine import score_project_plan


RUN_DATE = date(2026, 7, 15)


def test_on_track_sample_scores_green() -> None:
    plan = parse_project_plan("sample_data/on_track_project.json")

    result = score_project_plan(plan, run_date=RUN_DATE)

    assert result.rag_status == "Green"
    assert result.composite_score >= 75
    assert result.sub_scores["schedule"] is not None
    assert result.sub_scores["budget"] is not None
    assert result.breakdown["budget"].adjusted_weight == 0.25


def test_messy_budget_pressure_sample_scores_red_by_budget_override() -> None:
    plan = parse_project_plan("sample_data/messy_project.csv")

    result = score_project_plan(plan, run_date=RUN_DATE)

    assert result.rag_status == "Red"
    assert any("Budget burn ratio" in reason for reason in result.override_reasons)
    assert result.sub_scores["budget"] == 0
    assert result.top_risks


def test_missing_budget_redistributes_weight_without_zeroing_score() -> None:
    csv_payload = """Project,Start Date,End Date,% Complete,Type,Task,Due Date,Status,PM Notes
No Budget Project,2026-07-01,2026-08-01,50,task,Planning,2026-07-20,In Progress,Project is stable and on track.
No Budget Project,2026-07-01,2026-08-01,50,milestone,Design Signoff,2026-07-25,On Track,Project is stable and on track.
"""
    plan = parse_csv_plan(csv_payload)

    result = score_project_plan(plan, run_date=RUN_DATE)

    assert result.breakdown["budget"].available is False
    assert result.breakdown["budget"].adjusted_weight == 0
    assert result.breakdown["schedule"].adjusted_weight > 0.25
    assert result.composite_score > 0


def test_critical_blocker_open_more_than_threshold_forces_red() -> None:
    plan = NormalizedProjectPlan(
        source_type="test",
        metadata=ProjectMetadata(
            project_name="Blocked Project",
            start_date=date(2026, 7, 1),
            planned_end_date=date(2026, 8, 1),
            actual_percent_complete=60,
            budget_total=100000,
            budget_spent=30000,
            status_notes="Work is otherwise stable.",
        ),
        risks=[
            NormalizedRisk(
                description="Vendor credentials unavailable.",
                severity="Critical",
                opened_date=date(2026, 6, 25),
                status="Open",
            )
        ],
    )

    result = score_project_plan(plan, run_date=RUN_DATE)

    assert result.rag_status == "Red"
    assert any("Critical blocker" in reason for reason in result.override_reasons)


def test_scope_changes_apply_configured_penalty() -> None:
    plan = parse_project_plan("sample_data/on_track_project.json")
    plan.scope_changes = [
        NormalizedScopeChange(description="Added reporting dashboard", change_date=date(2026, 7, 1)),
        NormalizedScopeChange(description="Added migration validation", change_date=date(2026, 7, 8)),
        NormalizedScopeChange(description="Added extra training", change_date=date(2026, 7, 12)),
    ]

    result = score_project_plan(plan, run_date=RUN_DATE)

    assert result.scope_penalty == -6


def test_negative_commentary_lowers_sentiment_score() -> None:
    plan = parse_project_plan("sample_data/on_track_project.json")
    plan.metadata.status_notes = "Client is concerned. Delivery is delayed and escalation risk is increasing."

    result = score_project_plan(plan, run_date=RUN_DATE)

    assert result.sub_scores["sentiment"] == 35
