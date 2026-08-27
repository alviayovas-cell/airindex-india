"""Standalone tests for the Airfare Price Index formula (PRD §16, spec §37)."""

import pytest

from app.index_engine.calculator import (
    aggregate_daily,
    composite_index,
    pct_change,
    route_prices,
    standardized_price,
)
from app.index_engine.weights import (
    WeightError,
    normalize_weights,
    subset_weights,
)
from app.models.index import Frequency


def test_normalize_weights_sums_to_one():
    w = normalize_weights({"A": 2, "B": 2, "C": 1})
    assert sum(w.values()) == pytest.approx(1.0)
    assert w["A"] == pytest.approx(0.4)


def test_normalize_weights_rejects_all_zero():
    with pytest.raises(WeightError):
        normalize_weights({"A": 0, "B": 0})


def test_subset_weights_redistributes_proportionally():
    base = normalize_weights({"A": 0.5, "B": 0.3, "C": 0.2})
    sub = subset_weights(base, {"A", "B"})
    assert sum(sub.values()) == pytest.approx(1.0)
    # A:B ratio preserved (0.5 : 0.3)
    assert sub["A"] / sub["B"] == pytest.approx(0.5 / 0.3)


def test_standardized_price_is_mean_of_per_window_medians():
    # window T+1 median = 200, window T+7 median = 100  -> mean = 150
    assert standardized_price({"T+1": [100, 200, 300], "T+7": [100]}) == 150


def test_index_is_100_at_base_period():
    prices = {"DEL-BOM": 5000.0, "DEL-BLR": 6000.0}
    weights = normalize_weights({"DEL-BOM": 0.6, "DEL-BLR": 0.4})
    result = composite_index(prices, prices, weights)
    assert result is not None
    assert result.index_value == pytest.approx(100.0)


def test_index_reflects_weighted_price_relatives():
    base = {"A": 100.0, "B": 100.0}
    now = {"A": 110.0, "B": 100.0}  # A +10%, B flat
    weights = normalize_weights({"A": 0.25, "B": 0.75})
    result = composite_index(now, base, weights)
    # 100 * (0.25*1.10 + 0.75*1.00) = 102.5
    assert result.index_value == pytest.approx(102.5)
    assert result.route_index["A"] == pytest.approx(110.0)


def test_index_drops_missing_routes_and_renormalizes():
    base = {"A": 100.0, "B": 100.0, "C": 100.0}
    now = {"A": 120.0, "B": 90.0}  # C missing this period
    weights = normalize_weights({"A": 1 / 3, "B": 1 / 3, "C": 1 / 3})
    result = composite_index(now, base, weights)
    assert "C" in result.routes_missing
    assert set(result.routes_used) == {"A", "B"}
    # renormalized 50/50 -> 100*(0.5*1.2 + 0.5*0.9) = 105
    assert result.index_value == pytest.approx(105.0)


def test_index_none_when_no_usable_routes():
    weights = normalize_weights({"A": 1.0})
    assert composite_index({}, {"A": 100.0}, weights) is None


def test_route_prices_ignores_non_positive_fares():
    obs = [("A", "T+1", 5000.0), ("A", "T+1", 0.0), ("A", "T+7", 4000.0)]
    prices = route_prices(obs)
    assert prices["A"] == pytest.approx((5000.0 + 4000.0) / 2)


def test_pct_change():
    assert pct_change(110, 100) == pytest.approx(10.0)
    assert pct_change(100, None) is None
    assert pct_change(100, 0) is None


def test_weekly_aggregation_is_mean_of_daily():
    daily = [
        ("2026-08-03", 100.0),  # Monday
        ("2026-08-04", 102.0),
        ("2026-08-10", 106.0),  # next Monday
    ]
    weekly = aggregate_daily(daily, Frequency.WEEKLY)
    assert weekly[0] == ("2026-08-03", 101.0, 2)
    assert weekly[1] == ("2026-08-10", 106.0, 1)


def test_monthly_aggregation():
    daily = [("2026-07-30", 99.0), ("2026-08-01", 101.0), ("2026-08-31", 105.0)]
    monthly = aggregate_daily(daily, Frequency.MONTHLY)
    assert monthly[0] == ("2026-07", 99.0, 1)
    assert monthly[1] == ("2026-08", 103.0, 2)
