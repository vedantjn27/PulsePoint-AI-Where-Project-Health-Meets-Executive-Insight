"""Gemini adapter for optional secondary fallback generation."""

from __future__ import annotations

import httpx

from app.llm.client import LLMError, LLMResponse
from app.llm.mistral_adapter import _parse_json_content


class GeminiAdapter:
    provider = "gemini"

    def __init__(self, api_key: str | None, model: str = "gemini-1.5-pro"):
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

        prompt = f"{system_prompt}\n\nReturn JSON only.\n\n{user_prompt}" if json_mode else f"{system_prompt}\n\n{user_prompt}"
        payload = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.2}}
        try:
            response = httpx.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent",
                params={"key": self.api_key},
                json=payload,
                timeout=timeout_seconds,
            )
            response.raise_for_status()
            content = response.json()["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as exc:
            raise LLMError(str(exc)) from exc
        return LLMResponse(content=_parse_json_content(content), provider=self.provider)
