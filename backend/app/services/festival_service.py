"""Indian holiday / festival airfare analysis (spec §Part 15).

Compares the mean valid fare for travel dates *in* an event window against the
mean for travel dates *outside* every event window. The result is worded as an
"observed change during the event period" — it is a correlation over a small
window, not a causal claim, and it is only meaningful for events whose travel
window overlaps the data actually collected.
"""

from __future__ import annotations

from datetime import date, timedelta
from statistics import mean

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.repositories import AirfareQuoteRepository
from app.domain import INDIA_EVENTS

_WINDOW_DAYS = 3  # +/- around the event date

_DISCLAIMER = (
    "Observed change during the event period only — a correlation over a short "
    "travel-date window on a labelled synthetic dataset, not evidence that the "
    "event caused the fare movement."
)


def _in_window(d: date, centre: date) -> bool:
    return abs((d - centre).days) <= _WINDOW_DAYS


async def analyze_festivals(
    db: AsyncIOMotorDatabase,
    *,
    event: str | None = None,
    route_id: str | None = None,
    airline: str | None = None,
) -> dict:
    pairs = await AirfareQuoteRepository(db).valid_travel_date_fares(route_id, airline)
    parsed: list[tuple[date, float]] = []
    for iso, fare in pairs:
        try:
            parsed.append((date.fromisoformat(iso), fare))
        except (ValueError, TypeError):
            continue

    if not parsed:
        return {
            "available": False,
            "message": "No valid observations for this selection.",
            "events": [],
        }

    data_min = min(d for d, _ in parsed)
    data_max = max(d for d, _ in parsed)

    events = [e for e in INDIA_EVENTS if not event or e["name"].lower() == event.lower()]
    all_event_dates = [date.fromisoformat(e["date"]) for e in INDIA_EVENTS]

    def is_normal(d: date) -> bool:
        return not any(_in_window(d, c) for c in all_event_dates)

    normal_fares = [f for d, f in parsed if is_normal(d)]
    normal_avg = mean(normal_fares) if normal_fares else None

    rows: list[dict] = []
    for e in events:
        centre = date.fromisoformat(e["date"])
        win_start = centre - timedelta(days=_WINDOW_DAYS)
        win_end = centre + timedelta(days=_WINDOW_DAYS)
        overlaps = win_start <= data_max and win_end >= data_min
        event_fares = [f for d, f in parsed if _in_window(d, centre)]
        event_avg = mean(event_fares) if event_fares else None
        change_pct = (
            round(100.0 * (event_avg - normal_avg) / normal_avg, 2)
            if event_avg and normal_avg
            else None
        )
        rows.append(
            {
                "name": e["name"],
                "date": e["date"],
                "type": e["type"],
                "event_period": {"from": win_start.isoformat(), "to": win_end.isoformat()},
                "in_data_range": overlaps,
                "event_observations": len(event_fares),
                "event_avg_fare": round(event_avg, 0) if event_avg else None,
                "normal_avg_fare": round(normal_avg, 0) if normal_avg else None,
                "observed_change_pct": change_pct,
            }
        )

    rows.sort(key=lambda r: r["date"])
    return {
        "available": True,
        "data_range": {"from": data_min.isoformat(), "to": data_max.isoformat()},
        "normal_avg_fare": round(normal_avg, 0) if normal_avg else None,
        "window_days": _WINDOW_DAYS,
        "filters": {"event": event, "route_id": route_id, "airline": airline},
        "disclaimer": _DISCLAIMER,
        "events": rows,
    }
