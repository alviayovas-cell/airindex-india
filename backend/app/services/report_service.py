"""Report builder (spec §31)."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from statistics import mean

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.repositories import AirfareQuoteRepository, IndexRepository
from app.index_engine.calculator import pct_change
from app.models.index import Frequency


def _period_label(iso: str, frequency: Frequency) -> str:
    d = date.fromisoformat(iso)
    if frequency == Frequency.WEEKLY:
        return (d - timedelta(days=d.weekday())).isoformat()
    if frequency == Frequency.MONTHLY:
        return f"{d.year}-{d.month:02d}"
    return iso


async def build_report(
    db: AsyncIOMotorDatabase,
    *,
    date_from: str | None,
    date_to: str | None,
    route_id: str | None,
    frequency: Frequency,
) -> dict:
    quote_repo = AirfareQuoteRepository(db)
    daily_quotes = await quote_repo.daily_aggregates(date_from, date_to, route_id)

    # Index series: route sub-index when a route is selected, else the composite.
    index_daily = await IndexRepository(db).daily_series()
    index_by_date: dict[str, float] = {}
    for p in index_daily:
        if date_from and p["date"] < date_from:
            continue
        if date_to and p["date"] > date_to:
            continue
        if route_id:
            v = (p.get("route_index") or {}).get(route_id.upper())
            if v is not None:
                index_by_date[p["date"]] = v
        else:
            index_by_date[p["date"]] = p["index_value"]

    # Bucket to the requested frequency.
    buckets: dict[str, dict] = defaultdict(
        lambda: {"fares": [], "obs": 0, "valid": 0, "index": []}
    )
    order: list[str] = []
    for row in daily_quotes:
        label = _period_label(row["date"], frequency)
        if label not in buckets:
            order.append(label)
        b = buckets[label]
        if row["average_fare"] is not None:
            b["fares"].append(row["average_fare"])
        b["obs"] += row["total"]
        b["valid"] += row["valid"]
        if row["date"] in index_by_date:
            b["index"].append(index_by_date[row["date"]])

    rows = []
    for label in order:
        b = buckets[label]
        rows.append(
            {
                "period": label,
                "average_fare": round(mean(b["fares"]), 0) if b["fares"] else None,
                "index_value": round(mean(b["index"]), 2) if b["index"] else None,
                "observations": b["obs"],
                "valid_observations": b["valid"],
                "quality_pct": round(100.0 * b["valid"] / b["obs"], 1) if b["obs"] else 0.0,
            }
        )

    all_fares = [r["average_fare"] for r in rows if r["average_fare"] is not None]
    all_index = [r["index_value"] for r in rows if r["index_value"] is not None]
    total_obs = sum(r["observations"] for r in rows)
    total_valid = sum(r["valid_observations"] for r in rows)

    summary = {
        "route_id": route_id.upper() if route_id else None,
        "frequency": frequency.value,
        "date_from": rows[0]["period"] if rows else date_from,
        "date_to": daily_quotes[-1]["date"] if daily_quotes else date_to,
        "average_fare": round(mean(all_fares), 0) if all_fares else None,
        "index_start": all_index[0] if all_index else None,
        "index_end": all_index[-1] if all_index else None,
        "index_change_pct": pct_change(all_index[-1], all_index[0]) if len(all_index) > 1 else None,
        "observations": total_obs,
        "valid_observations": total_valid,
        "quality_pct": round(100.0 * total_valid / total_obs, 1) if total_obs else None,
        "period_count": len(rows),
    }

    return {"summary": summary, "rows": rows}
