"""Parsers for JSON, CSV, and XLSX project plan uploads."""

from __future__ import annotations

from datetime import date, datetime
from io import BytesIO, StringIO
import json
from pathlib import Path
import re
from typing import Any

import pandas as pd
from pydantic import ValidationError

from app.ingestion.schemas import (
    NormalizedMilestone,
    NormalizedProjectPlan,
    NormalizedRisk,
    NormalizedScopeChange,
    NormalizedTask,
    ParseWarning,
    ProjectMetadata,
)


FIELD_ALIASES: dict[str, set[str]] = {
    "project_id": {"projectid", "projectcode", "id", "projectnumber"},
    "project_name": {"projectname", "project", "name", "initiative", "engagement"},
    "client_name": {"client", "clientname", "customer", "customername", "account"},
    "pm_name": {"pm", "projectmanager", "projectlead", "deliverymanager", "owner"},
    "start_date": {"startdate", "plannedstart", "projectstart"},
    "planned_end_date": {"plannedenddate", "enddate", "targetend", "finishdate", "plannedfinish"},
    "budget_total": {"budget", "totalbudget", "budgettotal", "approvedbudget"},
    "budget_spent": {"budgetspent", "actualspend", "spendtodate", "costtodate", "spent"},
    "actual_percent_complete": {
        "actualpercentcomplete",
        "percentcomplete",
        "pctcomplete",
        "pctdone",
        "complete",
        "workcomplete",
    },
    "status_notes": {"statusnotes", "notes", "commentary", "pmnotes", "clientnotes", "weeklynotes"},
    "row_type": {"type", "rowtype", "category", "recordtype"},
    "task_name": {"task", "taskname", "activity", "workstream", "item"},
    "milestone_name": {"milestone", "milestonename", "commitment"},
    "risk_description": {"risk", "blocker", "issue", "description", "riskdescription"},
    "scope_description": {"scopechange", "scope", "change", "changedescription"},
    "due_date": {"duedate", "milestonedate", "targetdate"},
    "opened_date": {"openeddate", "createddate", "identifieddate", "raiseddate"},
    "resolved_date": {"resolveddate", "closeddate"},
    "change_date": {"changedate", "requestdate"},
    "status": {"status", "state"},
    "severity": {"severity", "priority", "risklevel"},
    "impact": {"impact", "effect"},
    "is_critical_path": {"criticalpath", "iscriticalpath", "critical", "oncriticalpath"},
}

REVERSE_ALIASES = {
    alias: canonical
    for canonical, aliases in FIELD_ALIASES.items()
    for alias in aliases
}
CANONICAL_FIELDS = set(FIELD_ALIASES.keys())


def normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.strip().lower())


def canonical_field(value: str) -> str:
    if value in CANONICAL_FIELDS:
        return value
    normalized = normalize_key(value)
    return REVERSE_ALIASES.get(normalized, normalized)


def normalize_record(record: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for key, value in record.items():
        if pd.isna(value):
            value = None
        normalized[canonical_field(str(key))] = value
    return normalized


def parse_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"true", "1", "yes", "y", "critical", "x"}


def parse_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, int | float):
        return float(value)
    cleaned = str(value).strip().replace(",", "").replace("%", "")
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_date(value: Any) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    parsed = pd.to_datetime(value, errors="coerce")
    if pd.isna(parsed):
        return None
    return parsed.date()


def parse_json_plan(payload: str | bytes | dict[str, Any]) -> NormalizedProjectPlan:
    warnings: list[ParseWarning] = []
    try:
        data = json.loads(payload.decode("utf-8") if isinstance(payload, bytes) else payload) if isinstance(payload, str | bytes) else payload
    except json.JSONDecodeError as exc:
        return _unknown_plan("json", f"Invalid JSON: {exc}")

    if not isinstance(data, dict):
        return _unknown_plan("json", "JSON root must be an object.")

    metadata = _metadata_from_mapping(data.get("metadata", data), warnings)
    tasks = _typed_list(data.get("tasks", []), _task_from_mapping, "tasks", warnings)
    milestones = _typed_list(data.get("milestones", []), _milestone_from_mapping, "milestones", warnings)
    risks = _typed_list(data.get("risks", data.get("risks_blockers", [])), _risk_from_mapping, "risks", warnings)
    scope_changes = _typed_list(data.get("scope_changes", []), _scope_change_from_mapping, "scope_changes", warnings)

    return NormalizedProjectPlan(
        metadata=metadata,
        tasks=tasks,
        milestones=milestones,
        risks=risks,
        scope_changes=scope_changes,
        source_type="json",
        raw_payload=data,
        parse_warnings=warnings,
    )


def parse_csv_plan(payload: str | bytes) -> NormalizedProjectPlan:
    text = payload.decode("utf-8-sig") if isinstance(payload, bytes) else payload
    try:
        dataframe = pd.read_csv(StringIO(text))
    except Exception as exc:
        return _unknown_plan("csv", f"CSV parse failed: {exc}")
    return _plan_from_dataframe(dataframe, "csv")


