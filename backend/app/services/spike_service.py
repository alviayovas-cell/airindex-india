"""Fare-spike detection (spec §Part 8).

A *spike* is a meaningful increase in the average fare for a route (optionally per
airline) and advance-purchase window, comparing the most recent period with the
immediately preceding period of the same length. This is distinct from the
per-observation *outlier* flag in the cleaning pipeline.

Thresholds (percent increase) are configurable in ``app_config`` under
``alerts.spike_thresholds``. Only real measured movements are returned — nothing
is fabricated; a route with no movement classifies as "Normal".
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.repositories import (
    AirfareQuoteRepository,
    ConfigRepository,
    IndexRepository,
)
from app.domain import route_label

DEFAULT_THRESHOLDS = {"moderate": 5.0, "high": 10.0, "critical": 20.0}

_SEVERITIES = ("Normal", "Moderate Increase", "High Increase", "Critical Increase")


def classify_spike(pct_change: float, thresholds: dict[str, float]) -> str:
    if pct_change >= thresholds.get("critical", 20.0):
        return "Critical Increase"
    if pct_change >= thresholds.get("high", 10.0):
        return "High Increase"
    if pct_change >= thresholds.get("moderate", 5.0):
        return "Moderate Increase"
    return "Normal"


async def detect_fare_spikes(
    db: AsyncIOMotorDatabase,
    *,
    window_days: int = 7,
    by_airline: bool = False,
    route_id: str | None = None,
    airline: str | None = None,
    severity: str | None = None,
    date_to: str | None = None,
) -> dict:
    daily = await IndexRepository(db).daily_series()
    if not daily:
        return {
            "available": False,
            "message": "No index computed yet. Seed the database.",
        }

    all_dates = [d["date"] for d in daily]
    end = date_to if (date_to and date_to in all_dates) else all_dates[-1]
    end_d = date.fromisoformat(end)
    cur_from = end_d - timedelta(days=window_days - 1)
    base_to = cur_from - timedelta(days=1)
    base_from = base_to - timedelta(days=window_days - 1)

    thresholds = await ConfigRepository(db).get(
        "alerts.spike_thresholds", DEFAULT_THRESHOLDS
    )
    quote_repo = AirfareQuoteRepository(db)
    cur = await quote_repo.avg_fare_by_group(
        cur_from.isoformat(), end_d.isoformat(), by_airline=by_airline
    )
    base = await quote_repo.avg_fare_by_group(
        base_from.isoformat(), base_to.isoformat(), by_airline=by_airline
    )

    detected_at = datetime.now(timezone.utc).isoformat()
    rows: list[dict] = []
    for key, (cur_avg, cur_n) in cur.items():
        if key not in base:
            continue
        base_avg, base_n = base[key]
        if not base_avg:
            continue
        pct = 100.0 * (cur_avg - base_avg) / base_avg
        r_id, window, air = key
        rows.append(
            {
                "route_id": r_id,
                "route_label": route_label(r_id),
                "advance_window": window,
                "airline": air,
                "current_avg_fare": round(cur_avg, 0),
                "baseline_avg_fare": round(base_avg, 0),
                "pct_change": round(pct, 2),
                "severity": classify_spike(pct, thresholds),
                "current_observations": cur_n,
                "baseline_observations": base_n,
                "detected_at": detected_at,
            }
        )

    if route_id:
        rows = [r for r in rows if r["route_id"] == route_id.upper()]
    if airline:
        rows = [r for r in rows if (r["airline"] or "").upper() == airline.upper()]
    if severity:
        rows = [r for r in rows if r["severity"].lower() == severity.lower()]

    rows.sort(key=lambda r: r["pct_change"], reverse=True)
    summary = {s: sum(1 for r in rows if r["severity"] == s) for s in _SEVERITIES}

    return {
        "available": True,
        "window_days": window_days,
        "by_airline": by_airline,
        "current_period": {"from": cur_from.isoformat(), "to": end_d.isoformat()},
        "baseline_period": {"from": base_from.isoformat(), "to": base_to.isoformat()},
        "thresholds": thresholds,
        "severities": list(_SEVERITIES),
        "summary": summary,
        "alerts": rows,
        "note": (
            "Spike = increase in the mean valid fare for a route/window (optionally "
            "airline) versus the preceding period of equal length. Measured "
            "movements only."
        ),
    }
