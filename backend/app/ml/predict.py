"""Load the trained fare model and produce range predictions (spec §Part 14).

If no model artifact exists the API returns ``available: false`` with a reason —
predictions are never fabricated. The model is trained on whatever AIRINDEX
airfare observations are in the database, and predictions are a fare *range*, not
a guaranteed fare, and are never used in the AIRINDEX calculation.
"""

from __future__ import annotations

import pickle
from datetime import date, timedelta
from functools import lru_cache

from app.ml import train as _train
from app.ml.train import MIN_ROWS_DEFAULT

#: the two genuinely important caveats — it's a range, and it is not circular
#: with the index. Provenance of the training data is reported in `data_basis`.
_PREDICTION_NOTE = (
    "A machine-learning estimate of the likely fare range for a future trip — "
    "a range, not a guaranteed fare — and not used in the AIRINDEX calculation."
)


def _basis_label(art: dict) -> str:
    if art.get("data_basis") == "authorized-api":
        return "Model trained using validated AIRINDEX airfare observations."
    return (
        f"Model trained on the current AIRINDEX observation history "
        f"({art.get('n_observations', art['n_train'] + art['n_test']):,} validated "
        f"observations)."
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
            "min_observations": MIN_ROWS_DEFAULT,
            "reason": (
                f"Prediction unavailable until sufficient historical observations "
                f"are collected — the model needs at least {MIN_ROWS_DEFAULT} valid "
                f"observations. Run `python -m app.ml.train` once they exist."
            ),
        }
    return {
        "available": True,
        "version": art["version"],
        "trained_at": art["trained_at"],
        "algorithm": art["algorithm"],
        "algorithm_label": art.get("algorithm_label", "Gradient Boosting"),
        "metrics": art["metrics"],
        "n_train": art["n_train"],
        "n_test": art["n_test"],
        "n_observations": art.get("n_observations", art["n_train"] + art["n_test"]),
        "training_period": art.get("training_period"),
        "data_basis": art["data_basis"],
        "data_sources": art.get("data_sources", {}),
        "features": art["feature_names"],
        "basis_label": _basis_label(art),
        "note": _PREDICTION_NOTE,
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
            "reason": (
                f"No trained model covers route {route_id} yet — it has no "
                "historical observations in the training set."
            ),
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
        "model_label": art.get("algorithm_label", "Gradient Boosting"),
        "model_metrics": art["metrics"],
        "training_observations": art.get(
            "n_observations", art["n_train"] + art["n_test"]
        ),
        "training_period": art.get("training_period"),
        "trained_at": art["trained_at"],
        "data_basis": art["data_basis"],
        "note": _PREDICTION_NOTE,
    }
