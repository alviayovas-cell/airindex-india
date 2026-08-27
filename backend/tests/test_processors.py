"""Tests for normalization, cleaning, dedupe and outlier detection."""

from datetime import datetime, timezone

from app.models.airfare import QuoteStatus, RawQuote
from app.processors.cleaner import clean
from app.processors.normalizer import normalize
from app.processors.outlier import (
    flag_outliers,
    flag_outliers_iqr,
    iqr_bounds,
    modified_z_scores,
    normal_range,
)


def _raw(**over) -> RawQuote:
    base = dict(
        route_id="del-bom",
        origin="del",
        destination="bom",
        airline="6e",
        flight_number="6E123",
        travel_date="2026-09-10",
        collected_at=datetime(2026, 8, 26, 6, 30, tzinfo=timezone.utc),
        advance_days=15,
        base_fare=4000.0,
        taxes=700.0,
        fees=300.0,
        total_fare=5000.0,
        currency="inr",
        availability=True,
        source="synthetic",
    )
    base.update(over)
    return RawQuote(**base)


def test_normalize_uppercases_and_labels_window():
    q = normalize(_raw())
    assert q.route_id == "DEL-BOM"
    assert q.origin == "DEL" and q.airline == "6E"
    assert q.advance_window == "T+15"
    assert q.currency == "INR"
    assert q.collection_date == "2026-08-26"
    assert q.is_synthetic is True


def test_normalize_derives_missing_total():
    q = normalize(_raw(total_fare=None))
    assert q.total_fare == 5000.0
    assert "total_fare_derived" in q.quality_flags


def test_normalize_snaps_odd_advance_days_to_nearest_window():
    assert normalize(_raw(advance_days=20)).advance_window == "T+15"
    assert normalize(_raw(advance_days=38)).advance_window == "T+45"


def test_clean_marks_duplicates_keeping_first():
    # Same route/airline/flight/dates -> same dedupe key (fare value is not part of it).
    raws = [_raw(), _raw(), _raw(total_fare=5200.0)]
    statuses = [q.status for q in clean(raws).quotes]
    assert statuses[0] == QuoteStatus.VALID
    assert statuses[1] == QuoteStatus.DUPLICATE
    assert statuses[2] == QuoteStatus.DUPLICATE


def test_clean_keeps_distinct_flights_valid():
    raws = [_raw(flight_number="6E123"), _raw(flight_number="6E777")]
    statuses = [q.status for q in clean(raws).quotes]
    assert statuses == [QuoteStatus.VALID, QuoteStatus.VALID]


def test_clean_flags_missing_and_sold_out():
    raws = [
        _raw(total_fare=None, base_fare=None, taxes=None, availability=False,
             provider_status="sold_out"),
        _raw(flight_number="6E999", total_fare=None, base_fare=None, taxes=None,
             provider_status="cancelled", availability=False),
    ]
    result = clean(raws)
    assert result.quotes[0].status == QuoteStatus.SOLD_OUT
    assert result.quotes[1].status == QuoteStatus.CANCELLED


def test_clean_flags_price_outlier_not_deleted():
    raws = [
        _raw(flight_number=f"6E{i}", total_fare=5000.0 + i * 20) for i in range(12)
    ]
    raws.append(_raw(flight_number="6E-SPIKE", total_fare=25000.0))
    result = clean(raws)
    spike = [q for q in result.quotes if q.flight_number == "6E-SPIKE"][0]
    assert spike.status == QuoteStatus.OUTLIER
    assert "price_outlier" in spike.quality_flags
    assert len(result.quotes) == 13  # nothing dropped


def test_clean_estimates_missing_fare_components():
    q = clean([_raw(base_fare=None, taxes=None)]).quotes[0]
    assert q.status == QuoteStatus.VALID
    assert q.base_fare is not None
    assert "fare_components_estimated" in q.quality_flags


def test_outlier_scores_zero_for_uniform_data():
    assert modified_z_scores([100, 100, 100, 100]) == [0, 0, 0, 0]


def test_flag_outliers_catches_extremes():
    values = [100, 101, 99, 100, 102, 98, 100, 5000]
    flags = flag_outliers(values)
    assert flags[-1] is True
    assert sum(flags) == 1


def test_normal_range_returns_band():
    band = normal_range([4000, 4200, 4100, 3900, 4300, 4050])
    assert band is not None
    lo, hi = band
    assert lo < 4100 < hi


def test_iqr_bounds_and_flagging():
    values = [100, 101, 99, 100, 102, 98, 100, 5000]
    bounds = iqr_bounds(values)
    assert bounds is not None
    flags = flag_outliers_iqr(values)
    assert flags[-1] is True
    assert sum(flags) == 1


def test_iqr_bounds_none_for_degenerate_input():
    assert iqr_bounds([100, 100, 100, 100]) is None
    assert iqr_bounds([1, 2]) is None


def test_clean_iqr_method_flags_outlier_not_deleted():
    raws = [_raw(flight_number=f"6E{i}", total_fare=5000.0 + i * 15) for i in range(12)]
    raws.append(_raw(flight_number="6E-SPIKE", total_fare=40000.0))
    result = clean(raws, outlier_method="iqr")
    spike = [q for q in result.quotes if q.flight_number == "6E-SPIKE"][0]
    assert spike.status == QuoteStatus.OUTLIER
    assert len(result.quotes) == 13  # nothing dropped


def test_clean_flags_unsupported_currency():
    q = clean([_raw(currency="usd")]).quotes[0]
    assert q.status == QuoteStatus.MISSING
    assert any("unsupported_currency" in f for f in q.quality_flags)


def test_clean_flags_invalid_travel_date():
    # travel date before the collection date
    q = clean([_raw(travel_date="2026-08-01")]).quotes[0]
    assert q.status == QuoteStatus.MISSING
    assert "travel_date_not_after_collection" in q.quality_flags


def test_clean_flags_negative_fare():
    q = clean([_raw(total_fare=-1200.0)]).quotes[0]
    assert q.status == QuoteStatus.MISSING
    assert "negative_total_fare" in q.quality_flags
