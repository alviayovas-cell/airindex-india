"""Scheduled collection support (PRD §20).

Enabled only when COLLECTION_ENABLED=true. Runs one collection snapshot every
COLLECTION_INTERVAL_MINUTES and recomputes the index. Failures are logged; the
scheduler never crashes the app.
"""

from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import settings
from app.database.connection import Database
from app.services.collection_service import run_collection

logger = logging.getLogger("airindex.scheduler")

_scheduler: AsyncIOScheduler | None = None


async def _job() -> None:
    if not await Database.ping():
        logger.warning("scheduled collection skipped — MongoDB unreachable")
        return
    try:
        run = await run_collection(Database.get_db(), mode="auto")
        logger.info(
            "scheduled collection %s: %s stored", run["status"], run["records_stored"]
        )
    except Exception:  # noqa: BLE001
        logger.exception("scheduled collection failed")


def start_scheduler() -> None:
    global _scheduler
    if not settings.collection_enabled:
        logger.info("scheduled collection disabled (COLLECTION_ENABLED=false)")
        return
    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(
        _job,
        "interval",
        minutes=max(settings.collection_interval_minutes, 5),
        id="collection",
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()
    logger.info(
        "scheduled collection every %s min", settings.collection_interval_minutes
    )


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
