"""Read-side analytics composed from stored quotes + index values."""

from __future__ import annotations

from statistics import mean, median, pstdev

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.repositories import (
    AirfareQuoteRepository,
    AirlineRepository,
    ConfigRepository,
    DataQualityRepository,
    IndexRepository,
    RouteRepository,
)
from app.domain import ADVANCE_WINDOWS, BASE_PERIOD, METHODOLOGY_VERSION, route_label
from app.index_engine.weights import default_weights, normalize_weights
from app.models.index import CurrentIndex
from app.services.index_service import INDEX_FORMULA, PRICE_STANDARDIZATION


def _change_over(series: list[float], span: int) -> float | None:
    if len(series) <= span:
        return None
    prev, cur = series[-1 - span], series[-1]
    if prev == 0:
        return None
    return round(100.0 * (cur - prev) / prev, 2)


async def current_index(db: AsyncIOMotorDatabase) -> CurrentIndex | None:
    index_repo = IndexRepository(db)
    daily = await index_repo.daily_series()
    if not daily:
        return None
    values = [d["index_value"] for d in daily]
    latest = daily[-1]
    label = (
        "Price level above base period"
        if latest["index_value"] >= 100
        else "Price level below base period"
    )
    return CurrentIndex(
        index_value=latest["index_value"],
        base_period=latest["base_period"],
        current_period=latest["date"],
        methodology_version=latest["methodology_version"],
        change_1d=latest.get("change_pct"),
        change_7d=_change_over(values, 7),
        change_30d=_change_over(values, len(values) - 1),
        observation_count=latest.get("observation_count", 0),
        routes_covered=latest.get("routes_covered", 0),
        sparkline=[round(v, 2) for v in values[-30:]],
        status_label=label,
    )


async def route_stats(db: AsyncIOMotorDatabase) -> list[dict]:
    routes = await RouteRepository(db).list_active()
    quote_repo = AirfareQuoteRepository(db)
    index_repo = IndexRepository(db)
    fares = await quote_repo.route_fare_and_counts()
    daily = await index_repo.daily_series()

    # route sub-index series from the daily route_index maps
    series: dict[str, list[float]] = {}
    for point in daily:
        for rid, val in (point.get("route_index") or {}).items():
            series.setdefault(rid, []).append(val)

    out: list[dict] = []
    for r in routes:
        s = series.get(r.route_id, [])
        out.append(
            {
                "route_id": r.route_id,
                "origin": r.origin,
                "destination": r.destination,
                "label": route_label(r.route_id),
                "weight": r.weight,
                "average_fare": fares.get(r.route_id, {}).get("average_fare"),
                "observation_count": fares.get(r.route_id, {}).get("observation_count", 0),
                "current_index": round(s[-1], 2) if s else None,
                "change_7d": _change_over(s, 7),
                "change_30d": _change_over(s, len(s) - 1) if s else None,
                "sparkline": [round(v, 2) for v in s[-30:]],
            }
        )
    return out


async def route_detail(db: AsyncIOMotorDatabase, route_id: str) -> dict | None:
    route = await RouteRepository(db).get(route_id)
    if route is None:
        return None
    stats = {s["route_id"]: s for s in await route_stats(db)}.get(route.route_id, {})

    daily = await IndexRepository(db).daily_series()
    history = [
        {"date": p["date"], "index_value": (p.get("route_index") or {}).get(route.route_id)}
        for p in daily
        if (p.get("route_index") or {}).get(route.route_id) is not None
    ]

    lead_time = await lead_time_analysis(db, route.route_id)
    airlines = await _route_airline_breakdown(db, route.route_id)
    vol = {
        r["route_id"]: r for r in (await route_volatility(db))["routes"]
    }.get(route.route_id)

    return {
        "route": route.model_dump(),
        "label": route_label(route.route_id),
        "stats": stats,
        "index_history": history,
        "lead_time": lead_time,
        "airlines": airlines,
        "volatility": vol,
    }


