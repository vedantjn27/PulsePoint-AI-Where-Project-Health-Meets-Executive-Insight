"""Portfolio-wide ask agent."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.prompts import AGENT_SYSTEM_PROMPT
from app.agent.tools import execute_tool
from app.db import models
from app.demo_seed import seed_demo_if_empty
from app.llm.client import LLMClient, LLMError, build_llm_client
from app.schemas.operations import AskResponse


def answer_portfolio_question(
    db: Session,
    question: str,
    *,
    llm_client: LLMClient | None = None,
) -> AskResponse:
    seed_demo_if_empty(db)
    projects = db.scalars(select(models.Project).order_by(models.Project.name)).all()
    trace = []
    latest = []
    for project in projects:
        history_result = execute_tool(db, "get_project_history", {"project_id": project.id, "weeks": 4})
        trace.append(
            {
                "tool": "get_project_history",
                "args": {"project_id": project.id, "weeks": 4},
                "why": "Compare recent portfolio health for the user's question.",
                "result": history_result,
            }
        )
        if history_result["history"]:
            latest.append({"project_id": project.id, "project_name": project.name, **history_result["history"][0]})

    weak_profile = _profile_from_question(question)
    similar_result = execute_tool(db, "get_similar_past_projects", {"signal_profile": weak_profile, "limit": 5})
    trace.append(
        {
            "tool": "get_similar_past_projects",
            "args": {"signal_profile": weak_profile, "limit": 5},
            "why": "Find snapshots matching the question's likely risk profile.",
            "result": similar_result,
        }
    )

    fallback_answer = _fallback_answer(question, latest)
    client = llm_client if llm_client is not None else build_llm_client()
    try:
        response = client.generate(
            AGENT_SYSTEM_PROMPT,
            json.dumps({"question": question, "latest_projects": latest, "reasoning_trace": trace}, default=str),
            json_mode=True,
            timeout_seconds=20,
        )
        answer = str(response.content.get("answer") or response.content.get("narrative") or fallback_answer)
        provider = response.provider
    except LLMError:
        answer = fallback_answer
        provider = "deterministic-template"

    return AskResponse(
        answer=answer,
        reasoning_trace=trace,
        projects_considered=len(projects),
        llm_provider_used=provider,
    )


def _profile_from_question(question: str) -> str:
    lowered = question.lower()
    if "budget" in lowered or "spend" in lowered:
        return "budget"
    if "schedule" in lowered or "late" in lowered or "delay" in lowered:
        return "schedule"
    if "blocker" in lowered or "risk" in lowered:
        return "blocker"
    if "red" in lowered:
        return "red"
    return "general"


def _fallback_answer(question: str, latest: list[dict[str, Any]]) -> str:
    if not latest:
        return "No scored projects are available yet."
    sorted_projects = sorted(latest, key=lambda item: item.get("composite_score") or 101)
    worst = sorted_projects[0]
    red_count = sum(1 for item in latest if item.get("rag_status") == "Red")
    amber_count = sum(1 for item in latest if item.get("rag_status") == "Amber")
    return (
        f"Based on the latest scored snapshots, {red_count} project(s) are Red and "
        f"{amber_count} project(s) are Amber. The weakest current project is "
        f"{worst['project_name']} at {worst.get('composite_score')} with status "
        f"{worst.get('rag_status')}. Question considered: {question}"
    )
