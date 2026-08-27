"""Recompute the Airfare Price Index from stored observations (PRD §16, §17)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.database.repositories import (
    AirfareQuoteRepository,
    ConfigRepository,
    DataQualityRepository,
    IndexRepository,
)
from app.domain import BASE_PERIOD, METHODOLOGY_VERSION
from app.index_engine.calculator import (
    aggregate_daily,
    composite_index,
    pct_change,
    route_prices,
)
from app.index_engine.weights import default_weights, normalize_weights
from app.models.airfare import QuoteStatus
from app.models.index import Frequency, IndexValue

logger = logging.getLogger("airindex.index")

INDEX_FORMULA = "I(t) = 100 x Sum_i [ w_i * ( P_i(t) / P_i(0) ) ]"
PRICE_STANDARDIZATION = (
    "P_i(t) = mean over advance windows of the median total fare of route i's "
    "valid observations collected on day t"
)


async def _load_config(config: ConfigRepository) -> tuple[str, str, dict[str, float]]:
    base_period = await config.get("index.base_period", BASE_PERIOD)
    version = await config.get("index.methodology_version", METHODOLOGY_VERSION)
    raw_weights = await config.get("index.weights") or default_weights()
    return base_period, version, normalize_weights(raw_weights)


async def recompute_index(
    quotes: AirfareQuoteRepository,
    index_repo: IndexRepository,
    quality_repo: DataQualityRepository,
    config: ConfigRepository,
) -> dict:
    base_period, version, weights = await _load_config(config)
    obs_by_day = await quotes.valid_observations_by_day()
    if not obs_by_day:
        await index_repo.replace_all([])
        await quality_repo.replace_all([])
        return {"days": 0, "index_points": 0, "message": "no valid observations"}

    days = sorted(obs_by_day)
    prices_by_day = {d: route_prices(obs_by_day[d]) for d in days}

    base_prices = prices_by_day.get(base_period)
    base_note = None
    if not base_prices:
        base_period = days[0]
        base_prices = prices_by_day[base_period]
        base_note = f"base period fell outside data; using earliest day {base_period}"
        logger.warning(base_note)

    now = datetime.now(timezone.utc)
    daily_values: list[IndexValue] = []
    daily_series: list[tuple[str, float]] = []
    prev_value: float | None = None

    for d in days:
        result = composite_index(prices_by_day[d], base_prices, weights)
        if result is None:
            continue
        point = IndexValue(
            date=d,
            frequency=Frequency.DAILY,
            index_value=result.index_value,
            observation_count=len(obs_by_day[d]),
            routes_covered=len(result.routes_used),
            change_pct=pct_change(result.index_value, prev_value),
            base_period=base_period,
            methodology_version=version,
            route_index=result.route_index,
            computed_at=now,
        )
        daily_values.append(point)
        daily_series.append((d, result.index_value))
        prev_value = result.index_value

    all_values = list(daily_values)
    for freq in (Frequency.WEEKLY, Frequency.MONTHLY):
        prev: float | None = None
        for label, value, n_days in aggregate_daily(daily_series, freq):
            all_values.append(
                IndexValue(
                    date=label,
                    frequency=freq,
                    index_value=value,
                    observation_count=n_days,
                    routes_covered=len(weights),
                    change_pct=pct_change(value, prev),
                    base_period=base_period,
                    methodology_version=version,
                    computed_at=now,
                )
            )
            prev = value

    await index_repo.replace_all(all_values)
    await _write_quality(quotes, quality_repo)

    return {
        "days": len(daily_values),
        "index_points": len(all_values),
        "base_period": base_period,
        "latest_index": daily_values[-1].index_value if daily_values else None,
        "note": base_note,
    }


async def _write_quality(
    quotes: AirfareQuoteRepository, quality_repo: DataQualityRepository
) -> None:
    counts_by_day = await quotes.status_counts_by_day()
    rows: list[dict] = []
    for day in sorted(counts_by_day):
        c = counts_by_day[day]
        total = sum(c.values())
        valid = c.get(QuoteStatus.VALID.value, 0)
        rows.append(
            {
                "date": day,
                "total": total,
                "valid_count": valid,
                "missing_count": c.get(QuoteStatus.MISSING.value, 0),
                "duplicate_count": c.get(QuoteStatus.DUPLICATE.value, 0),
                "outlier_count": c.get(QuoteStatus.OUTLIER.value, 0),
                "cancelled_count": c.get(QuoteStatus.CANCELLED.value, 0),
                "sold_out_count": c.get(QuoteStatus.SOLD_OUT.value, 0),
                "quality_pct": round(100.0 * valid / total, 1) if total else 0.0,
            }
        )
    await quality_repo.replace_all(rows)