async def _route_airline_breakdown(db: AsyncIOMotorDatabase, route_id: str) -> list[dict]:
    pipeline = [
        {
            "$match": {
                "route_id": route_id.upper(),
                "status": "valid",
                "total_fare": {"$gt": 0},
            }
        },
        {
            "$group": {
                "_id": "$airline",
                "average_fare": {"$avg": "$total_fare"},
                "observation_count": {"$sum": 1},
            }
        },
        {"$sort": {"average_fare": 1}},
    ]
    out: list[dict] = []
    async for doc in db.airfare_quotes.aggregate(pipeline):
        out.append(
            {
                "airline": doc["_id"],
                "average_fare": round(doc["average_fare"], 0),
                "observation_count": doc["observation_count"],
            }
        )
    return out


async def lead_time_analysis(
    db: AsyncIOMotorDatabase,
    route_id: str | None = None,
    *,
    airline: str | None = None,
    fare_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    quote_repo = AirfareQuoteRepository(db)
    pairs = await quote_repo.lead_time_pairs(
        route_id,
        airline=airline,
        fare_type=fare_type,
        date_from=date_from,
        date_to=date_to,
    )
    buckets: dict[str, list[float]] = {f"T+{w}": [] for w in ADVANCE_WINDOWS}
    for window, fare in pairs:
        buckets.setdefault(window, []).append(fare)

    windows = []
    for w in ADVANCE_WINDOWS:
        label = f"T+{w}"
        fares = buckets.get(label, [])
        windows.append(
            {
                "window": label,
                "advance_days": w,
                "average_fare": round(mean(fares), 0) if fares else None,
                "median_fare": round(median(fares), 0) if fares else None,
                "observation_count": len(fares),
            }
        )
    return {
        "route_id": route_id,
        "filters": {
            "airline": airline,
            "fare_type": fare_type,
            "date_from": date_from,
            "date_to": date_to,
        },
        "filter_options": {
            "airlines": await quote_repo.distinct_values("airline"),
            "fare_types": await quote_repo.distinct_values("fare_type"),
        },
        "windows": windows,
    }


# --------------------------------------------------------------------------- #
# Route price volatility (spec §Part 7)
#
# Experimental analytical score — NOT an official statistical volatility measure.
# Built from the daily route sub-index (which is proportional to the route's
# standardized fare), so day-to-day % moves are fare moves.
# --------------------------------------------------------------------------- #
VOLATILITY_DISCLAIMER = (
    "Experimental analytical score from daily route sub-index movements. Not an "
    "official statistical volatility measure."
)
#: daily-return std (%) that maps to a score of 100
_VOL_STD_AT_100 = 5.0


def _volatility_category(score: float) -> str:
    if score > 80:
        return "Very High"
    if score > 60:
        return "High"
    if score > 30:
        return "Moderate"
    return "Low"


def _route_index_series(daily: list[dict]) -> dict[str, list[float]]:
    series: dict[str, list[float]] = {}
    for point in daily:
        for rid, val in (point.get("route_index") or {}).items():
            series.setdefault(rid, []).append(val)
    return series


async def route_volatility(
    db: AsyncIOMotorDatabase, window_days: int = 14
) -> dict:
    routes = await RouteRepository(db).list_active()
    daily = await IndexRepository(db).daily_series()
    series = _route_index_series(daily)

    rows: list[dict] = []
    for r in routes:
        full = series.get(r.route_id, [])
        s = full[-window_days:] if window_days and len(full) > window_days else full
        returns = [
            100.0 * (s[i] - s[i - 1]) / s[i - 1]
            for i in range(1, len(s))
            if s[i - 1]
        ]
        ret_std = pstdev(returns) if len(returns) > 1 else 0.0
        score = min(100.0, round(ret_std / _VOL_STD_AT_100 * 100.0, 1))
        mean_idx = mean(s) if s else None
        cv = (
            round(100.0 * pstdev(s) / mean_idx, 2)
            if s and len(s) > 1 and mean_idx
            else None
        )
        trend_pct = (
            round(100.0 * (s[-1] - s[0]) / s[0], 2)
            if len(s) >= 2 and s[0]
            else None
        )
        rows.append(
            {
                "route_id": r.route_id,
                "label": route_label(r.route_id),
                "volatility_score": score,
                "category": _volatility_category(score),
                "daily_return_std_pct": round(ret_std, 3),
                "coefficient_of_variation_pct": cv,
                "trend_pct": trend_pct,
                "observations": len(s),
                "sparkline": [round(v, 2) for v in s],
            }
        )
    rows.sort(key=lambda x: x["volatility_score"], reverse=True)
    return {
        "window_days": window_days,
        "method": "population std of daily route sub-index % returns, scaled to 0-100",
        "categories": {"Low": "0-30", "Moderate": "31-60", "High": "61-80", "Very High": "81-100"},
        "disclaimer": VOLATILITY_DISCLAIMER,
        "routes": rows,
    }


async def route_heatmap(db: AsyncIOMotorDatabase) -> list[dict]:
    stats = await route_stats(db)
    rows = [
        {
            "route_id": s["route_id"],
            "label": s["label"],
            "change_7d": s["change_7d"],
            "change_30d": s["change_30d"],
            "current_index": s["current_index"],
        }
        for s in stats
    ]
    rows.sort(key=lambda r: (r["change_7d"] is None, -(r["change_7d"] or 0)))
    return rows


async def airline_overview(db: AsyncIOMotorDatabase) -> list[dict]:
    known = {a.airline_id: a.name for a in await AirlineRepository(db).list_all()}
    stats = await AirfareQuoteRepository(db).airline_stats()
    for s in stats:
        s["name"] = known.get(s["airline"], s["airline"])
    return stats


async def dashboard_overview(db: AsyncIOMotorDatabase) -> dict:
    idx = await current_index(db)
    quality = await DataQualityRepository(db).totals()
    routes = await RouteRepository(db).list_active()
    airlines = await AirlineRepository(db).list_all()
    run = await _latest_run(db)

    total_obs = quality.get("total", 0)
    valid = quality.get("valid", 0)
    return {
        "index": idx.model_dump() if idx else None,
        "routes_tracked": len(routes),
        "airlines_covered": len(airlines),
        "observations": total_obs,
        "data_quality_pct": round(100.0 * valid / total_obs, 1) if total_obs else None,
        "last_updated": run.get("completed_at") if run else None,
        "source": run.get("source") if run else None,
        "is_synthetic": run.get("is_synthetic", True) if run else True,
    }


async def _latest_run(db: AsyncIOMotorDatabase) -> dict | None:
    from app.database.repositories import CollectionRunRepository

    return await CollectionRunRepository(db).latest()


async def methodology(db: AsyncIOMotorDatabase) -> dict:
    cfg = ConfigRepository(db)
    base_period = await cfg.get("index.base_period", BASE_PERIOD)
    version = await cfg.get("index.methodology_version", METHODOLOGY_VERSION)
    raw_weights = await cfg.get("index.weights") or default_weights()
    weights = {k: round(v, 4) for k, v in normalize_weights(raw_weights).items()}
    routes = await RouteRepository(db).list_active()

    return {
        "methodology_version": version,
        "base_period": base_period,
        "index_formula": INDEX_FORMULA,
        "price_standardization": PRICE_STANDARDIZATION,
        "advance_windows": list(ADVANCE_WINDOWS),
        "route_basket": [
            {
                "route_id": r.route_id,
                "label": route_label(r.route_id),
                "origin_city": r.origin_city,
                "destination_city": r.destination_city,
                "weight": weights.get(r.route_id),
            }
            for r in routes
        ],
        "weights": weights,
        "weights_sum": round(sum(weights.values()), 4),
        "data_quality_rules": [
            "Every observation keeps its source and collection timestamp.",
            "Schema-invalid records are rejected before storage.",
            "Duplicate observations (same route/airline/flight/dates/window) are "
            "flagged; the first is kept.",
            "Fare components are reconciled; estimated components are flagged.",
        ],
        "missing_data_rule": (
            "A route with no valid observation for a period is excluded and its "
            "weight is redistributed proportionally across the remaining routes."
        ),
        "outlier_rule": (
            "Per route and advance window, observations beyond 3.5 modified "
            "z-scores (median + MAD) are flagged as outliers and excluded from the "
            "index — never deleted."
        ),
        "data_sources": [
            "Amadeus Flight Offers Search API (authorized REST API)",
            "Synthetic demonstration dataset (clearly labelled, not real prices)",
        ],
        "disclaimer": (
            "Experimental prototype index for an internal hackathon. This is not an "
            "official CPI methodology and not an NSO/RBI system."
        ),
    }
