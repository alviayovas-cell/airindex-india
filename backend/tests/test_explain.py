"""Index Calculation Explorer + "Why did AIRINDEX change?" (spec §Part 6 & §Part 11)."""

import pytest
import pytest_asyncio

from app.services.collection_service import seed_history
from app.services.reference_data import seed_reference_data


@pytest_asyncio.fixture
async def seeded_db(mock_db):
    await seed_reference_data(mock_db)
    await seed_history(mock_db, days=12, seed=101)
    return mock_db


@pytest.fixture
def api(auth_client, seeded_db):
    return auth_client


def _data(resp):
    body = resp.json()
    assert body["success"] is True, body
    return body["data"]


def test_calculation_rows_sum_to_index_value(api):
    d = _data(api.get("/api/index/calculation"))
    assert d["rows"]
    total = sum(r["contribution"] for r in d["rows"])
    assert total == pytest.approx(d["index_value"], abs=0.1)
    # every contribution = effective_weight * route_index
    for r in d["rows"]:
        assert r["contribution"] == pytest.approx(
            r["effective_weight"] * r["route_index"], abs=0.01
        )


def test_calculation_at_base_period_is_100(api):
    hist = _data(api.get("/api/index/history?frequency=daily"))
    first = hist["points"][0]["date"]
    d = _data(api.get(f"/api/index/calculation?date={first}"))
    assert d["index_value"] == pytest.approx(100.0, abs=0.01)
    for r in d["rows"]:
        assert r["route_index"] == pytest.approx(100.0, abs=0.01)


def test_explain_lists_sorted_contributors_and_largest_mover(api):
    d = _data(api.get("/api/index/explain"))
    assert d["available"] is True
    assert d["date"] > d["compare_date"]
    contribs = d["observed_contributors"]
    assert len(contribs) >= 1
    deltas = [abs(c["contribution_delta"]) for c in contribs]
    assert deltas == sorted(deltas, reverse=True)

    mover = d["largest_observed_movement"]
    assert mover is not None
    by_route = {c["route_id"]: c for c in contribs}
    biggest = max(by_route.values(), key=lambda c: abs(c["route_index_change"]))
    assert mover["route_id"] == biggest["route_id"]
    assert "not a causal explanation" in d["disclaimer"]


def test_explain_specific_pair(api):
    hist = _data(api.get("/api/index/history?frequency=daily"))
    dates = [p["date"] for p in hist["points"]]
    d = _data(
        api.get(f"/api/index/explain?date={dates[5]}&compare={dates[2]}")
    )
    assert d["date"] == dates[5]
    assert d["compare_date"] == dates[2]
    assert d["index_change"] == pytest.approx(
        d["index_now"] - d["index_prev"], abs=0.01
    )


def test_explain_requires_auth(client):
    assert client.get("/api/index/explain").status_code == 401
    assert client.get("/api/index/calculation").status_code == 401
