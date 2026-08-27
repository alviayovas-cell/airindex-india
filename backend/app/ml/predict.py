"""Load the trained fare model and produce range predictions (spec §Part 14).

If no model artifact exists the API returns ``available: false`` with a reason —
predictions are never fabricated. Predicted values are illustrative and are not
used anywhere in the AIRINDEX calculation.
"""

from __future__ import annotations

import pickle
from datetime import date, timedelta
from functools import lru_cache

from app.ml import train as _train

_PREDICTION_DISCLAIMER = (
    "Predicted fare range trained on the labelled synthetic demonstration dataset. "
    "Illustrative only — not a purchasing recommendation, and not used in the "
    "AIRINDEX calculation."
)


@lru_cache(maxsize=1)
def _load() -> dict | None:
    path = _train.MODEL_PATH
    if not path.exists():
        return None
    try:
        with path.open("rb") as f:
            return pickle.load(f)
    except Exception:  # noqa: BLE001 - a corrupt artifact should not 500 the API
        return None


def reload_model() -> None:
    _load.cache_clear()


def model_info() -> dict:
    art = _load()
    if art is None:
        return {
            "available": False,
            "reason": (
                "No fare model has been trained yet. Run `python -m app.ml.train` "
                "once the database has enough valid observations."
            ),
        }
    return {
        "available": True,
        "version": art["version"],
        "trained_at": art["trained_at"],
        "algorithm": art["algorithm"],
        "metrics": art["metrics"],
        "n_train": art["n_train"],
        "n_test": art["n_test"],
        "data_basis": art["data_basis"],
        "features": art["feature_names"],
        "disclaimer": _PREDICTION_DISCLAIMER,
    }


def predict_fare_range(
    *,
    route_id: str,
    airline: str,
    advance_days: int,
    travel_date: str | None = None,
    fare_type: str = "standard",
) -> dict:
    art = _load()
    if art is None:
        return model_info()

    from app.ml.features import row_vector

    spec = art["spec"]
    route_id = route_id.upper()
    airline = airline.upper()
    fare_type = fare_type.lower()

    if route_id not in spec.routes:
        return {
            "available": False,
            "reason": f"Route {route_id} is not in the trained model's basket.",
        }

    if travel_date is None:
        travel_date = (date.today() + timedelta(days=advance_days)).isoformat()
    collection_date = (
        date.fromisoformat(travel_date) - timedelta(days=advance_days)
    ).isoformat()

    vec = row_vector(
        route_id=route_id,
        airline=airline if airline in spec.airlines else spec.airlines[0],
        fare_type=fare_type if fare_type in spec.fare_types else spec.fare_types[0],
        advance_days=advance_days,
        travel_date=travel_date,
        collection_date=collection_date,
        spec=spec,
    ).reshape(1, -1)

    lo = float(art["models"]["q10"].predict(vec)[0])
    mid = float(art["models"]["q50"].predict(vec)[0])
    hi = float(art["models"]["q90"].predict(vec)[0])
    lo, hi = min(lo, hi), max(lo, hi)

    return {
        "available": True,
        "route_id": route_id,
        "airline": airline,
        "fare_type": fare_type,
        "advance_days": advance_days,
        "travel_date": travel_date,
        "prediction_horizon_days": advance_days,
        "predicted_lower_inr": round(lo, 0),
        "predicted_point_inr": round(mid, 0),
        "predicted_upper_inr": round(hi, 0),
        "interval": "10th–90th percentile",
        "model_version": art["version"],
        "model_metrics": art["metrics"],
        "data_basis": art["data_basis"],
        "disclaimer": _PREDICTION_DISCLAIMER,
    }