def parse_xlsx_plan(payload: bytes) -> NormalizedProjectPlan:
    try:
        sheets = pd.read_excel(BytesIO(payload), sheet_name=None)
    except Exception as exc:
        return _unknown_plan("xlsx", f"XLSX parse failed: {exc}")

    warnings: list[ParseWarning] = []
    combined = NormalizedProjectPlan(source_type="xlsx", parse_warnings=warnings, raw_payload={"sheets": list(sheets.keys())})
    for sheet_name, dataframe in sheets.items():
        sheet_plan = _plan_from_dataframe(dataframe, f"xlsx:{sheet_name}")
        combined.parse_warnings.extend(sheet_plan.parse_warnings)
        combined.tasks.extend(sheet_plan.tasks)
        combined.milestones.extend(sheet_plan.milestones)
        combined.risks.extend(sheet_plan.risks)
        combined.scope_changes.extend(sheet_plan.scope_changes)
        _merge_metadata(combined.metadata, sheet_plan.metadata)

    return combined


def parse_project_plan(path: str | Path) -> NormalizedProjectPlan:
    file_path = Path(path)
    suffix = file_path.suffix.lower()
    if suffix == ".json":
        return parse_json_plan(file_path.read_text(encoding="utf-8"))
    if suffix == ".csv":
        return parse_csv_plan(file_path.read_text(encoding="utf-8-sig"))
    if suffix in {".xlsx", ".xls"}:
        return parse_xlsx_plan(file_path.read_bytes())
    return _unknown_plan("unknown", f"Unsupported file extension: {suffix or '(none)'}")


def parse_upload(filename: str, content: bytes) -> NormalizedProjectPlan:
    suffix = Path(filename).suffix.lower()
    if suffix == ".json":
        return parse_json_plan(content)
    if suffix == ".csv":
        return parse_csv_plan(content)
    if suffix in {".xlsx", ".xls"}:
        return parse_xlsx_plan(content)
    return _unknown_plan("unknown", f"Unsupported file extension: {suffix or '(none)'}")


def _metadata_from_mapping(mapping: dict[str, Any], warnings: list[ParseWarning]) -> ProjectMetadata:
    normalized = normalize_record(mapping)
    return ProjectMetadata(
        project_id=_as_str(normalized.get("project_id")),
        project_name=_as_str(normalized.get("project_name")),
        client_name=_as_str(normalized.get("client_name")),
        pm_name=_as_str(normalized.get("pm_name")),
        start_date=parse_date(normalized.get("start_date")),
        planned_end_date=parse_date(normalized.get("planned_end_date")),
        budget_total=parse_float(normalized.get("budget_total")),
        budget_spent=parse_float(normalized.get("budget_spent")),
        actual_percent_complete=_percent(normalized.get("actual_percent_complete"), "metadata.actual_percent_complete", warnings),
        status_notes=_as_str(normalized.get("status_notes")),
    )


def _typed_list(
    rows: Any,
    factory: Any,
    location: str,
    warnings: list[ParseWarning],
) -> list[Any]:
    if rows in (None, ""):
        return []
    if not isinstance(rows, list):
        warnings.append(ParseWarning(code="invalid_section", message=f"{location} must be a list.", location=location))
        return []

    parsed = []
    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            warnings.append(ParseWarning(code="invalid_row", message="Row is not an object.", location=f"{location}[{index}]"))
            continue
        try:
            parsed.append(factory(row, warnings, f"{location}[{index}]"))
        except ValidationError as exc:
            warnings.append(ParseWarning(code="invalid_row", message=str(exc), location=f"{location}[{index}]"))
    return parsed


def _plan_from_dataframe(dataframe: pd.DataFrame, source_type: str) -> NormalizedProjectPlan:
    warnings: list[ParseWarning] = []
    if dataframe.empty:
        return NormalizedProjectPlan(source_type=source_type, parse_warnings=[ParseWarning(code="empty_file", message="No rows found.")])

    records = [normalize_record(record) for record in dataframe.to_dict(orient="records")]
    metadata = _metadata_from_records(records, warnings)
    tasks: list[NormalizedTask] = []
    milestones: list[NormalizedMilestone] = []
    risks: list[NormalizedRisk] = []
    scope_changes: list[NormalizedScopeChange] = []

    for index, record in enumerate(records):
        row_location = f"{source_type}.row[{index + 2}]"
        row_type = _infer_row_type(record)
        try:
            if row_type == "risk":
                risks.append(_risk_from_mapping(record, warnings, row_location))
            elif row_type == "milestone":
                milestones.append(_milestone_from_mapping(record, warnings, row_location))
            elif row_type == "scope_change":
                scope_changes.append(_scope_change_from_mapping(record, warnings, row_location))
            elif row_type == "task":
                tasks.append(_task_from_mapping(record, warnings, row_location))
        except ValidationError as exc:
            warnings.append(ParseWarning(code="invalid_row", message=str(exc), location=row_location))

    if not any([tasks, milestones, risks, scope_changes]):
        warnings.append(ParseWarning(code="no_detail_rows", message="No task, milestone, risk, or scope rows were detected."))

    return NormalizedProjectPlan(
        metadata=metadata,
        tasks=tasks,
        milestones=milestones,
        risks=risks,
        scope_changes=scope_changes,
        source_type=source_type,
        raw_payload={"rows": len(records)},
        parse_warnings=warnings,
    )


