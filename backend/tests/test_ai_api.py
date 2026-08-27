"""AIRINDEX AI assistant (spec §Part 13)."""

import json

import pytest
import pytest_asyncio

from app.services import ai_service
from app.services.ai_service import build_context, fallback_answer
from app.services.collection_service import seed_history
from app.services.reference_data import seed_reference_data


@pytest_asyncio.fixture
async def seeded_db(mock_db):
    await seed_reference_data(mock_db)
    await seed_history(mock_db, days=12, seed=3)
    return mock_db


@pytest.fixture
def api(auth_client, seeded_db):
    return auth_client


def _data(resp):
    body = resp.json()
    assert body["success"] is True, body
    return body["data"]


@pytest.mark.asyncio
async def test_context_has_no_raw_quotes_or_secrets(seeded_db):
    ctx = await build_context(seeded_db)
    blob = json.dumps(ctx).lower()
    assert "routes" in ctx and len(ctx["routes"]) == 6
    assert "mongodb" not in blob
    assert "api_key" not in blob and "anthropic" not in blob
    assert "password" not in blob and "jwt" not in blob
    # no per-observation records
    assert "flight_number" not in blob and "collected_at" not in blob


@pytest.mark.asyncio
async def test_fallback_engine_answers_sample_questions(seeded_db):
    ctx = await build_context(seeded_db)

    a = fallback_answer("What is the current AIRINDEX?", ctx)
    assert "AIRINDEX is" in a

    a = fallback_answer("What is the most volatile route?", ctx)
    assert "volatile route is" in a and "experimental" in a

    a = fallback_answer("What happened to MAA-DEL?", ctx)
    assert "MAA" in a and "route index" in a

    a = fallback_answer("Which advance-purchase window has the highest average fare?", ctx)
    assert "T+1" in a

    a = fallback_answer("Compare DEL-BOM and DEL-BLR", ctx)
    assert "DEL → BOM" in a and "DEL → BLR" in a

    a = fallback_answer("Tell me about the Roman Empire", ctx)
    assert "don't have enough AIRINDEX data" in a


def test_ask_endpoint_rule_based(api):
    d = _data(api.post("/api/ai/ask", json={"question": "What is the current AIRINDEX?"}))
    assert d["engine"] == "rule-based"
    assert d["model"] is None
    assert "AIRINDEX is" in d["answer"]
    assert "index" in d["context_fields"]


def test_ask_endpoint_history_and_validation(api):
    d = _data(
        api.post(
            "/api/ai/ask",
            json={
                "question": "and DEL-BLR?",
                "history": [
                    {"role": "user", "content": "what about DEL-BOM"},
                    {"role": "assistant", "content": "DEL -> BOM index is ..."},
                ],
            },
        )
    )
    assert d["answer"]
    assert api.post("/api/ai/ask", json={"question": ""}).status_code == 422
    assert api.post("/api/ai/ask", json={"question": "x" * 600}).status_code == 422


def test_ai_status(api):
    d = _data(api.get("/api/ai/status"))
    assert d["enabled"] is False
    assert d["engine"] == "rule-based"


def test_ai_requires_auth(client):
    assert client.post("/api/ai/ask", json={"question": "hi"}).status_code == 401
    assert client.get("/api/ai/status").status_code == 401


@pytest.mark.asyncio
async def test_claude_path_uses_context_when_configured(seeded_db, monkeypatch):
    """When AI is configured, answer() calls the SDK with the grounding prompt."""
    captured = {}

    class _FakeMessages:
        async def create(self, **kwargs):
            captured.update(kwargs)

            class _Block:
                type = "text"
                text = "The current AIRINDEX is 103.4."

            class _Resp:
                content = [_Block()]

            return _Resp()

    class _FakeClient:
        def __init__(self, **_):
            self.messages = _FakeMessages()

        def with_options(self, **_):
            return self

    import anthropic

    monkeypatch.setattr(anthropic, "AsyncAnthropic", _FakeClient)
    monkeypatch.setattr(ai_service.settings, "ai_enabled", True)
    monkeypatch.setattr(ai_service.settings, "anthropic_api_key", "sk-test")

    ctx = await build_context(seeded_db)
    result = await ai_service.answer("What is the current index?", ctx)

    assert result["engine"] == "claude"
    assert result["answer"] == "The current AIRINDEX is 103.4."
    assert "AIRINDEX assistant" in captured["system"]
    assert "CONTEXT:" in captured["messages"][-1]["content"]
