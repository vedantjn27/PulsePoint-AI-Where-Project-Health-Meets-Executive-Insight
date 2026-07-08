"""Portfolio-wide natural-language agent endpoint."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agent.portfolio_ask import answer_portfolio_question
from app.db.session import get_db
from app.schemas.operations import AskRequest, AskResponse


router = APIRouter(tags=["Ask"])
DbSession = Annotated[Session, Depends(get_db)]


@router.post("/ask", response_model=AskResponse)
def ask_portfolio(payload: AskRequest, db: DbSession) -> AskResponse:
    return answer_portfolio_question(db, payload.question)
