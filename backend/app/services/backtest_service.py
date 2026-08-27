"""30-day back-test / validation (PRD §22, spec §29).

The prototype index is computed from *noisy, sampled, partially-missing* synthetic
observations that have been through the full cleaning pipeline. The reference
series is the **noise-free ground truth** implied by the synthetic price model:
the same weighted price-relative formula applied to the underlying route prices
with no sampling noise, no outliers and no missing data.

A close match therefore demonstrates that the collection + cleaning + index
pipeline recovers the true price signal. The reference is clearly labelled
synthetic and is never presented as a real external index.
"""

from __future__ import annotations

import math
from datetime import date, timedelta
from statistics import mean, median

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.collectors.synthetic_collector import (
    AIRLINE_FACTOR,
    LEAD_TIME_CURVE,
    _daily_trend,
    _weekday_season,
)
from app.database.repositories import ConfigRepository, IndexRepository
from app.domain import ADVANCE_WINDOWS, ROUTE_BASE_FARE
from app.index_engine.weights import default_weights, normalize_weights


def _true_route_price(route_id: str, collect_day: date, trend: float) -> float:
    """Noise-free standardized price for a route: mean over windows of the
    median-airline fare (airline factors are symmetric, so the median is 1.0)."""
    ref = ROUTE_BASE_FARE[route_id]
    median_airline_factor = median(sorted(AIRLINE_FACTOR.values()))
    per_window = [
        ref
        * LEAD_TIME_CURVE[w]
        * median_airline_factor
        * trend
        * _weekday_season(collect_day + timedelta(days=w))
        for w in ADVANCE_WINDOWS
    ]
    return mean(per_window)


def reference_series(
    dates: list[str], base_period: str, weights: dict[str, float]
) -> dict[str, float]:
    """Ground-truth index for each ISO date in `dates`."""
    if not dates:
        return {}
    total_days = len(dates)
    day0 = date.fromisoformat(dates[0])
    w = normalize_weights(weights)

    def prices_for(iso: str) -> dict[str, float]:
        d = date.fromisoformat(iso)
        offset = (d - day0).days
        trend = _daily_trend(offset, total_days)
        return {r: _true_route_price(r, d, trend) for r in w}

    base_prices = prices_for(base_period if base_period in dates else dates[0])
    out: dict[str, float] = {}
    for iso in dates:
        p = prices_for(iso)
        value = sum(w[r] * 100.0 * (p[r] / base_prices[r]) for r in w)
        out[iso] = round(value, 2)
    return out


def _pearson(a: list[float], b: list[float]) -> float | None:
    n = len(a)
    if n < 2:
        return None
    ma, mb = mean(a), mean(b)
    num = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    da = math.sqrt(sum((x - ma) ** 2 for x in a))
    db = math.sqrt(sum((y - mb) ** 2 for y in b))
    if da == 0 or db == 0:
        return None
    return round(num / (da * db), 4)


async def run_backtest(db: AsyncIOMotorDatabase) -> dict:
    daily = await IndexRepository(db).daily_series()
    if not daily:
        return {"available": False, "message": "No index computed. Seed the database."}

    cfg = ConfigRepository(db)
    raw_weights = await cfg.get("index.weights") or default_weights()
    base_period = daily[0].get("base_period") or daily[0]["date"]

    dates = [d["date"] for d in daily]
    ref = reference_series(dates, base_period, raw_weights)

    series = []
    diffs: list[float] = []
    ours: list[float] = []
    refs: list[float] = []
    for d in daily:
        o = d["index_value"]
        r = ref[d["date"]]
        diff = round(o - r, 3)
        series.append(
            {
                "date": d["date"],
                "our_index": o,
                "reference_index": r,
                "difference": diff,
                "pct_deviation": round(100.0 * (o - r) / r, 3) if r else None,
            }
        )
        diffs.append(diff)
        ours.append(o)
        refs.append(r)

    mae = round(mean(abs(x) for x in diffs), 3)
    rmse = round(math.sqrt(mean(x * x for x in diffs)), 3)
    mape = round(mean(abs(s["pct_deviation"]) for s in series if s["pct_deviation"] is not None), 3)

    return {
        "available": True,
        "data_status": "synthetic",
        "data_status_label": "Synthetic demonstration dataset — not real observations",
        "methodology_version": daily[0].get("methodology_version"),
        "base_period": base_period,
        "days": len(daily),
        "series": series,
        "metrics": {
            "mae": mae,
            "rmse": rmse,
            "correlation": _pearson(ours, refs),
            "mape_pct": mape,
            "max_abs_deviation_pct": round(
                max((abs(s["pct_deviation"]) for s in series if s["pct_deviation"] is not None), default=0.0),
                3,
            ),
        },
        "notes": [
            "Our index is computed from noisy, sampled synthetic observations after "
            "the full cleaning pipeline.",
            "The reference is the noise-free weighted price relative implied by the "
            "synthetic price model.",
            "A small MAE/RMSE and high correlation indicate the pipeline recovers "
            "the underlying price signal.",
        ],
        "limitations": [
            "The reference series is the noise-free price signal implied by the "
            "synthetic model, not an independent external index.",
            "Route coverage is limited to the six-route prototype basket.",
            "Sampling methodology, collection frequency and seat-availability "
            "handling differ from any official airfare series.",
            "The window is a fixed 30-day demonstration period.",
        ],
        "reference_dataset": {
            "available": False,
            "name": "DGCA / external airfare reference series",
            "reason": (
                "No external reference dataset (e.g. DGCA published fares, an NSO "
                "transport CPI sub-index) has been loaded. A real-world comparison "
                "will run here once such a dataset is available; the check above "
                "validates the pipeline against the synthetic model's ground truth "
                "only."
            ),
        },
    }
