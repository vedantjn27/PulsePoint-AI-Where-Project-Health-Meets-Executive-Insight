from fastapi.testclient import TestClient

from app.db.session import Base, check_database_connection, init_db
from app.main import app


def test_health_endpoint_reports_database_available() -> None:
    init_db()
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["database"] is True
    assert payload["service"] == "PulsePoint AI"


def test_phase_one_tables_are_registered() -> None:
    expected_tables = {
        "projects",
        "project_snapshots",
        "score_results",
        "narratives",
        "milestones",
        "risks_blockers",
        "alerts",
        "scoring_config",
        "scoring_config_versions",
        "audit_logs",
    }

    assert expected_tables.issubset(Base.metadata.tables.keys())


def test_database_connection_check_returns_true() -> None:
    init_db()

    assert check_database_connection() is True


def test_cors_allows_browser_origins() -> None:
    client = TestClient(app)

    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "*"


def test_scoring_config_endpoint_is_available() -> None:
    client = TestClient(app)

    response = client.get("/scoring-config")

    assert response.status_code == 200
    payload = response.json()
    assert "weights" in payload
    assert "rag_thresholds" in payload


def test_invalid_scoring_config_update_is_rejected() -> None:
    client = TestClient(app)

    response = client.put("/scoring-config", json={"weights": {"schedule": 1}})

    assert response.status_code == 400


def test_scoring_config_history_endpoint_is_available() -> None:
    client = TestClient(app)

    response = client.get("/scoring-config/history")

    assert response.status_code == 200
    history = response.json()
    assert history
    assert "config" in history[0]
    assert "version" in history[0]
