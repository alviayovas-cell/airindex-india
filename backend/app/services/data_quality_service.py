"""Data-quality dashboard (spec §Part 12).

Aggregates the cleaning-pipeline outcome straight from ``airfare_quotes`` so it can
be sliced by date / route / airline / source. The per-day ``data_quality``
collection stays as a materialised view for ``latest_day``.
"""

from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import settings
from app.database.repositories import (
    AirfareQuoteRepository,
    CollectionRunRepository,
    DataQualityRepository,
)
from app.domain import route_label
from app.models.airfare import QuoteStatus

_STATUS_KEYS = [s.value for s in QuoteStatus]


def _row_from_counts(key: str, counts: dict[str, int], label: str | None = None) -> dict:
    total = sum(counts.values())
    valid = counts.get(QuoteStatus.VALID.value, 0)
    row = {
        "key": key,
        "total": total,
        "valid": valid,
        "missing": counts.get(QuoteStatus.MISSING.value, 0),
        "outlier": counts.get(QuoteStatus.OUTLIER.value, 0),
        "duplicate": counts.get(QuoteStatus.DUPLICATE.value, 0),
        "cancelled": counts.get(QuoteStatus.CANCELLED.value, 0),
        "sold_out": counts.get(QuoteStatus.SOLD_OUT.value, 0),
        "quality_pct": round(100.0 * valid / total, 1) if total else 0.0,
    }
    if label is not None:
        row["label"] = label
    return row


def _bucketize(triples: list[tuple[str, str, int]]) -> dict[str, dict[str, int]]:
    out: dict[str, dict[str, int]] = {}
    for key, status, n in triples:
        out.setdefault(key, {})[status] = n
    return out


async def data_quality(
    db: AsyncIOMotorDatabase,
    *,
    date_from: str | None = None,
    date_to: str | None = None,
    route_id: str | None = None,
    airline: str | None = None,
    source: str | None = None,
) -> dict:
    quotes = AirfareQuoteRepository(db)
    filters = {
        "date_from": date_from,
        "date_to": date_to,
        "route_id": route_id,
        "airline": airline,
        "source": source,
    }

    overall = _bucketize(await quotes.status_counts(filters)).get("_all_", {})
    by_day = _bucketize(await quotes.status_counts(filters, by="collection_date"))
    by_route = _bucketize(await quotes.status_counts(filters, by="route_id"))
    by_airline = _bucketize(await quotes.status_counts(filters, by="airline"))

    breakdown = _row_from_counts("_all_", overall)

    daily = []
    for day in sorted(by_day):
        r = _row_from_counts(day, by_day[day])
        daily.append(
            {
                "date": day,
                "total": r["total"],
                "valid_count": r["valid"],
                "missing_count": r["missing"],
                "duplicate_count": r["duplicate"],
                "outlier_count": r["outlier"],
                "cancelled_count": r["cancelled"],
                "sold_out_count": r["sold_out"],
                "quality_pct": r["quality_pct"],
            }
        )

    routes = sorted(
        (_row_from_counts(k, v, route_label(k)) for k, v in by_route.items()),
        key=lambda x: x["quality_pct"],
    )
    airlines = sorted(
        (_row_from_counts(k, v, k) for k, v in by_airline.items()),
        key=lambda x: x["quality_pct"],
    )

    run = await CollectionRunRepository(db).latest()
    sources = []
    if run:
        sources.append(
            {
                "name": run.get("source", "unknown"),
                "status": {
                    "success": "healthy",
                    "partial": "partial",
                    "failed": "failed",
                }.get(run.get("status", ""), "unknown"),
                "last_collection": run.get("completed_at"),
                "records_collected": run.get("records_stored", 0),
                "errors": run.get("errors", []),
                "duration_seconds": run.get("duration_seconds"),
                "is_synthetic": run.get("is_synthetic", True),
            }
        )
    if settings.amadeus_configured and (not run or run.get("source") != "amadeus"):
        sources.append(
            {
                "name": "amadeus",
                "status": "healthy",
                "last_collection": None,
                "records_collected": 0,
                "errors": [],
                "is_synthetic": False,
            }
        )

    return {
        "overall_quality_pct": breakdown["quality_pct"] if breakdown["total"] else None,
        "breakdown": {k: breakdown[k] for k in
                      ["total", "valid", "missing", "duplicate", "outlier",
                       "cancelled", "sold_out"]},
        "latest_day": await DataQualityRepository(db).latest(),
        "daily": daily,
        "by_route": routes,
        "by_airline": airlines,
        "sources": sources,
        "filters": {k: v for k, v in filters.items()},
        "filter_options": {
            "routes": await quotes.distinct_values("route_id"),
            "airlines": await quotes.distinct_values("airline"),
            "sources": await quotes.distinct_values("source"),
        },
    }
