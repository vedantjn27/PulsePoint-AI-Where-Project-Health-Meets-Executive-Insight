"""FastAPI application entrypoint."""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.db.session import check_database_connection, init_db
from app.routers.alerts import router as alerts_router
from app.routers.ask import router as ask_router
from app.routers.audit import router as audit_router
from app.routers.dashboard import router as dashboard_router
from app.routers.demo import router as demo_router
from app.routers.explainability import router as explainability_router
from app.routers.projects import router as projects_router
from app.routers.scheduler import router as scheduler_router
from app.routers.synthesis import router as synthesis_router
from app.scheduler.weekly_job import shutdown_scheduler, start_scheduler


settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    init_db()
    start_scheduler()
    try:
        yield
    finally:
        shutdown_scheduler()


app = FastAPI(
    title=settings.app_name,
    description="Backend API for project health scoring and agentic reporting.",
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects_router)
app.include_router(alerts_router)
app.include_router(ask_router)
app.include_router(audit_router)
app.include_router(dashboard_router)
app.include_router(demo_router)
app.include_router(explainability_router)
app.include_router(scheduler_router)
app.include_router(synthesis_router)


@app.get("/health", tags=["Utility"])
def health_check() -> dict[str, str | bool]:
    """Return a lightweight liveness response."""
    database_ok = check_database_connection()
    return {
        "status": "ok" if database_ok else "degraded",
        "database": database_ok,
        "service": settings.app_name,
        "version": settings.app_version,
    }
