"""Groq adapter for fallback narrative and reasoning generation."""

from __future__ import annotations

from typing import Any

import httpx

from app.llm.client import LLMError, LLMResponse
from app.llm.mistral_adapter import _parse_json_content


class GroqAdapter:
    provider = "groq"

    def __init__(self, api_key: str | None, model: str = "llama-3.3-70b-versatile"):
        self.api_key = api_key
        self.model = model

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        json_mode: bool = True,
        timeout_seconds: float = 20,
    ) -> LLMResponse:
        if not self.api_key:
            raise LLMError("API key is not configured.")

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            response = httpx.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json=payload,
                timeout=timeout_seconds,
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
        except Exception as exc:
            raise LLMError(str(exc)) from exc
        return LLMResponse(content=_parse_json_content(content), provider=self.provider)
