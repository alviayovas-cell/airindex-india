"""Fare-range prediction (spec §Part 14).

Skipped entirely on a trimmed deployment where numpy / scikit-learn are absent —
the API degrades to `{available: false}` and every other feature is unaffected.
"""

import pytest
import pytest_asyncio

pytest.importorskip("numpy")
pytest.importorskip("sklearn")

from app.ml import predict as predict_mod  # noqa: E402
from app.ml import train as train_mod  # noqa: E402
from app.services.collection_service import seed_history  # noqa: E402
from app.services.reference_data import seed_reference_data  # noqa: E402


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


def test_prediction_unavailable_without_model(api, tmp_path, monkeypatch):
    monkeypatch.setattr(predict_mod, "MODEL_PATH", tmp_path / "none.pkl")
    predict_mod.reload_model()
    d = _data(api.get("/api/predictions/status"))
    assert d["available"] is False
    assert d["min_observations"] > 0
    assert "sufficient historical observations" in d["reason"].lower()

    fd = _data(api.get("/api/predictions/fare?route_id=DEL-BOM&advance_days=15"))
    assert fd["available"] is False


@pytest.mark.asyncio
async def test_train_then_predict_range(seeded_db, tmp_path, monkeypatch):
    monkeypatch.setattr(train_mod, "MODEL_PATH", tmp_path / "fare_model.pkl")
    monkeypatch.setattr(train_mod, "ARTIFACT_DIR", tmp_path)
    monkeypatch.setattr(predict_mod, "MODEL_PATH", tmp_path / "fare_model.pkl")
    predict_mod.reload_model()

    art = await train_mod.train(min_rows=100, db=seeded_db)
    assert art["version"].startswith("fare-")
    assert art["metrics"]["mae"] > 0
    assert 0 <= art["metrics"]["interval_coverage_pct"] <= 100

    info = predict_mod.model_info()
    assert info["available"] is True
    assert info["data_basis"] in {"demonstration", "authorized-api"}
    assert info["data_sources"]
    assert info["training_period"]["from"] <= info["training_period"]["to"]

    p = predict_mod.predict_fare_range(
        route_id="DEL-BOM", airline="6E", advance_days=15, fare_type="standard"
    )
    assert p["available"] is True
    assert p["predicted_lower_inr"] <= p["predicted_point_inr"] <= p["predicted_upper_inr"]
    assert p["prediction_horizon_days"] == 15
    assert p["training_observations"] > 0
    assert "not used in the AIRINDEX" in p["note"]

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


def test_predictions_require_auth(client):
    assert client.get("/api/predictions/fare?route_id=DEL-BOM").status_code == 401
