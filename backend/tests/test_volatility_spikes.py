"""Route volatility (spec §Part 7) and fare-spike detection (spec §Part 8)."""

from datetime import datetime, timezone

import pytest
import pytest_asyncio

from app.services.analytics_service import _volatility_category, route_volatility
from app.services.collection_service import seed_history
from app.services.reference_data import seed_reference_data
from app.services.spike_service import classify_spike, detect_fare_spikes


@pytest_asyncio.fixture
async def seeded_db(mock_db):
    await seed_reference_data(mock_db)
    await seed_history(mock_db, days=20, seed=55)
    return mock_db


@pytest.fixture
def api(auth_client, seeded_db):
    return auth_client


def _data(resp):
    body = resp.json()
    assert body["success"] is True, body
    return body["data"]


# ---- pure helpers -------------------------------------------------------------

def test_volatility_category_bands():
    assert _volatility_category(0) == "Low"
    assert _volatility_category(30) == "Low"
    assert _volatility_category(31) == "Moderate"
    assert _volatility_category(61) == "High"
    assert _volatility_category(81) == "Very High"


def test_classify_spike_thresholds():
    thr = {"moderate": 5.0, "high": 10.0, "critical": 20.0}
    assert classify_spike(2.0, thr) == "Normal"
    assert classify_spike(-30.0, thr) == "Normal"
    assert classify_spike(6.0, thr) == "Moderate Increase"
    assert classify_spike(12.0, thr) == "High Increase"
    assert classify_spike(25.0, thr) == "Critical Increase"


# ---- volatility -------------------------------------------------------------

@pytest.mark.asyncio
async def test_route_volatility_scores_and_ordering(seeded_db):
    result = await route_volatility(seeded_db, window_days=14)
    rows = result["routes"]
    assert len(rows) == 6
    scores = [r["volatility_score"] for r in rows]
    assert scores == sorted(scores, reverse=True)
    for r in rows:
        assert 0 <= r["volatility_score"] <= 100
        assert r["category"] == _volatility_category(r["volatility_score"])
        assert r["sparkline"]
    assert "not an official statistical" in result["disclaimer"].lower()


def test_volatility_endpoint(api):
    d = _data(api.get("/api/analytics/volatility?window_days=10"))
    assert d["window_days"] == 10
    assert len(d["routes"]) == 6


# ---- fare spikes -----------------------------------------------------------

def test_fare_spikes_endpoint_shape(api):
    d = _data(api.get("/api/alerts/fare-spikes?window_days=7"))
    assert d["available"] is True
    assert d["current_period"]["to"] >= d["current_period"]["from"]
    assert d["baseline_period"]["to"] < d["current_period"]["from"]
    pcts = [a["pct_change"] for a in d["alerts"]]
    assert pcts == sorted(pcts, reverse=True)
    assert set(d["summary"]) == {
        "Normal", "Moderate Increase", "High Increase", "Critical Increase",
    }


@pytest.mark.asyncio
async def test_fare_spike_detects_injected_jump(seeded_db):
    # Baseline then current window around a fixed end date present in the data.
    spikes = await detect_fare_spikes(seeded_db, window_days=5)
    end = spikes["current_period"]["to"]
    cur_from = spikes["current_period"]["from"]

    # Inject a large, unambiguous increase for one route/window in the current
    # period only (well above the default 20% "critical" threshold).
    docs = [
        {
            "route_id": "DEL-CCU", "origin": "DEL", "destination": "CCU",
            "airline": "AI", "travel_date": "2099-01-01",
            "collected_at": datetime.now(timezone.utc),
            "collection_date": end, "advance_days": 15, "advance_window": "T+15",
            "cabin": "Economy", "fare_class": "standard", "fare_type": "standard",
            "base_fare": 20000.0, "taxes": 1000.0, "fees": 250.0,
            "total_fare": 21250.0, "currency": "INR", "availability": True,
            "source": "synthetic", "status": "valid", "quality_flags": [],
            "is_synthetic": True,
        }
        for _ in range(6)
    ]
    await seeded_db.airfare_quotes.insert_many(docs)

    after = await detect_fare_spikes(seeded_db, window_days=5, date_to=end)
    hit = next(
        a for a in after["alerts"]
        if a["route_id"] == "DEL-CCU" and a["advance_window"] == "T+15"
    )
    assert hit["severity"] == "Critical Increase"
    assert hit["pct_change"] > 20
    assert cur_from <= end


@pytest.mark.asyncio
async def test_fare_spike_thresholds_come_from_config(seeded_db):
    await seeded_db.app_config.update_one(
        {"key": "alerts.spike_thresholds"},
        {"$set": {"value": {"moderate": 0.1, "high": 0.2, "critical": 0.3}}},
        upsert=True,
    )
    result = await detect_fare_spikes(seeded_db, window_days=7)
    assert result["thresholds"]["critical"] == 0.3
    # with near-zero thresholds almost every route/window is now an "increase"
    assert result["summary"]["Normal"] < len(result["alerts"])
