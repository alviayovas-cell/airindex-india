"""Test fixtures — an in-memory Mongo (mongomock-motor), no external services."""

from __future__ import annotations

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

import app.main as main_module
from app.core.security import hash_password
from app.database.connection import Database, get_database
from app.main import app


@pytest.fixture(autouse=True)
def _fast_db(monkeypatch):
    """Skip real MongoDB ping/index calls during tests."""

    async def _ping(cls=None) -> bool:  # noqa: ANN001
        return True

    async def _noop() -> None:
        return None

    monkeypatch.setattr(Database, "ping", classmethod(_ping))
    monkeypatch.setattr(main_module, "ensure_indexes", _noop)


@pytest_asyncio.fixture
async def mock_db():
    client = AsyncMongoMockClient()
    db = client["airfare_index_test"]
    await db.users.insert_one(
        {
            "email": "analyst@airindex.dev",
            "name": "Demo Analyst",
            "role": "analyst",
            "password_hash": hash_password("airindex123"),
        }
    )
    yield db


@pytest.fixture
def client(mock_db):
    app.dependency_overrides[get_database] = lambda: mock_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def auth_client(client):
    resp = client.post(
        "/api/auth/login",
        json={"email": "analyst@airindex.dev", "password": "airindex123"},
    )
    token = resp.json()["data"]["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client
