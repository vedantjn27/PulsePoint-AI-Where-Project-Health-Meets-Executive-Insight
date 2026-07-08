"""Application settings loaded from environment and local .env files."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import os
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = ROOT_DIR / ".env"


def _load_env_file(path: Path = ENV_FILE) -> None:
    """Load simple KEY=VALUE pairs without overriding real environment vars."""
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


@dataclass(frozen=True)
class Settings:
    app_name: str = "PulsePoint AI"
    app_version: str = "0.1.0"
    api_prefix: str = ""
    database_url: str = "sqlite:///./pulsepoint.db"
    llm_provider: str = "mistral"
    scheduler_cron: str = "0 8 * * MON"
    mistral_api_key: str | None = None
    groq_api_key: str | None = None
    gemini_api_key: str | None = None

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    _load_env_file()
    return Settings(
        database_url=os.getenv("DATABASE_URL", Settings.database_url),
        llm_provider=os.getenv("LLM_PROVIDER", Settings.llm_provider),
        scheduler_cron=os.getenv("SCHEDULER_CRON", Settings.scheduler_cron),
        mistral_api_key=os.getenv("MISTRAL_API_KEY") or None,
        groq_api_key=os.getenv("GROQ_API_KEY") or None,
        gemini_api_key=os.getenv("GEMINI_API_KEY") or None,
    )
