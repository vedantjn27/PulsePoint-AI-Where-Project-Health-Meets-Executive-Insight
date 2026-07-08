from datetime import date

from app.agent.reasoning_loop import run_reasoning_loop
from app.db import models
from app.db.session import SessionLocal, init_db
from app.llm.client import LLMError, LLMResponse
from app.scoring.schemas import ScoreResult, SignalBreakdown


class FakeLLMClient:
    provider = "fake"

    def generate(self, *_args, **_kwargs) -> LLMResponse:
        return LLMResponse(
            provider="fake",
            content={
                "narrative": "The project is stable and the explanation came from a fake LLM.",
                "top_risks": ["Budget remains watchlisted."],
                "recommended_actions": ["Review budget next week."],
            },
        )


class FailingLLMClient:
    provider = "failing"

    def generate(self, *_args, **_kwargs) -> LLMResponse:
        raise LLMError("boom")


def _score_result(status: str = "Amber") -> ScoreResult:
    breakdown = {
        signal: SignalBreakdown(
            score=score,
            available=True,
            weight=0.2,
            adjusted_weight=0.2,
            reason=f"{signal} reason",
        )
        for signal, score in {
            "schedule": 70,
            "budget": 55,
            "milestones": 80,
            "blockers": 65,
            "sentiment": 60,
        }.items()
    }
    return ScoreResult(
        rag_status=status,
        composite_score=66.0,
        data_confidence=0.84,
        sub_scores={
            "schedule": 70,
            "budget": 55,
            "milestones": 80,
            "blockers": 65,
            "sentiment": 60,
        },
        scope_penalty=0,
        top_risks=["Budget signal is weak."],
        recommended_actions=["Reforecast budget."],
        override_reasons=[],
        breakdown=breakdown,
    )


def _seed_project(project_id: str) -> None:
    init_db()
    with SessionLocal() as db:
        if db.get(models.Project, project_id):
            return
        db.add(models.Project(id=project_id, name="Agent Test Project"))
        db.commit()


def test_reasoning_loop_uses_fake_llm_and_records_tool_trace() -> None:
    project_id = "agent_fake"
    _seed_project(project_id)
    with SessionLocal() as db:
        result = run_reasoning_loop(
            db,
            project_id=project_id,
            project_name="Agent Test Project",
            scoring=_score_result(),
            parse_warnings=[],
            llm_client=FakeLLMClient(),
        )

    assert result.llm_provider_used == "fake"
    assert result.narrative.startswith("The project is stable")
    assert result.top_risks == ["Budget remains watchlisted."]
    assert result.reasoning_trace
    assert result.reasoning_trace[0]["tool"] == "get_project_history"


def test_reasoning_loop_falls_back_when_llm_fails() -> None:
    project_id = "agent_fallback"
    _seed_project(project_id)
    with SessionLocal() as db:
        result = run_reasoning_loop(
            db,
            project_id=project_id,
            project_name="Fallback Project",
            scoring=_score_result("Red"),
            parse_warnings=[],
            llm_client=FailingLLMClient(),
        )

    assert result.llm_provider_used == "deterministic-template"
    assert "Red" in result.narrative
    assert result.recommended_actions == ["Reforecast budget."]
