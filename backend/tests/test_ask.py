from fastapi.testclient import TestClient

from app.agent.portfolio_ask import answer_portfolio_question
from app.db.session import SessionLocal
from app.demo_seed import seed_demo_data
from app.llm.client import LLMResponse
from app.main import app


client = TestClient(app)


class FakeLLMClient:
    provider = "fake"

    def generate(self, *_args, **_kwargs) -> LLMResponse:
        return LLMResponse(provider="fake", content={"answer": "Fake portfolio answer."})


def test_answer_portfolio_question_with_fake_llm() -> None:
    with SessionLocal() as db:
        seed_demo_data(db, reset_demo=True)
        result = answer_portfolio_question(db, "Which project is most at risk?", llm_client=FakeLLMClient())

    assert result.answer == "Fake portfolio answer."
    assert result.projects_considered >= 2
    assert result.reasoning_trace
    assert result.llm_provider_used == "fake"


def test_ask_endpoint_uses_monkeypatched_client(monkeypatch) -> None:
    monkeypatch.setattr("app.agent.portfolio_ask.build_llm_client", lambda: FakeLLMClient())
    client.post("/demo/seed")

    response = client.post("/ask", json={"question": "Which projects are trending worse?"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["answer"] == "Fake portfolio answer."
    assert payload["reasoning_trace"]
