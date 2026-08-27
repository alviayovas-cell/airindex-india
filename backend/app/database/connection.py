"""MongoDB connection management and index bootstrapping.

A single AsyncIOMotorClient is shared for the process lifetime. The app must still
start (in a degraded state) when MongoDB is unreachable so the dashboard can show a
friendly error rather than failing to boot — connectivity is checked lazily.
"""

from __future__ import annotations

import logging
import time

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING

from app.config import settings

logger = logging.getLogger("airindex.db")

# How long a ping result is trusted before re-checking connectivity.
# A successful result is cached longer; a failure is retried soon so a slow
# first connection (e.g. Atlas SRV/DNS) doesn't lock the app into degraded mode.
_PING_TTL_OK_SECONDS = 15.0
_PING_TTL_FAIL_SECONDS = 3.0

# Collections used by the prototype (see PRD §16).
COLLECTIONS = (
    "airfare_quotes",
    "routes",
    "airlines",
    "index_values",
    "collection_runs",
    "data_quality",
    "users",
    "app_config",
)


class Database:
    client: AsyncIOMotorClient | None = None
    _connected: bool = False
    _last_ping: float = 0.0

    @classmethod
    def connect(cls) -> None:
        if cls.client is None:
            cls.client = AsyncIOMotorClient(
                settings.mongodb_uri,
                serverSelectionTimeoutMS=settings.mongo_server_selection_timeout_ms,
                connectTimeoutMS=settings.mongo_connect_timeout_ms,
                uuidRepresentation="standard",
            )
            logger.info(
                "Mongo client initialised (%s / %s)",
                settings.mongodb_uri_safe,
                settings.database_name,
            )

    @classmethod
    async def ping(cls, *, force: bool = False) -> bool:
        now = time.monotonic()
        ttl = _PING_TTL_OK_SECONDS if cls._connected else _PING_TTL_FAIL_SECONDS
        if not force and cls._last_ping and (now - cls._last_ping) < ttl:
            return cls._connected
        try:
            cls.connect()
            assert cls.client is not None
            await cls.client.admin.command("ping")
            cls._connected = True
        except Exception as exc:  # noqa: BLE001 - degraded mode is intentional
            cls._connected = False
            logger.warning("MongoDB unavailable: %s", exc)
        cls._last_ping = now
        return cls._connected

    @classmethod
    def get_db(cls) -> AsyncIOMotorDatabase:
        cls.connect()
        assert cls.client is not None
        return cls.client[settings.database_name]

    @classmethod
    async def close(cls) -> None:
        if cls.client is not None:
            cls.client.close()
            cls.client = None
            cls._connected = False
            cls._last_ping = 0.0


def get_database() -> AsyncIOMotorDatabase:
    """FastAPI dependency: returns the shared database handle."""
    return Database.get_db()


async def ensure_indexes() -> None:
    """Create the indexes described in PRD §17. Safe to run repeatedly."""
    db = Database.get_db()

    await db.airfare_quotes.create_index([("route_id", ASCENDING)])
    await db.airfare_quotes.create_index([("origin", ASCENDING)])
    await db.airfare_quotes.create_index([("destination", ASCENDING)])
    await db.airfare_quotes.create_index([("airline", ASCENDING)])
    await db.airfare_quotes.create_index([("travel_date", ASCENDING)])
    await db.airfare_quotes.create_index([("collected_at", DESCENDING)])
    await db.airfare_quotes.create_index([("advance_days", ASCENDING)])
    await db.airfare_quotes.create_index(
        [("route_id", ASCENDING), ("collected_at", DESCENDING)]
    )
    # De-duplication key (see processors.cleaner).
    await db.airfare_quotes.create_index("dedupe_key", sparse=True)

    await db.routes.create_index([("route_id", ASCENDING)], unique=True)
    await db.airlines.create_index([("airline_id", ASCENDING)], unique=True)
    await db.index_values.create_index(
        [("frequency", ASCENDING), ("date", ASCENDING)], unique=True
    )
    await db.collection_runs.create_index([("started_at", DESCENDING)])
    await db.data_quality.create_index([("date", DESCENDING)], unique=True)
    await db.users.create_index([("email", ASCENDING)], unique=True)
    await db.app_config.create_index([("key", ASCENDING)], unique=True)

    logger.info("Mongo indexes ensured")
