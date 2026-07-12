"""Project CRUD, upload, analyze, snapshots, and score endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.agent.pipeline import (
    ProjectNotFoundError,
    analyze_project_plan,
    create_project,
    delete_project,
    export_project_report,
    export_project_report_pdf,
    get_project,
    latest_snapshot,
    list_projects,
    list_snapshots,
    project_overview_table,
    score_breakdown,
    simulate_project_scenario,
    update_task_critical_path,
    upload_project_plan,
)
from app.db.session import get_db
from app.schemas.projects import (
    AnalysisResponse,
    CriticalPathUpdate,
    ProjectCreate,
    ProjectOverviewTableResponse,
    ProjectRead,
    ScoreBreakdownResponse,
    ScenarioSimulationRequest,
    ScenarioSimulationResponse,
    SnapshotRead,
    UploadResponse,
)


router = APIRouter(prefix="/projects", tags=["Projects"])


DbSession = Annotated[Session, Depends(get_db)]


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project_endpoint(payload: ProjectCreate, db: DbSession) -> ProjectRead:
    try:
        project = create_project(db, payload)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Project ID already exists.") from exc
    return ProjectRead.model_validate(project).model_copy(update={"latest_health": None})


@router.get("", response_model=list[ProjectRead])
def list_projects_endpoint(db: DbSession) -> list[ProjectRead]:
    return list_projects(db)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project_endpoint(project_id: str, db: DbSession) -> ProjectRead:
    try:
        project = get_project(db, project_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    latest = list_projects(db)
    for item in latest:
        if item.id == project.id:
            return item
    return ProjectRead.model_validate(project).model_copy(update={"latest_health": None})


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_endpoint(project_id: str, db: DbSession) -> Response:
    try:
        delete_project(db, project_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{project_id}/upload", response_model=UploadResponse)
async def upload_project_endpoint(
    project_id: str,
    db: DbSession,
    file: UploadFile = File(...),
) -> UploadResponse:
    try:
        return upload_project_plan(db, project_id, file.filename or "upload", await file.read())
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{project_id}/analyze", response_model=AnalysisResponse)
async def analyze_project_endpoint(
    project_id: str,
    db: DbSession,
    file: UploadFile = File(...),
) -> AnalysisResponse:
    try:
        return analyze_project_plan(db, project_id, file.filename or "upload", await file.read())
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{project_id}/snapshots", response_model=list[SnapshotRead])
def list_snapshots_endpoint(project_id: str, db: DbSession) -> list[SnapshotRead]:
    try:
        return list_snapshots(db, project_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{project_id}/snapshots/latest", response_model=SnapshotRead)
def latest_snapshot_endpoint(project_id: str, db: DbSession) -> SnapshotRead:
    try:
        return latest_snapshot(db, project_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{project_id}/overview-table", response_model=ProjectOverviewTableResponse)
def project_overview_table_endpoint(project_id: str, db: DbSession) -> ProjectOverviewTableResponse:
    try:
        return project_overview_table(db, project_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{project_id}/tasks/{task_index}/critical", response_model=ProjectOverviewTableResponse)
def update_task_critical_path_endpoint(
    project_id: str,
    task_index: int,
    payload: CriticalPathUpdate,
    db: DbSession,
) -> ProjectOverviewTableResponse:
    try:
        return update_task_critical_path(db, project_id, task_index, payload)
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{project_id}/score-breakdown", response_model=ScoreBreakdownResponse)
def score_breakdown_endpoint(project_id: str, db: DbSession) -> ScoreBreakdownResponse:
    try:
        return score_breakdown(db, project_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{project_id}/simulate", response_model=ScenarioSimulationResponse)
def simulate_project_endpoint(
    project_id: str,
    payload: ScenarioSimulationRequest,
    db: DbSession,
) -> ScenarioSimulationResponse:
    try:
        return simulate_project_scenario(db, project_id, payload)
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{project_id}/export", response_class=PlainTextResponse)
def export_project_endpoint(project_id: str, db: DbSession) -> PlainTextResponse:
    try:
        report = export_project_report(db, project_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return PlainTextResponse(
        report,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{project_id}_weekly_status_report.md"'},
    )


@router.get("/{project_id}/export/pdf")
def export_project_pdf_endpoint(project_id: str, db: DbSession) -> FileResponse:
    try:
        path = export_project_report_pdf(db, project_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return FileResponse(path, media_type="application/pdf", filename=f"{project_id}_weekly_status_report.pdf")
