"""Fare-range prediction (spec §Part 14) and festival analysis (spec §Part 15)."""

import pytest
import pytest_asyncio

from app.ml import predict as predict_mod
from app.ml import train as train_mod
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


# ---- prediction ------------------------------------------------------------

def test_prediction_unavailable_without_model(api, tmp_path, monkeypatch):
    monkeypatch.setattr(train_mod, "MODEL_PATH", tmp_path / "none.pkl")
    predict_mod.reload_model()
    d = _data(api.get("/api/predictions/status"))
    assert d["available"] is False
    assert "train" in d["reason"].lower()

    fd = _data(api.get("/api/predictions/fare?route_id=DEL-BOM&advance_days=15"))
    assert fd["available"] is False


@pytest.mark.asyncio
async def test_train_then_predict_range(seeded_db, tmp_path, monkeypatch):
    monkeypatch.setattr(train_mod, "MODEL_PATH", tmp_path / "fare_model.pkl")
    monkeypatch.setattr(train_mod, "ARTIFACT_DIR", tmp_path)
    predict_mod.reload_model()

    art = await train_mod.train(min_rows=100, db=seeded_db)
    assert art["version"].startswith("fare-")
    assert art["metrics"]["mae"] > 0
    assert 0 <= art["metrics"]["interval_coverage_pct"] <= 100

    info = predict_mod.model_info()
    assert info["available"] is True
    assert info["data_basis"] == "synthetic-demonstration"

    p = predict_mod.predict_fare_range(
        route_id="DEL-BOM", airline="6E", advance_days=15, fare_type="standard"
    )
    assert p["available"] is True
    assert p["predicted_lower_inr"] <= p["predicted_point_inr"] <= p["predicted_upper_inr"]
    assert p["prediction_horizon_days"] == 15
    assert "not used in the AIRINDEX" in p["disclaimer"]

    unknown = predict_mod.predict_fare_range(
        route_id="ZZZ-YYY", airline="6E", advance_days=10
    )
    assert unknown["available"] is False


@pytest.mark.asyncio
async def test_train_refuses_on_too_little_data(seeded_db, tmp_path, monkeypatch):
    monkeypatch.setattr(train_mod, "MODEL_PATH", tmp_path / "m.pkl")
    monkeypatch.setattr(train_mod, "ARTIFACT_DIR", tmp_path)
    out = await train_mod.train(min_rows=10_000_000, db=seeded_db)
    assert out["available"] is False
    assert "need >=" in out["reason"]


# ---- festivals -----------------------------------------------------------

@pytest.mark.asyncio
async def test_festival_analysis(seeded_db):
    result = await analyze_festivals(seeded_db)
    assert result["available"] is True
    assert result["normal_avg_fare"] > 0
    names = {e["name"] for e in result["events"]}
    assert "Independence Day" in names
    # events inside the travel-date window carry observations; far-future ones don't
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


def test_predictions_require_auth(client):
    assert client.get("/api/predictions/fare?route_id=DEL-BOM").status_code == 401
    assert client.get("/api/analytics/festivals").status_code == 401
