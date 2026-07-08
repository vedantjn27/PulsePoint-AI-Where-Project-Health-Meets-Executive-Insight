"""Bounded tool-calling reasoning loop for evidence-backed narratives."""

from __future__ import annotations

from dataclasses import dataclass
import json
from typing import Any

from sqlalchemy.orm import Session

from app.agent.prompts import AGENT_SYSTEM_PROMPT
from app.agent.tools import ToolCallRecord, default_tool_plan, execute_tool
from app.llm.client import LLMClient, LLMError
from app.scoring.schemas import ScoreResult


@dataclass(frozen=True)
class AgentNarrativeResult:
    narrative: str
    top_risks: list[str]
    recommended_actions: list[str]
    reasoning_trace: list[dict[str, Any]]
    llm_provider_used: str


def run_reasoning_loop(
    db: Session,
    *,
    project_id: str,
    project_name: str,
    scoring: ScoreResult,
    parse_warnings: list[str],
    llm_client: LLMClient | None,
    max_tool_calls: int = 4,
) -> AgentNarrativeResult:
    trace_records: list[ToolCallRecord] = []
    for call in default_tool_plan(project_id, scoring.top_risks, scoring.rag_status)[:max_tool_calls]:
        result = execute_tool(db, call["tool"], call["args"])
        trace_records.append(
            ToolCallRecord(
                tool=call["tool"],
                args=call["args"],
                why=call["why"],
                result=result,
            )
        )

    reasoning_trace = [_trace_to_dict(record) for record in trace_records]
    fallback = _fallback_result(project_name, scoring, reasoning_trace)
    if llm_client is None:
        return fallback

    try:
        response = llm_client.generate(
            AGENT_SYSTEM_PROMPT,
            _user_prompt(project_id, project_name, scoring, parse_warnings, reasoning_trace),
            json_mode=True,
            timeout_seconds=20,
        )
        content = response.content
        return AgentNarrativeResult(
            narrative=str(content.get("narrative") or fallback.narrative),
            top_risks=_string_list(content.get("top_risks")) or fallback.top_risks,
            recommended_actions=_string_list(content.get("recommended_actions")) or fallback.recommended_actions,
            reasoning_trace=reasoning_trace,
            llm_provider_used=response.provider,
        )
    except LLMError:
        return fallback


def _fallback_result(project_name: str, scoring: ScoreResult, reasoning_trace: list[dict[str, Any]]) -> AgentNarrativeResult:
    if scoring.rag_status == "Green":
        narrative = f"{project_name} is Green. The deterministic scoring model shows the project is currently on track, with no material intervention required based on the available signals."
    elif scoring.rag_status == "Amber":
        narrative = f"{project_name} is Amber. One or more delivery signals require management attention this week, but the current evidence does not yet indicate a forced Red escalation."
    else:
        narrative = f"{project_name} is Red. The deterministic scoring model or override rules indicate active intervention is required."
    return AgentNarrativeResult(
        narrative=narrative,
        top_risks=scoring.top_risks,
        recommended_actions=scoring.recommended_actions,
        reasoning_trace=reasoning_trace,
        llm_provider_used="deterministic-template",
    )


def _user_prompt(
    project_id: str,
    project_name: str,
    scoring: ScoreResult,
    parse_warnings: list[str],
    reasoning_trace: list[dict[str, Any]],
) -> str:
    payload = {
        "project_id": project_id,
        "project_name": project_name,
        "rag_status": scoring.rag_status,
        "composite_score": scoring.composite_score,
        "data_confidence": scoring.data_confidence,
        "sub_scores": scoring.sub_scores,
        "scope_penalty": scoring.scope_penalty,
        "top_risks": scoring.top_risks,
        "recommended_actions": scoring.recommended_actions,
        "override_reasons": scoring.override_reasons,
        "parse_warnings": parse_warnings,
        "reasoning_trace": reasoning_trace,
    }
    return json.dumps(payload, default=str)


def _trace_to_dict(record: ToolCallRecord) -> dict[str, Any]:
    return {
        "tool": record.tool,
        "args": record.args,
        "why": record.why,
        "result": record.result,
    }


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item).strip()]
