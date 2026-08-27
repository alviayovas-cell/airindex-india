"""Report builder (spec §31 / §Part 16).

``build_report`` produces the compact ``{summary, rows}`` used by the dashboard.
``build_full_report`` wraps it with the government-style narrative sections —
index, route indexes, observed contributors, volatility, fare spikes, data
quality, lead-time, methodology, source — all sourced from the same services the
dashboard uses (no separate calculations).
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from statistics import mean

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.repositories import (
    AirfareQuoteRepository,
    CollectionRunRepository,
    IndexRepository,
)
from app.index_engine.calculator import pct_change
from app.models.index import Frequency

REPORT_DISCLAIMER = (
    "Experimental analytical index generated from available airfare observations. "
    "It is not an official CPI statistic."
)


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


async def build_full_report(
    db: AsyncIOMotorDatabase,
    *,
    date_from: str | None,
    date_to: str | None,
    route_id: str | None,
    frequency: Frequency,
) -> dict:
    """The compact report plus the narrative sections (spec §Part 16)."""
    # Imported here to avoid a circular import at module load.
    from app.services.analytics_service import (
        current_index,
        lead_time_analysis,
        methodology,
        route_stats,
        route_volatility,
    )
    from app.services.data_quality_service import data_quality
    from app.services.explain_service import index_explain
    from app.services.spike_service import detect_fare_spikes

    import asyncio

    (
        base,
        idx,
        stats,
        explain,
        vol,
        spikes,
        dq,
        lead,
        method,
        run,
    ) = await asyncio.gather(
        build_report(
            db,
            date_from=date_from,
            date_to=date_to,
            route_id=route_id,
            frequency=frequency,
        ),
        current_index(db),
        route_stats(db),
        index_explain(db),
        route_volatility(db),
        detect_fare_spikes(db, window_days=7),
        data_quality(db, date_from=date_from, date_to=date_to, route_id=route_id),
        lead_time_analysis(db, route_id),
        methodology(db),
        CollectionRunRepository(db).latest(),
    )

    non_normal = [a for a in spikes.get("alerts", []) if a["severity"] != "Normal"]

    return {
        **base,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "frequency": frequency.value,
        "route_id": route_id.upper() if route_id else None,
        "disclaimer": REPORT_DISCLAIMER,
        "index": (
            {
                "value": idx.index_value,
                "base_period": idx.base_period,
                "current_period": idx.current_period,
                "change_1d": idx.change_1d,
                "change_7d": idx.change_7d,
                "change_30d": idx.change_30d,
            }
            if idx
            else None
        ),
        "route_indexes": [
            {
                "route_id": s["route_id"],
                "label": s["label"],
                "current_index": s["current_index"],
                "change_7d": s["change_7d"],
                "change_30d": s["change_30d"],
                "average_fare": s["average_fare"],
                "weight": s["weight"],
            }
            for s in stats
        ],
        "observed_contributors": (
            explain.get("observed_contributors", [])[:5]
            if explain.get("available")
            else []
        ),
        "largest_observed_movement": explain.get("largest_observed_movement"),
        "most_affected_window": explain.get("most_affected_window"),
        "volatility": vol["routes"],
        "fare_spikes": {
            "summary": spikes.get("summary", {}),
            "window_days": spikes.get("window_days"),
            "top": non_normal[:5],
        },
        "data_quality": {
            "overall_quality_pct": dq["overall_quality_pct"],
            "breakdown": dq["breakdown"],
        },
        "lead_time": lead["windows"],
        "methodology": {
            "version": method["methodology_version"],
            "base_period": method["base_period"],
            "formula": method["index_formula"],
            "advance_windows": method["advance_windows"],
            "weights": method["weights"],
            "disclaimer": method["disclaimer"],
        },
        "data_source": {
            "source": run.get("source") if run else None,
            "is_synthetic": run.get("is_synthetic", True) if run else True,
            "last_updated": run.get("completed_at") if run else None,
        },
    }


def report_rows_csv(report: dict) -> str:
    """Per-period rows of a report as CSV text."""
    cols = [
        "period",
        "average_fare",
        "index_value",
        "observations",
        "valid_observations",
        "quality_pct",
    ]
    lines = [",".join(cols)]
    for r in report.get("rows", []):
        lines.append(",".join("" if r.get(c) is None else str(r.get(c)) for c in cols))
    return "\n".join(lines)
