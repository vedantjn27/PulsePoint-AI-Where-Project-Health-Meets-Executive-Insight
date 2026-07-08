import pytest

from app.db import models
from app.db.session import SessionLocal, init_db


TEST_PREFIXES = ("api_", "ops_", "manual_", "agent_", "demo_", "pdf_")


@pytest.fixture(autouse=True)
def clean_test_projects():
    init_db()
    _delete_prefixed_projects()
    yield
    _delete_prefixed_projects()


def _delete_prefixed_projects() -> None:
    with SessionLocal() as db:
        projects = db.query(models.Project).all()
        for project in projects:
            if project.id.startswith(TEST_PREFIXES):
                db.delete(project)
        db.commit()
