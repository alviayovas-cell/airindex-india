"""Feature engineering for the fare-prediction model (spec §Part 14).

Deliberately a small, fixed feature set built with numpy + plain Python — no
pandas dependency. One-hot encoders are frozen at train time and stored with the
model so prediction uses the exact same columns.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

import numpy as np

NUMERIC_FEATURES = [
    "advance_days",
    "travel_dow",
    "travel_month",
    "route_hist_mean",
    "route_volatility",
    "collect_day_offset",
]


@dataclass
class FeatureSpec:
    routes: list[str]
    airlines: list[str]
    fare_types: list[str]
    route_hist_mean: dict[str, float]
    route_volatility: dict[str, float]
    min_collection_date: str
    feature_names: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not self.feature_names:
            self.feature_names = (
                NUMERIC_FEATURES
                + [f"route={r}" for r in self.routes]
                + [f"airline={a}" for a in self.airlines]
                + [f"fare_type={f}" for f in self.fare_types]
            )


def _one_hot(value: str, options: list[str]) -> list[float]:
    return [1.0 if value == o else 0.0 for o in options]


def _safe_date(iso: str) -> date | None:
    try:
        return date.fromisoformat(iso)
    except (ValueError, TypeError):
        return None


def row_vector(
    *,
    route_id: str,
    airline: str,
    fare_type: str,
    advance_days: int,
    travel_date: str,
    collection_date: str | None,
    spec: FeatureSpec,
) -> np.ndarray:
    td = _safe_date(travel_date)
    cd = _safe_date(collection_date) if collection_date else None
    base = _safe_date(spec.min_collection_date)
    offset = (cd - base).days if (cd and base) else 0

    numeric = [
        float(advance_days),
        float(td.weekday()) if td else 0.0,
        float(td.month) if td else 0.0,
        spec.route_hist_mean.get(route_id, float(np.mean(list(spec.route_hist_mean.values()) or [0.0]))),
        spec.route_volatility.get(route_id, 0.0),
        float(offset),
    ]
    vec = (
        numeric
        + _one_hot(route_id, spec.routes)
        + _one_hot(airline, spec.airlines)
        + _one_hot(fare_type, spec.fare_types)
    )
    return np.asarray(vec, dtype=float)


def build_matrix(
    rows: list[dict], spec: FeatureSpec
) -> tuple[np.ndarray, np.ndarray, list[str]]:
    X, y, dates = [], [], []
    for r in rows:
        ft = (r.get("fare_type") or r.get("fare_class") or "standard").lower()
        X.append(
            row_vector(
                route_id=r["route_id"],
                airline=r["airline"],
                fare_type=ft,
                advance_days=int(r.get("advance_days", 0)),
                travel_date=r["travel_date"],
                collection_date=r.get("collection_date"),
                spec=spec,
            )
        )
        y.append(float(r["total_fare"]))
        dates.append(r.get("collection_date", ""))
    return np.asarray(X, dtype=float), np.asarray(y, dtype=float), dates