def _metadata_from_records(records: list[dict[str, Any]], warnings: list[ParseWarning]) -> ProjectMetadata:
    merged: dict[str, Any] = {}
    metadata_fields = ProjectMetadata.model_fields.keys()
    for record in records:
        for key in metadata_fields:
            value = record.get(key)
            if value not in (None, "") and key not in merged:
                merged[key] = value
    return _metadata_from_mapping(merged, warnings)


def _infer_row_type(record: dict[str, Any]) -> str | None:
    explicit_type = str(record.get("row_type") or "").strip().lower()
    if explicit_type in {"task", "milestone", "risk", "blocker", "issue", "scope", "scope_change"}:
        if explicit_type in {"blocker", "issue"}:
            return "risk"
        if explicit_type == "scope":
            return "scope_change"
        return explicit_type
    if record.get("risk_description"):
        return "risk"
    if record.get("scope_description"):
        return "scope_change"
    if record.get("milestone_name"):
        return "milestone"
    if record.get("task_name"):
        return "task"
    return None


def _task_from_mapping(mapping: dict[str, Any], warnings: list[ParseWarning], location: str) -> NormalizedTask:
    record = normalize_record(mapping)
    name = _as_str(record.get("task_name") or record.get("project_name") or record.get("name"))
    if not name:
        warnings.append(ParseWarning(code="missing_task_name", message="Task row missing a task name.", location=location))
        name = "Unnamed task"
    return NormalizedTask(
        name=name,
        start_date=parse_date(record.get("start_date")),
        end_date=parse_date(record.get("planned_end_date") or record.get("due_date")),
        percent_complete=_percent(record.get("actual_percent_complete"), f"{location}.percent_complete", warnings),
        status=_as_str(record.get("status")),
        milestone=_as_str(record.get("milestone_name")),
        is_critical_path=parse_bool(record.get("is_critical_path")),
    )


def _milestone_from_mapping(mapping: dict[str, Any], warnings: list[ParseWarning], location: str) -> NormalizedMilestone:
    record = normalize_record(mapping)
    name = _as_str(record.get("milestone_name") or record.get("task_name") or record.get("project_name") or record.get("name"))
    if not name:
        warnings.append(ParseWarning(code="missing_milestone_name", message="Milestone row missing a name.", location=location))
        name = "Unnamed milestone"
    return NormalizedMilestone(
        name=name,
        due_date=parse_date(record.get("due_date") or record.get("planned_end_date")),
        status=_as_str(record.get("status")),
        is_critical_path=parse_bool(record.get("is_critical_path")),
    )


def _risk_from_mapping(mapping: dict[str, Any], warnings: list[ParseWarning], location: str) -> NormalizedRisk:
    record = normalize_record(mapping)
    description = _as_str(record.get("risk_description"))
    if not description:
        warnings.append(ParseWarning(code="missing_risk_description", message="Risk row missing a description.", location=location))
        description = "Unspecified risk"
    return NormalizedRisk(
        description=description,
        severity=_as_str(record.get("severity")) or "Low",
        opened_date=parse_date(record.get("opened_date")),
        resolved_date=parse_date(record.get("resolved_date")),
        status=_as_str(record.get("status")),
    )


def _scope_change_from_mapping(mapping: dict[str, Any], warnings: list[ParseWarning], location: str) -> NormalizedScopeChange:
    record = normalize_record(mapping)
    description = _as_str(record.get("scope_description") or record.get("risk_description"))
    if not description:
        warnings.append(ParseWarning(code="missing_scope_description", message="Scope row missing a description.", location=location))
        description = "Unspecified scope change"
    return NormalizedScopeChange(
        description=description,
        change_date=parse_date(record.get("change_date")),
        impact=_as_str(record.get("impact")),
    )


def _merge_metadata(target: ProjectMetadata, source: ProjectMetadata) -> None:
    for field_name in ProjectMetadata.model_fields:
        if getattr(target, field_name) is None and getattr(source, field_name) is not None:
            setattr(target, field_name, getattr(source, field_name))


def _percent(value: Any, location: str, warnings: list[ParseWarning]) -> float | None:
    parsed = parse_float(value)
    if parsed is None:
        return None
    if parsed < 0 or parsed > 100:
        warnings.append(ParseWarning(code="invalid_percent", message=f"Percent value {parsed} must be between 0 and 100.", location=location))
        return None
    return parsed


def _as_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _unknown_plan(source_type: str, message: str) -> NormalizedProjectPlan:
    return NormalizedProjectPlan(
        source_type=source_type,
        parse_warnings=[ParseWarning(code="parse_failed", message=message)],
    )
