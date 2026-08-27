"""API contract tests. Data is built by running the real pipeline into an
in-memory Mongo, so these also exercise seed -> clean -> index end to end."""

import pytest
import pytest_asyncio

from app.services.collection_service import seed_history
from app.services.reference_data import seed_reference_data


@pytest_asyncio.fixture
async def seeded_db(mock_db):
    await seed_reference_data(mock_db)
    await seed_history(mock_db, days=10, seed=99)
    return mock_db


@pytest.fixture
def api(auth_client, seeded_db):
    return auth_client


def _data(resp):
    body = resp.json()
    assert body["success"] is True, body
    return body["data"]


def test_overview(api):
    d = _data(api.get("/api/overview"))
    assert d["routes_tracked"] == 6
    assert d["airlines_covered"] == 5
    assert d["observations"] > 0
    assert d["index"]["index_value"] > 0
    assert d["is_synthetic"] is True


def test_index_current_and_history(api):
    cur = _data(api.get("/api/index/current"))
    assert cur["base_period"]
    assert cur["is_experimental"] is True
    assert len(cur["sparkline"]) >= 1

    hist = _data(api.get("/api/index/history?frequency=daily"))
    assert hist["frequency"] == "daily"
    assert len(hist["points"]) >= 1
    assert hist["points"][0]["date"] <= hist["points"][-1]["date"]

    weekly = _data(api.get("/api/index/weekly"))
    assert weekly["frequency"] == "weekly"


def test_routes_list_weights_sum_to_one(api):
    d = _data(api.get("/api/routes"))
    assert d["count"] == 6
    assert d["weights_sum"] == pytest.approx(1.0)
    assert all("sparkline" in r for r in d["routes"])


def test_route_detail_and_404(api):
    d = _data(api.get("/api/routes/DEL-BOM"))
    assert d["route"]["route_id"] == "DEL-BOM"
    assert "index_history" in d
    assert d["lead_time"]["windows"]
    assert api.get("/api/routes/ZZZ-ZZZ").status_code == 404


def test_lead_time_curve_decreases_with_advance(api):
    d = _data(api.get("/api/analytics/lead-time"))
    fares = [w["median_fare"] for w in d["windows"] if w["median_fare"]]
    assert fares == sorted(fares, reverse=True)  # earlier booking -> cheaper


def test_lead_time_filters(api):
    d = _data(api.get("/api/analytics/lead-time"))
    assert d["filter_options"]["airlines"]
    assert d["filter_options"]["fare_types"]

    airline = d["filter_options"]["airlines"][0]
    filtered = _data(api.get(f"/api/analytics/lead-time?route=DEL-BOM&airline={airline}"))
    assert filtered["filters"]["airline"] == airline
    total_all = sum(w["observation_count"] for w in d["windows"])
    total_one = sum(w["observation_count"] for w in filtered["windows"])
    assert 0 < total_one < total_all


def test_route_detail_includes_volatility(api):
    d = _data(api.get("/api/routes/DEL-BOM"))
    assert d["volatility"] is not None
    assert d["volatility"]["route_id"] == "DEL-BOM"
    assert 0 <= d["volatility"]["volatility_score"] <= 100


def test_route_heatmap(api):
    d = _data(api.get("/api/analytics/routes"))
    assert len(d["routes"]) == 6
    assert "change_7d" in d["routes"][0]


def test_data_quality(api):
    d = _data(api.get("/api/data-quality"))
    assert 0 <= d["overall_quality_pct"] <= 100
    assert d["breakdown"]["total"] > 0
    assert d["sources"] and d["sources"][0]["name"] == "synthetic"


def test_methodology(api):
    d = _data(api.get("/api/methodology"))
    assert d["index_formula"].startswith("I(t)")
    assert d["weights_sum"] == pytest.approx(1.0)
    assert len(d["route_basket"]) == 6
    assert "not an official CPI" in d["disclaimer"]


def test_flights_pagination_and_filter(api):
    d = _data(api.get("/api/flights?page=1&page_size=5"))
    assert len(d["items"]) == 5
    assert d["pagination"]["total"] > 5
    assert "airlines" in d["filter_options"]

    filtered = _data(api.get("/api/flights?route_id=DEL-BOM&status=valid&page_size=3"))
    assert all(i["route_id"] == "DEL-BOM" for i in filtered["items"])
    assert all(i["status"] == "valid" for i in filtered["items"])


def test_collection_status_and_run(api):
    status = _data(api.get("/api/collection/status"))
    assert status["latest_run"]["source"] == "synthetic"

    run = _data(api.post("/api/collection/run?mode=synthetic"))
    assert run["status"] in {"success", "partial"}
    assert run["records_stored"] > 0


def test_endpoints_require_auth(client):
    for ep in ("/api/overview", "/api/index/current", "/api/routes", "/api/methodology"):
        assert client.get(ep).status_code == 401
