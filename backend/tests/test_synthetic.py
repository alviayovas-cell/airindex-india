"""The synthetic dataset must be reproducible and mostly valid."""

from datetime import date

from app.collectors.synthetic_collector import SyntheticCollector
from app.models.airfare import QuoteStatus
from app.processors.cleaner import clean


def test_generate_history_is_deterministic():
    a = SyntheticCollector(seed=42).generate_history(days=5, end=date(2026, 8, 27))
    b = SyntheticCollector(seed=42).generate_history(days=5, end=date(2026, 8, 27))
    assert len(a) == len(b)
    assert [q.total_fare for q in a] == [q.total_fare for q in b]


def test_history_covers_all_routes_and_windows():
    quotes = SyntheticCollector(seed=1).generate_history(days=3, end=date(2026, 8, 27))
    routes = {q.route_id for q in quotes}
    windows = {q.advance_days for q in quotes}
    assert len(routes) == 6
    assert windows == {1, 7, 15, 30, 45}


def test_history_is_labelled_synthetic():
    quotes = SyntheticCollector().generate_history(days=2, end=date(2026, 8, 27))
    assert all(q.source == "synthetic" for q in quotes)


def test_cleaned_history_is_majority_valid():
    quotes = SyntheticCollector(seed=7).generate_history(days=10, end=date(2026, 8, 27))
    result = clean(quotes)
    valid = result.counts[QuoteStatus.VALID.value]
    assert valid / result.total > 0.85
    # every documented status bucket exists in the schema output
    for s in QuoteStatus:
        assert s.value in result.counts
