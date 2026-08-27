"""Back-test and report endpoints."""

import pytest
import pytest_asyncio

from app.services.backtest_service import reference_series, run_backtest
from app.services.collection_service import seed_history
from app.services.reference_data import seed_reference_data
from app.index_engine.weights import default_weights


@pytest_asyncio.fixture
async def seeded_db(mock_db):
    await seed_reference_data(mock_db)
    await seed_history(mock_db, days=14, seed=7)
    return mock_db


@pytest.fixture
def api(auth_client, seeded_db):
    return auth_client


def _data(resp):
    body = resp.json()
    assert body["success"] is True, body
    return body["data"]


def test_reference_series_is_100_at_base():
    dates = ["2026-08-01", "2026-08-02", "2026-08-03"]
    ref = reference_series(dates, "2026-08-01", default_weights())
    assert ref["2026-08-01"] == pytest.approx(100.0, abs=0.01)
    assert all(v > 0 for v in ref.values())


@pytest.mark.asyncio
async def test_backtest_recovers_signal(seeded_db):
    result = await run_backtest(seeded_db)
    assert result["available"] is True
    assert result["data_status"] == "synthetic"
    assert len(result["series"]) == result["days"]
    m = result["metrics"]
    # The pipeline should track the noise-free reference closely.
    assert m["correlation"] is not None and m["correlation"] > 0.6
    assert m["mape_pct"] < 6.0
    row = result["series"][0]
    assert {"date", "our_index", "reference_index", "difference", "pct_deviation"} <= row.keys()


def test_backtest_endpoint(api):
    d = _data(api.get("/api/backtest"))
    assert d["available"] is True
    assert "metrics" in d and "series" in d
    assert "not real observations" in d["data_status_label"]


def test_report_endpoint_daily(api):
    d = _data(api.get("/api/reports?frequency=daily"))
    assert d["summary"]["observations"] > 0
    assert len(d["rows"]) >= 1
    assert d["rows"][0]["period"] <= d["rows"][-1]["period"]


def test_report_endpoint_weekly_and_route_filter(api):
    d = _data(api.get("/api/reports?frequency=weekly&route_id=DEL-BOM"))
    assert d["summary"]["route_id"] == "DEL-BOM"
    assert d["summary"]["frequency"] == "weekly"
    for row in d["rows"]:
        assert row["observations"] > 0
