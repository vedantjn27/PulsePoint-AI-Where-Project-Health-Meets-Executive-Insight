"""Common LLM client interface and provider selection."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from app.core.config import get_settings


class LLMError(RuntimeError):
    """Raised when an LLM provider cannot return a usable response."""


@dataclass(frozen=True)
class LLMResponse:
    content: dict[str, Any]
    provider: str


class LLMClient(Protocol):
    provider: str

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        json_mode: bool = True,
        timeout_seconds: float = 20,
    ) -> LLMResponse:
        ...


class FallbackLLMClient:
    """Try configured providers in order and return the first successful result."""

    def __init__(self, clients: list[LLMClient]):
        self.clients = clients
        self.provider = "fallback"

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        json_mode: bool = True,
        timeout_seconds: float = 20,
    ) -> LLMResponse:
        errors: list[str] = []
        for client in self.clients:
            try:
                return client.generate(
                    system_prompt,
                    user_prompt,
                    json_mode=json_mode,
                    timeout_seconds=timeout_seconds,
                )
            except LLMError as exc:
                errors.append(f"{client.provider}: {exc}")
        raise LLMError("; ".join(errors) or "No LLM providers configured.")


def build_llm_client() -> FallbackLLMClient:
    from app.llm.gemini_adapter import GeminiAdapter
    from app.llm.groq_adapter import GroqAdapter
    from app.llm.mistral_adapter import MistralAdapter

    settings = get_settings()
    provider_order = _provider_order(settings.llm_provider)
    adapters = {
        "mistral": MistralAdapter(settings.mistral_api_key),
        "groq": GroqAdapter(settings.groq_api_key),
        "gemini": GeminiAdapter(settings.gemini_api_key),
    }
    return FallbackLLMClient([adapters[name] for name in provider_order])


def _provider_order(primary: str) -> list[str]:
    normalized = primary.lower().strip()
    fallback = ["mistral", "groq", "gemini"]
    if normalized in fallback:
        return [normalized] + [name for name in fallback if name != normalized]
    return fallback
