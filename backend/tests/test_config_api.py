"""Runtime index-configuration API (spec §Part 5 / §Part 6)."""

import pytest
import pytest_asyncio

from app.services.collection_service import seed_history
from app.services.reference_data import seed_reference_data


@pytest_asyncio.fixture
async def seeded_db(mock_db):
    await seed_reference_data(mock_db)
    await seed_history(mock_db, days=8, seed=7)
    return mock_db


@pytest.fixture
def api(auth_client, seeded_db):
    return auth_client


def _data(resp):
    body = resp.json()
    assert body["success"] is True, body
    return body["data"]


def test_get_config_reports_normalized_weights(api):
    d = _data(api.get("/api/config"))
    assert d["weights_sum"] == pytest.approx(1.0)
    assert set(d["weights"]) == {
        "DEL-BOM", "DEL-BLR", "BOM-BLR", "DEL-CCU", "BLR-HYD", "MAA-DEL",
    }
    assert d["outlier_method"] == "mad"
    assert "iqr" in d["outlier_methods"]


def test_update_weights_renormalizes_and_reindexes(api):
    new = {
        "DEL-BOM": 3, "DEL-BLR": 1, "BOM-BLR": 1,
        "DEL-CCU": 1, "BLR-HYD": 1, "MAA-DEL": 1,
    }
    d = _data(api.put("/api/config/weights", json={"weights": new}))
    assert d["weights"]["DEL-BOM"] == pytest.approx(3 / 8)
    assert d["weights_sum"] == pytest.approx(1.0)
    assert d["reindex"]["index_points"] > 0

    # persisted + reflected by the methodology endpoint
    m = _data(api.get("/api/methodology"))
    assert m["weights"]["DEL-BOM"] == pytest.approx(3 / 8)


def test_update_weights_rejects_all_zero(api):
    resp = api.put(
        "/api/config/weights",
        json={"weights": {k: 0 for k in ["DEL-BOM", "DEL-BLR", "BOM-BLR"]}},
    )
    assert resp.status_code == 400
    assert resp.json()["success"] is False


def test_update_weights_rejects_unknown_route(api):
    resp = api.put("/api/config/weights", json={"weights": {"XXX-YYY": 1.0}})
    assert resp.status_code == 400


def test_update_index_config_validates(api):
    assert api.put(
        "/api/config/index", json={"base_period": "not-a-date"}
    ).status_code == 400
    assert api.put(
        "/api/config/index", json={"outlier_method": "bogus"}
    ).status_code == 400

    d = _data(api.put("/api/config/index", json={"outlier_method": "iqr"}))
    assert d["outlier_method"] == "iqr"


def test_config_requires_auth(client):
    assert client.get("/api/config").status_code == 401
