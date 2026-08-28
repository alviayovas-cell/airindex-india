"""Indian holiday / festival airfare analysis (spec §Part 15). No ML deps."""

import pytest
import pytest_asyncio

from app.services.collection_service import seed_history
from app.services.festival_service import analyze_festivals
from app.services.reference_data import seed_reference_data


@pytest_asyncio.fixture
async def seeded_db(mock_db):
    await seed_reference_data(mock_db)
    await seed_history(mock_db, days=20, seed=11)
    return mock_db


@pytest.fixture
def api(auth_client, seeded_db):
    return auth_client


def _data(resp):
    body = resp.json()
    assert body["success"] is True, body
    return body["data"]


@pytest.mark.asyncio
async def test_festival_analysis(seeded_db):
    result = await analyze_festivals(seeded_db)
    assert result["available"] is True
    assert result["normal_avg_fare"] > 0
    names = {e["name"] for e in result["events"]}
    assert "Independence Day" in names
    in_range = [e for e in result["events"] if e["in_data_range"]]
    assert in_range and all(e["event_observations"] >= 0 for e in in_range)
    far = next(e for e in result["events"] if e["name"] == "New Year")
    assert far["in_data_range"] is False and far["observed_change_pct"] is None
    assert "not evidence that the event caused" in result["disclaimer"]


def test_festivals_endpoint_and_filter(api):
    d = _data(api.get("/api/analytics/festivals"))
    assert d["available"] is True and len(d["events"]) >= 5

    one = _data(api.get("/api/analytics/festivals?event=Independence Day&route_id=DEL-BOM"))
    assert len(one["events"]) == 1
    assert one["filters"]["route_id"] == "DEL-BOM"


def test_festivals_require_auth(client):
    assert client.get("/api/analytics/festivals").status_code == 401
