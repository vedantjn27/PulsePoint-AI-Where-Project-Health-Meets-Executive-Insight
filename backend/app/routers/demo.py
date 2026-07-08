"""Demo data endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.demo_seed import seed_demo_data as seed_demo_data_service
from app.db.session import get_db
from app.schemas.operations import DemoSeedResult


router = APIRouter(prefix="/demo", tags=["Demo"])
DbSession = Annotated[Session, Depends(get_db)]


@router.post("/seed", response_model=DemoSeedResult)
def seed_demo_data(db: DbSession) -> DemoSeedResult:
    return seed_demo_data_service(db, reset_demo=True)
