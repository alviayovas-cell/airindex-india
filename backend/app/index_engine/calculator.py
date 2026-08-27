"""Experimental weighted Airfare Price Index (PRD §16, §17).

    I(t) = 100 x Sum_i [ w_i * ( P_i(t) / P_i(0) ) ]      with  Sum_i w_i = 1

`P_i(t)` — the *standardized* price for route i on day t — is the mean of the
per-advance-window median total fares of that route's VALID observations. Taking a
per-window median first makes the index insensitive to how many quotes happened
to be collected in each booking window on a given day.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta
from statistics import mean, median

from app.models.index import Frequency
from app.index_engine.weights import subset_weights

# One standardized observation: (route_id, advance_window, total_fare)
Observation = tuple[str, str, float]


def standardized_price(window_fares: dict[str, list[float]]) -> float | None:
    """Mean over advance windows of the median fare in each window."""
    per_window = [median(v) for v in window_fares.values() if v]
    if not per_window:
        return None
    return mean(per_window)


def route_prices(observations: list[Observation]) -> dict[str, float]:
    """Collapse raw valid observations to one standardized price per route."""
    by_route: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    for route_id, window, fare in observations:
        if fare and fare > 0:
            by_route[route_id][window].append(fare)
    out: dict[str, float] = {}
    for route_id, windows in by_route.items():
        price = standardized_price(windows)
        if price is not None:
            out[route_id] = price
    return out


@dataclass
class IndexResult:
    index_value: float
    route_index: dict[str, float] = field(default_factory=dict)
    routes_used: list[str] = field(default_factory=list)
    routes_missing: list[str] = field(default_factory=list)
    effective_weights: dict[str, float] = field(default_factory=dict)


def composite_index(
    prices_t: dict[str, float],
    base_prices: dict[str, float],
    weights: dict[str, float],
) -> IndexResult | None:
    """Compute I(t). Routes absent from either period are dropped and weights
    renormalized over the rest (documented missing-data rule)."""
    usable = {
        r for r in weights
        if prices_t.get(r, 0) > 0 and base_prices.get(r, 0) > 0
    }
    if not usable:
        return None

    eff = subset_weights(weights, usable)
    route_index = {
        r: 100.0 * (prices_t[r] / base_prices[r]) for r in usable
    }
    value = sum(eff[r] * route_index[r] for r in usable)
    missing = [r for r in weights if r not in usable]
    return IndexResult(
        index_value=round(value, 2),
        route_index={r: round(v, 2) for r, v in route_index.items()},
        routes_used=sorted(usable),
        routes_missing=sorted(missing),
        effective_weights={r: round(w, 4) for r, w in eff.items()},
    )


def pct_change(current: float, previous: float | None) -> float | None:
    if previous is None or previous == 0:
        return None
    return round(100.0 * (current - previous) / previous, 2)


# --------------------------------------------------------------------------- #
# Frequency aggregation (PRD §17)
# --------------------------------------------------------------------------- #
def _iso_week_label(d: date) -> str:
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def _week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def aggregate_daily(
    daily: list[tuple[str, float]], frequency: Frequency
) -> list[tuple[str, float, int]]:
    """Aggregate (iso_date, index_value) daily points to weekly/monthly means.

    Returns (period_label, mean_index, n_days). Daily returns itself unchanged.
    """
    if frequency == Frequency.DAILY:
        return [(d, round(v, 2), 1) for d, v in daily]

    buckets: dict[str, list[float]] = defaultdict(list)
    order: list[str] = []
    for iso_date, value in daily:
        d = date.fromisoformat(iso_date)
        if frequency == Frequency.WEEKLY:
            label = _week_start(d).isoformat()
        else:
            label = f"{d.year}-{d.month:02d}"
        if label not in buckets:
            order.append(label)
        buckets[label].append(value)
    return [(label, round(mean(buckets[label]), 2), len(buckets[label])) for label in order]
