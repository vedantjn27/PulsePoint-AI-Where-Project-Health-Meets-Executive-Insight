from pathlib import Path

from fastapi.testclient import TestClient
from pptx import Presentation

from app.main import app


client = TestClient(app)


def test_monthly_synthesis_and_deck_generation() -> None:
    seed = client.post("/demo/seed")
    assert seed.status_code == 200

    response = client.get("/synthesis/monthly")
    assert response.status_code == 200
    synthesis = response.json()
    assert synthesis["total_projects"] >= 2
    assert "rag_distribution" in synthesis
    assert synthesis["recommendations"]

    deck_response = client.post("/synthesis/generate-deck")
    assert deck_response.status_code == 200
    deck = deck_response.json()
    path = Path(deck["path"])
    assert path.exists()
    prs = Presentation(path)
    assert len(prs.slides) == deck["slides"]
    assert deck["branding_applied"] is False

    branded_response = client.post(
        "/synthesis/generate-deck",
        json={
            "branding": {
                "use_default_branding": False,
                "client_name": "Executive Client",
                "primary_color": "#123456",
                "accent_color": "#AA5500",
            }
        },
    )
    assert branded_response.status_code == 200
    branded = branded_response.json()
    assert branded["branding_applied"] is True
    assert "executive_client" in branded["filename"]
    assert Path(branded["path"]).exists()

    history_response = client.get("/synthesis/history")
    assert history_response.status_code == 200
    assert any(item["filename"] == deck["filename"] for item in history_response.json())
