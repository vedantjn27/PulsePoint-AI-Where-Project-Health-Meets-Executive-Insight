"""Validation and data-confidence logic for normalized project snapshots."""

from __future__ import annotations

from datetime import date

from app.ingestion.schemas import NormalizedProjectPlan, ParseWarning, ValidationResult


CORE_METADATA_FIELDS = ("project_name", "start_date", "planned_end_date", "actual_percent_complete")
OPTIONAL_BUT_USEFUL_FIELDS = ("client_name", "pm_name", "budget_total", "budget_spent", "status_notes")


def validate_project_plan(plan: NormalizedProjectPlan) -> ValidationResult:
    warnings = list(plan.parse_warnings)
    missing_fields: list[str] = []

    _validate_metadata(plan, warnings, missing_fields)
    _validate_tasks(plan, warnings)
    _validate_milestones(plan, warnings)
    _validate_risks(plan, warnings)

    confidence = calculate_data_confidence(plan, warnings, missing_fields)
    is_valid = not any(warning.code == "parse_failed" for warning in warnings)

    return ValidationResult(
        is_valid=is_valid,
        data_confidence=confidence,
        warnings=warnings,
        missing_fields=missing_fields,
    )


def calculate_data_confidence(
    plan: NormalizedProjectPlan,
    warnings: list[ParseWarning] | None = None,
    missing_fields: list[str] | None = None,
) -> float:
    """Return a 0-1 confidence score based on available evidence quality."""
    warnings = warnings or []
    missing_fields = missing_fields or []
    metadata = plan.metadata

    score = 0.0
    possible = 0.0

    for field_name in CORE_METADATA_FIELDS:
        possible += 2.0
        if getattr(metadata, field_name) is not None:
            score += 2.0

    for field_name in OPTIONAL_BUT_USEFUL_FIELDS:
        possible += 1.0
        if getattr(metadata, field_name) is not None:
            score += 1.0

    detail_groups = {
        "tasks": plan.tasks,
        "milestones": plan.milestones,
        "risks": plan.risks,
        "scope_changes": plan.scope_changes,
    }
    for rows in detail_groups.values():
        possible += 1.0
        if rows:
            score += 1.0

    if possible == 0:
        return 0.0

    confidence = score / possible
    warning_penalty = min(0.25, len(warnings) * 0.025)
    missing_penalty = min(0.15, len(missing_fields) * 0.02)
    confidence = max(0.0, confidence - warning_penalty - missing_penalty)

    return round(confidence, 2)


def _validate_metadata(
    plan: NormalizedProjectPlan,
    warnings: list[ParseWarning],
    missing_fields: list[str],
) -> None:
    metadata = plan.metadata

    for field_name in CORE_METADATA_FIELDS:
        if getattr(metadata, field_name) is None:
            missing_fields.append(field_name)
            warnings.append(
                ParseWarning(
                    code="missing_field",
                    message=f"Missing expected field: {field_name}.",
                    location=f"metadata.{field_name}",
                )
            )

    if metadata.start_date and metadata.planned_end_date and metadata.start_date > metadata.planned_end_date:
        warnings.append(
            ParseWarning(
                code="invalid_date_order",
                message="Project start date is after planned end date.",
                location="metadata",
            )
        )

    if metadata.budget_total is not None and metadata.budget_total < 0:
        warnings.append(ParseWarning(code="invalid_budget", message="Budget total cannot be negative.", location="metadata.budget_total"))

    if metadata.budget_spent is not None and metadata.budget_spent < 0:
        warnings.append(ParseWarning(code="invalid_budget", message="Budget spent cannot be negative.", location="metadata.budget_spent"))


def _validate_tasks(plan: NormalizedProjectPlan, warnings: list[ParseWarning]) -> None:
    if not plan.tasks:
        warnings.append(ParseWarning(code="missing_tasks", message="No task rows found.", location="tasks"))
        return

    for index, task in enumerate(plan.tasks):
        location = f"tasks[{index}]"
        if task.start_date and task.end_date and task.start_date > task.end_date:
            warnings.append(ParseWarning(code="invalid_task_dates", message="Task start date is after end date.", location=location))
        if task.end_date is None:
            warnings.append(ParseWarning(code="missing_task_end_date", message="Task has no end/due date.", location=location))
        if task.percent_complete is None:
            warnings.append(ParseWarning(code="missing_task_progress", message="Task has no percent complete.", location=location))


def _validate_milestones(plan: NormalizedProjectPlan, warnings: list[ParseWarning]) -> None:
    if not plan.milestones:
        warnings.append(ParseWarning(code="missing_milestones", message="No milestone rows found.", location="milestones"))
        return

    today = date.today()
    for index, milestone in enumerate(plan.milestones):
        location = f"milestones[{index}]"
        if milestone.due_date is None:
            warnings.append(ParseWarning(code="missing_milestone_due_date", message="Milestone has no due date.", location=location))
        if milestone.due_date and milestone.due_date < today and (milestone.status or "").lower() not in {"done", "complete", "completed"}:
            warnings.append(ParseWarning(code="overdue_milestone", message="Milestone appears overdue.", location=location))


def _validate_risks(plan: NormalizedProjectPlan, warnings: list[ParseWarning]) -> None:
    allowed = {"low", "medium", "med", "high", "critical"}
    for index, risk in enumerate(plan.risks):
        if risk.severity.lower() not in allowed:
            warnings.append(
                ParseWarning(
                    code="unknown_risk_severity",
                    message=f"Risk severity '{risk.severity}' is not a known severity.",
                    location=f"risks[{index}].severity",
                )
            )
