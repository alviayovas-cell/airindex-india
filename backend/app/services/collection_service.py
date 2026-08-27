"""Orchestrates a collection run: acquire -> normalize -> clean -> store -> reindex.

    1. read active routes
    2. generate requested travel dates (one per advance window)
    3. request flight data from the selected source
    4. normalize + validate + clean
    5. store in MongoDB
    6. update the collection log
    7. trigger index recalculation
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Literal

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.collectors.amadeus_collector import AmadeusCollector
from app.collectors.base import CollectorError, FlightDataCollector, SearchRequest
from app.collectors.synthetic_collector import SyntheticCollector
from app.database.repositories import (
    AirfareQuoteRepository,
    CollectionRunRepository,
    ConfigRepository,
    DataQualityRepository,
    IndexRepository,
    RouteRepository,
)
from app.domain import ADVANCE_WINDOWS
from app.models.airfare import RawQuote
from app.processors.cleaner import clean
from app.services.index_service import recompute_index

logger = logging.getLogger("airindex.collection")

SourceMode = Literal["auto", "amadeus", "synthetic"]


def resolve_collector(mode: SourceMode) -> FlightDataCollector:
    if mode == "amadeus" or (mode == "auto" and AmadeusCollector.is_available()):
        logger.info("collector: amadeus")
        return AmadeusCollector()
    logger.info("collector: synthetic")
    return SyntheticCollector()


async def run_collection(
    db: AsyncIOMotorDatabase, *, mode: SourceMode = "auto"
) -> dict:
    """One point-in-time snapshot across every active route x advance window."""
    started = datetime.now(timezone.utc)
    t0 = time.monotonic()
    routes = await RouteRepository(db).list_active()
    collector = resolve_collector(mode)

    raws: list[RawQuote] = []
    errors: list[str] = []
    today = started.date()
    for route in routes:
        for window in ADVANCE_WINDOWS:
            req = SearchRequest(
                route_id=route.route_id,
                origin=route.origin,
                destination=route.destination,
                travel_date=today + timedelta(days=window),
            )
            try:
                raws.extend(await collector.collect(req))
            except CollectorError as exc:
                errors.append(f"{route.route_id} T+{window}: {exc}")
                logger.warning("collection error: %s", exc)
            except Exception as exc:  # noqa: BLE001
                errors.append(f"{route.route_id} T+{window}: unexpected {exc}")
                logger.exception("unexpected collector failure")
    await collector.aclose()

    result = await _store_and_reindex(db, raws, append=True)
    duration = round(time.monotonic() - t0, 2)

    run = {
        "source": collector.name,
        "mode": mode,
        "started_at": started.isoformat(),
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "duration_seconds": duration,
        "records_found": len(raws),
        "records_stored": result["stored"],
        "status": "failed"
        if raws == [] and errors
        else ("partial" if errors else "success"),
        "errors": errors[:20],
        "index": result["index"],
        "is_synthetic": collector.is_synthetic,
    }
    await CollectionRunRepository(db).record(run)
    return run


async def seed_history(
    db: AsyncIOMotorDatabase, *, days: int = 30, seed: int = 20260827
) -> dict:
    """Generate a labelled synthetic history and (re)build the whole dataset."""
    started = datetime.now(timezone.utc)
    t0 = time.monotonic()
    collector = SyntheticCollector(seed=seed)
    raws = collector.generate_history(days=days)

    result = await _store_and_reindex(db, raws, append=False)
    duration = round(time.monotonic() - t0, 2)

    run = {
        "source": "synthetic",
        "mode": "synthetic",
        "started_at": started.isoformat(),
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "duration_seconds": duration,
        "records_found": len(raws),
        "records_stored": result["stored"],
        "status": "success",
        "errors": [],
        "index": result["index"],
        "is_synthetic": True,
        "note": f"synthetic {days}-day demonstration dataset",
    }
    await CollectionRunRepository(db).record(run)
    return run


async def _store_and_reindex(
    db: AsyncIOMotorDatabase, raws: list[RawQuote], *, append: bool
) -> dict:
    quote_repo = AirfareQuoteRepository(db)
    config = ConfigRepository(db)
    outlier_method = await config.get("cleaning.outlier_method", "mad")
    cleaning = clean(raws, outlier_method=outlier_method)

    if append:
        stored = await quote_repo.insert_many(cleaning.quotes)
    else:
        stored = await quote_repo.replace_all(cleaning.quotes)

    index_summary = await recompute_index(
        quote_repo,
        IndexRepository(db),
        DataQualityRepository(db),
        config,
    )
    return {"stored": stored, "counts": cleaning.counts, "index": index_summary}
