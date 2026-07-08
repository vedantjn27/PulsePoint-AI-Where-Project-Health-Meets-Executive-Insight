from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from app.llm.client import LLMResponse
from app.main import app


client = TestClient(app)
SAMPLE_DIR = Path("sample_data")


class FakeLLMClient:
    provider = "fake"

    def generate(self, *_args, **_kwargs) -> LLMResponse:
        return LLMResponse(
            provider="fake",
            content={
                "narrative": "PDF and scenario test narrative.",
                "top_risks": ["PDF test risk"],
                "recommended_actions": ["PDF test action"],
            },
        )


def _analyzed_project(monkeypatch) -> str:
    monkeypatch.setattr("app.agent.pipeline.build_llm_client", lambda: FakeLLMClient())
    project_id = f"pdf_{uuid4().hex[:8]}"
    response = client.post("/projects", json={"id": project_id, "name": "PDF Test Project"})
    assert response.status_code == 201
    sample_bytes = (SAMPLE_DIR / "on_track_project.json").read_bytes()
    analyze = client.post(
        f"/projects/{project_id}/analyze",
        files={"file": ("on_track_project.json", sample_bytes, "application/json")},
    )
    assert analyze.status_code == 200
    return project_id


def test_weekly_pdf_export_scenario_and_audit_log(monkeypatch) -> None:
    project_id = _analyzed_project(monkeypatch)

    pdf_response = client.get(f"/projects/{project_id}/export/pdf")
    assert pdf_response.status_code == 200
    assert pdf_response.headers["content-type"] == "application/pdf"
    assert len(pdf_response.content) > 1000

    scenario = client.post(f"/projects/{project_id}/simulate", json={"signal": "budget", "delta": -20})
    assert scenario.status_code == 200
    payload = scenario.json()
    assert payload["project_id"] == project_id
    assert payload["signal"] == "budget"
    assert payload["simulated_composite_score"] <= payload["current_composite_score"]

    audit = client.get("/audit-log")
    assert audit.status_code == 200
    event_types = {entry["event_type"] for entry in audit.json()}
    assert {"project_created", "project_analyzed", "weekly_pdf_exported"}.issubset(event_types)


def test_invalid_scenario_signal_returns_400(monkeypatch) -> None:
    project_id = _analyzed_project(monkeypatch)

    response = client.post(f"/projects/{project_id}/simulate", json={"signal": "velocity", "delta": 10})

    assert response.status_code == 400
