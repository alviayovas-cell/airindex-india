"""Synthetic flight-data source.

Generates realistic-looking but **clearly labelled** demonstration observations so
every module stays functional when the live API is unavailable (PRD §15, §36).
Values are illustrative and are never presented as actual airline prices.

The generator is deterministic (seeded) so the demo and the back-test are
reproducible.
"""

from __future__ import annotations

import random
from datetime import date, datetime, time, timedelta, timezone

from app.collectors.base import FlightDataCollector, SearchRequest
from app.domain import ADVANCE_WINDOWS, AIRLINES, ROUTE_BASE_FARE, ROUTE_BASKET
from app.models.airfare import RawQuote

SOURCE_NAME = "synthetic"

# Multiplier applied to the route reference fare by advance-purchase window.
LEAD_TIME_CURVE: dict[int, float] = {
    1: 1.72,
    7: 1.34,
    15: 1.12,
    30: 0.96,
    45: 0.86,
}

# Per-airline price positioning.
AIRLINE_FACTOR: dict[str, float] = {
    "6E": 1.00,  # IndiGo
    "AI": 1.09,  # Air India
    "UK": 1.14,  # Vistara
    "SG": 0.92,  # SpiceJet
    "QP": 0.95,  # Akasa Air
}

_AIRLINE_IDS = [a["airline_id"] for a in AIRLINES]


def _daily_trend(day_offset: int, total_days: int) -> float:
    """Gentle upward drift (~+4% over the window) + weekly seasonality."""
    drift = 1.0 + 0.04 * (day_offset / max(total_days - 1, 1))
    return drift


def _weekday_season(d: date) -> float:
    # Friday/Sunday travel-day pressure feeds through into observed fares.
    return {0: 1.00, 1: 0.98, 2: 0.97, 3: 1.01, 4: 1.06, 5: 1.02, 6: 1.05}[d.weekday()]


class SyntheticCollector(FlightDataCollector):
    name = SOURCE_NAME
    is_synthetic = True

    def __init__(self, seed: int = 20260827) -> None:
        self._rng = random.Random(seed)

    # -- FlightDataCollector contract (used for ad-hoc single-route calls) -------
    async def search_flights(self, request: SearchRequest) -> list[dict]:
        now = datetime.now(timezone.utc)
        advance_days = max((request.travel_date - now.date()).days, 0)
        return self._offers_for(request.route_id, now, request.travel_date, advance_days)

    def normalize_result(self, raw: dict, request: SearchRequest) -> RawQuote | None:
        return RawQuote(**raw)

    # -- Bulk history generation (used by the seed / back-test) -----------------
    def generate_history(
        self, *, days: int, end: date | None = None
    ) -> list[RawQuote]:
        end = end or datetime.now(timezone.utc).date()
        start = end - timedelta(days=days - 1)
        routes = {r["route_id"]: r for r in ROUTE_BASKET}
        quotes: list[RawQuote] = []

        for i in range(days):
            collect_day = start + timedelta(days=i)
            collected_at = datetime.combine(
                collect_day, time(hour=6, minute=30), tzinfo=timezone.utc
            )
            trend = _daily_trend(i, days)
            for route_id in routes:
                for window in ADVANCE_WINDOWS:
                    travel_date = collect_day + timedelta(days=window)
                    for airline_id in _AIRLINE_IDS:
                        # 1–2 observations per airline/window/day
                        for _ in range(self._rng.choice([1, 1, 2])):
                            raw = self._make_offer(
                                route_id=route_id,
                                airline_id=airline_id,
                                window=window,
                                travel_date=travel_date,
                                collected_at=collected_at,
                                trend=trend,
                            )
                            quotes.append(RawQuote(**raw))
        return quotes

    # -- internals ------------------------------------------------------------
    def _offers_for(
        self, route_id: str, collected_at: datetime, travel_date: date, advance_days: int
    ) -> list[dict]:
        window = min(ADVANCE_WINDOWS, key=lambda w: abs(w - advance_days))
        trend = 1.0
        return [
            self._make_offer(
                route_id=route_id,
                airline_id=aid,
                window=window,
                travel_date=travel_date,
                collected_at=collected_at,
                trend=trend,
            )
            for aid in _AIRLINE_IDS
        ]

    def _make_offer(
        self,
        *,
        route_id: str,
        airline_id: str,
        window: int,
        travel_date: date,
        collected_at: datetime,
        trend: float,
    ) -> dict:
        rng = self._rng
        origin, _, destination = route_id.partition("-")
        ref = ROUTE_BASE_FARE[route_id]

        multiplier = (
            LEAD_TIME_CURVE[window]
            * AIRLINE_FACTOR.get(airline_id, 1.0)
            * trend
            * _weekday_season(travel_date)
            * rng.uniform(0.94, 1.06)  # noise
        )
        total = ref * multiplier

        availability = True
        status_hint = "valid"
        base_fare: float | None
        taxes: float | None
        fees: float | None
        total_fare: float | None

        roll = rng.random()
        if roll < 0.015:  # sold out
            availability, status_hint = False, "sold_out"
            base_fare = taxes = fees = total_fare = None
        elif roll < 0.025:  # cancelled flight
            availability, status_hint = False, "cancelled"
            base_fare = taxes = fees = total_fare = None
        else:
            if roll > 0.985:  # price spike outlier
                total *= rng.uniform(2.2, 3.1)
            total_fare = round(total, 0)
            base_fare = round(total * rng.uniform(0.80, 0.86), 0)
            taxes = round(total_fare - base_fare - 250, 0)
            fees = 250.0
            if rng.random() < 0.03:  # occasionally missing components
                base_fare = taxes = None

        advance_days = (travel_date - collected_at.date()).days

        return {
            "route_id": route_id,
            "origin": origin,
            "destination": destination,
            "airline": airline_id,
            "flight_number": f"{airline_id}{rng.randint(100, 999)}",
            "travel_date": travel_date.isoformat(),
            "collected_at": collected_at,
            "advance_days": advance_days,
            "cabin": "Economy",
            "fare_class": rng.choice(["standard", "saver", "flexi"]),
            "base_fare": base_fare,
            "taxes": taxes,
            "fees": fees,
            "total_fare": total_fare,
            "currency": "INR",
            "availability": availability,
            "source": SOURCE_NAME,
            "provider_status": status_hint,
        }
