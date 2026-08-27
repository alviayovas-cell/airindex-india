"""Seed the AIRINDEX database with prototype reference data.

Checkpoint A: demo user, route basket, airlines, index configuration.
(Synthetic airfare_quotes + index_values are generated in a later checkpoint.)

Run from the backend/ directory:

    python -m app.scripts.seed_database
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from app.config import settings
from app.database.connection import Database, ensure_indexes
from app.database.repositories import ConfigRepository, UserRepository
from app.domain import (
    ADVANCE_WINDOWS,
    AIRLINES,
    AIRPORTS,
    BASE_PERIOD,
    METHODOLOGY_VERSION,
    ROUTE_BASKET,
)


async def seed() -> None:
    connected = await Database.ping(force=True)
    if not connected:
        raise SystemExit(
            f"Cannot reach MongoDB at {settings.mongodb_uri_safe}\n"
            "  - check MONGODB_URI in backend/.env (one line, real password, no spaces)\n"
            "  - in Atlas > Network Access, allow your IP or 0.0.0.0/0\n"
            "  - if SRV/DNS keeps timing out, use the non-SRV 'Legacy' connection string"
        )

    db = Database.get_db()
    await ensure_indexes()

    # ---- Demo user ----
    users = UserRepository(db)
    await users.upsert_demo_user(
        settings.demo_user_email, settings.demo_user_password, name="Demo Analyst"
    )
    print(f"  user   : {settings.demo_user_email} / {settings.demo_user_password}")

    # ---- Routes ----
    now = datetime.now(timezone.utc)
    for r in ROUTE_BASKET:
        await db.routes.update_one(
            {"route_id": r["route_id"]},
            {
                "$set": {
                    **r,
                    "origin_city": AIRPORTS[r["origin"]]["city"],
                    "destination_city": AIRPORTS[r["destination"]]["city"],
                    "active": True,
                    "updated_at": now,
                }
            },
            upsert=True,
        )
    print(f"  routes : {len(ROUTE_BASKET)} ({', '.join(r['route_id'] for r in ROUTE_BASKET)})")

    # ---- Airlines ----
    for a in AIRLINES:
        await db.airlines.update_one(
            {"airline_id": a["airline_id"]},
            {"$set": {**a, "active": True, "updated_at": now}},
            upsert=True,
        )
    print(f"  airlines: {len(AIRLINES)}")

    # ---- Index configuration (runtime-editable) ----
    cfg = ConfigRepository(db)
    await cfg.set("index.base_period", BASE_PERIOD)
    await cfg.set("index.methodology_version", METHODOLOGY_VERSION)
    await cfg.set("index.advance_windows", list(ADVANCE_WINDOWS))
    await cfg.set(
        "index.weights", {r["route_id"]: r["weight"] for r in ROUTE_BASKET}
    )
    await cfg.set("collection.interval_minutes", settings.collection_interval_minutes)
    print(f"  config : base_period={BASE_PERIOD} version={METHODOLOGY_VERSION}")

    await Database.close()
    print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
