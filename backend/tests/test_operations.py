from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from app.llm.client import LLMResponse
from app.main import app
from app.db import models
from app.db.session import Base, SessionLocal
from app.demo_seed import seed_demo_if_empty
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


client = TestClient(app)
SAMPLE_DIR = Path("sample_data")


class FakeLLMClient:
    provider = "fake"

    def generate(self, *_args, **_kwargs) -> LLMResponse:
        return LLMResponse(
            provider="fake",
            content={
                "narrative": "Operational test narrative.",
                "top_risks": ["Operational test risk"],
                "recommended_actions": ["Operational test action"],
            },
        )


def _create_project() -> str:
    project_id = f"ops_{uuid4().hex[:8]}"
    response = client.post("/projects", json={"id": project_id, "name": "Ops Test Project"})
    assert response.status_code == 201
    return project_id


def test_dashboard_alert_acknowledge_and_scheduler_flow(monkeypatch) -> None:
    monkeypatch.setattr("app.agent.pipeline.build_llm_client", lambda: FakeLLMClient())
    project_id = _create_project()
    sample_bytes = (SAMPLE_DIR / "messy_project.csv").read_bytes()

    analyze_response = client.post(
        f"/projects/{project_id}/analyze",
        files={"file": ("messy_project.csv", sample_bytes, "text/csv")},
    )
    assert analyze_response.status_code == 200
    assert analyze_response.json()["rag_status"] == "Red"

    dashboard_response = client.get("/dashboard/summary")
    assert dashboard_response.status_code == 200
    dashboard = dashboard_response.json()
    assert dashboard["total_projects"] >= 1
    assert dashboard["rag_counts"]["Red"] >= 1

    alerts_response = client.get("/alerts")
    assert alerts_response.status_code == 200
    alerts = alerts_response.json()
    assert alerts

    alert_id = alerts[0]["id"]
    ack_response = client.post(f"/alerts/{alert_id}/acknowledge")
    assert ack_response.status_code == 200
    assert ack_response.json()["acknowledged"] is True

    scheduler_status = client.get("/scheduler/status")
    assert scheduler_status.status_code == 200
    assert "cron" in scheduler_status.json()

    run_response = client.post("/scheduler/run-all-now")
    assert run_response.status_code == 200
    assert "attempted" in run_response.json()


def test_demo_seed_creates_projects_and_history() -> None:
    response = client.post("/demo/seed")

    assert response.status_code == 200
    payload = response.json()
    assert payload["projects_created"] >= 5
    assert payload["snapshots_created"] >= 20

    dashboard = client.get("/dashboard/summary").json()
    assert dashboard["total_projects"] >= 5
    assert dashboard["rag_counts"]["Green"] >= 1
    assert dashboard["rag_counts"]["Amber"] >= 1
    assert dashboard["rag_counts"]["Red"] >= 1


def test_seed_demo_if_empty_is_noop_when_projects_exist() -> None:
    with SessionLocal() as db:
        db.add(models.Project(id=f"manual_{uuid4().hex[:8]}", name="Manual Project"))
        db.commit()
        result = seed_demo_if_empty(db)

    assert result is None


def test_seed_demo_if_empty_loads_empty_database(tmp_path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'empty.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    LocalSession = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)

    with LocalSession() as db:
        result = seed_demo_if_empty(db)
        count = db.query(models.Project).count()

    assert result is not None
    assert result.projects_created >= 5
    assert count >= 5
