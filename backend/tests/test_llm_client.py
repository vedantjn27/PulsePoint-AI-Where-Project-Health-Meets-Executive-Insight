from app.llm.client import FallbackLLMClient, LLMError, LLMResponse


class BrokenClient:
    provider = "broken"

    def generate(self, *_args, **_kwargs) -> LLMResponse:
        raise LLMError("not available")


class WorkingClient:
    provider = "working"

    def generate(self, *_args, **_kwargs) -> LLMResponse:
        return LLMResponse(provider=self.provider, content={"narrative": "ok"})


def test_fallback_client_uses_next_available_provider() -> None:
    client = FallbackLLMClient([BrokenClient(), WorkingClient()])

    response = client.generate("system", "user")

    assert response.provider == "working"
    assert response.content == {"narrative": "ok"}


def test_fallback_client_raises_when_all_providers_fail() -> None:
    client = FallbackLLMClient([BrokenClient()])

    try:
        client.generate("system", "user")
    except LLMError as exc:
        assert "broken" in str(exc)
    else:
        raise AssertionError("Expected LLMError")
