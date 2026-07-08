from io import BytesIO

import pandas as pd

from app.ingestion.parsers import parse_csv_plan, parse_json_plan, parse_project_plan, parse_upload
from app.ingestion.validators import validate_project_plan


def test_parse_sample_json_project() -> None:
    plan = parse_project_plan("sample_data/on_track_project.json")
    result = validate_project_plan(plan)

    assert plan.metadata.project_id == "proj_001"
    assert plan.metadata.project_name == "Acme Fixed-Bid Implementation"
    assert len(plan.tasks) == 2
    assert len(plan.milestones) == 2
    assert len(plan.risks) == 1
    assert result.is_valid is True
    assert result.data_confidence >= 0.75


def test_parse_messy_csv_with_fuzzy_headers() -> None:
    plan = parse_project_plan("sample_data/messy_project.csv")
    result = validate_project_plan(plan)

    assert plan.metadata.project_name == "Vendor Portal Recovery"
    assert plan.metadata.pm_name == "Alex Morgan"
    assert plan.metadata.actual_percent_complete == 52
    assert len(plan.tasks) == 1
    assert len(plan.milestones) == 1
    assert len(plan.risks) == 1
    assert plan.risks[0].severity == "Critical"
    assert result.is_valid is True
    assert result.data_confidence >= 0.65


def test_invalid_json_returns_unknown_plan_with_warning() -> None:
    plan = parse_json_plan("{bad json")
    result = validate_project_plan(plan)

    assert plan.source_type == "json"
    assert result.is_valid is False
    assert result.warnings[0].code == "parse_failed"


def test_parse_xlsx_upload() -> None:
    dataframe = pd.DataFrame(
        [
            {
                "Project Name": "Recovering Data Migration",
                "Client": "Northwind",
                "PM": "Priya Shah",
                "Start Date": "2026-04-01",
                "End Date": "2026-08-30",
                "Budget": 300000,
                "Spent": 180000,
                "pct_done": 70,
                "Type": "task",
                "Task": "Reconciliation",
                "Due Date": "2026-07-25",
                "Status": "In Progress",
            },
            {
                "Project Name": "Recovering Data Migration",
                "Client": "Northwind",
                "PM": "Priya Shah",
                "Start Date": "2026-04-01",
                "End Date": "2026-08-30",
                "Budget": 300000,
                "Spent": 180000,
                "pct_done": 70,
                "Type": "milestone",
                "Milestone": "Data Signoff",
                "Due Date": "2026-08-01",
                "Status": "On Track",
            },
        ]
    )
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        dataframe.to_excel(writer, index=False, sheet_name="weekly_plan")

    plan = parse_upload("plan.xlsx", buffer.getvalue())
    result = validate_project_plan(plan)

    assert plan.metadata.project_name == "Recovering Data Migration"
    assert len(plan.tasks) == 1
    assert len(plan.milestones) == 1
    assert result.is_valid is True


def test_missing_optional_budget_does_not_invalidate_plan() -> None:
    csv_payload = """Project,Start Date,End Date,% Complete,Type,Task,Due Date
No Budget Project,2026-01-01,2026-02-01,40,task,Planning,2026-01-10
"""

    plan = parse_csv_plan(csv_payload)
    result = validate_project_plan(plan)

    assert result.is_valid is True
    assert "budget_total" not in result.missing_fields
    assert result.data_confidence > 0
