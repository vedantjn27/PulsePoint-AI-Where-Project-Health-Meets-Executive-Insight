from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)
SAMPLE_DIR = Path("sample_data")


def _project_payload() -> dict[str, str]:
    token = uuid4().hex[:8]
    return {
        "id": f"api_{token}",
        "name": f"API Test Project {token}",
        "client_name": "API Client",
        "pm_name": "API PM",
    }


class FakeLLMClient:
    provider = "fake"

    def generate(self, *_args, **_kwargs):
        from app.llm.client import LLMResponse

        return LLMResponse(
            provider="fake",
            content={
                "narrative": "Fake provider narrative grounded in deterministic score.",
                "top_risks": ["Fake risk summary"],
                "recommended_actions": ["Fake recommended action"],
            },
        )


def test_project_crud_upload_analyze_and_breakdown_flow(monkeypatch) -> None:
    monkeypatch.setattr("app.agent.pipeline.build_llm_client", lambda: FakeLLMClient())
    payload = _project_payload()

    create_response = client.post("/projects", json=payload)
    assert create_response.status_code == 201
    project = create_response.json()
    assert project["id"] == payload["id"]
    assert project["latest_health"] is None

    list_response = client.get("/projects")
    assert list_response.status_code == 200
    assert any(item["id"] == payload["id"] for item in list_response.json())

    sample_bytes = (SAMPLE_DIR / "on_track_project.json").read_bytes()
    upload_response = client.post(
        f"/projects/{payload['id']}/upload",
        files={"file": ("on_track_project.json", sample_bytes, "application/json")},
    )
    assert upload_response.status_code == 200
    upload_payload = upload_response.json()
    assert upload_payload["normalized_counts"]["tasks"] == 2
    assert upload_payload["data_confidence"] > 0

    analyze_response = client.post(
        f"/projects/{payload['id']}/analyze",
        files={"file": ("on_track_project.json", sample_bytes, "application/json")},
    )
    assert analyze_response.status_code == 200
    analysis = analyze_response.json()
    assert analysis["project_id"] == payload["id"]
    assert analysis["rag_status"] == "Green"
    assert analysis["composite_score"] >= 75
    assert analysis["narrative"] == "Fake provider narrative grounded in deterministic score."
    assert analysis["reasoning_trace"]

    latest_response = client.get(f"/projects/{payload['id']}/snapshots/latest")
    assert latest_response.status_code == 200
    latest = latest_response.json()
    assert latest["score"]["rag_status"] == "Green"

    breakdown_response = client.get(f"/projects/{payload['id']}/score-breakdown")
    assert breakdown_response.status_code == 200
    breakdown = breakdown_response.json()
    assert breakdown["project_id"] == payload["id"]
    assert "schedule" in breakdown["breakdown"]
    assert breakdown["breakdown"]["budget"]["available"] is True

    export_response = client.get(f"/projects/{payload['id']}/export")
    assert export_response.status_code == 200
    assert "# Acme Fixed-Bid Implementation Weekly Status Report" in export_response.text
    assert "RAG status: Green" in export_response.text

    delete_response = client.delete(f"/projects/{payload['id']}")
    assert delete_response.status_code == 204


def test_analyze_missing_project_returns_404() -> None:
    sample_bytes = (SAMPLE_DIR / "on_track_project.json").read_bytes()

    response = client.post(
        "/projects/not_real/analyze",
        files={"file": ("on_track_project.json", sample_bytes, "application/json")},
    )

    assert response.status_code == 404
