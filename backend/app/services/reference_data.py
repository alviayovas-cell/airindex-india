"""Idempotent seeding of prototype reference data (routes, airlines, index config)."""

from __future__ import annotations

from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import settings
from app.database.repositories import ConfigRepository, UserRepository
from app.domain import (
    ADVANCE_WINDOWS,
    AIRLINES,
    AIRPORTS,
    BASE_PERIOD,
    METHODOLOGY_VERSION,
    ROUTE_BASKET,
)


async def seed_reference_data(db: AsyncIOMotorDatabase) -> None:
    now = datetime.now(timezone.utc)

    await UserRepository(db).upsert_demo_user(
        settings.demo_user_email, settings.demo_user_password, name="Demo Analyst"
    )

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

    for a in AIRLINES:
        await db.airlines.update_one(
            {"airline_id": a["airline_id"]},
            {"$set": {**a, "active": True, "updated_at": now}},
            upsert=True,
        )

    cfg = ConfigRepository(db)
    await cfg.set("index.base_period", BASE_PERIOD)
    await cfg.set("index.methodology_version", METHODOLOGY_VERSION)
    await cfg.set("index.advance_windows", list(ADVANCE_WINDOWS))
    await cfg.set("index.weights", {r["route_id"]: r["weight"] for r in ROUTE_BASKET})
    await cfg.set("collection.interval_minutes", settings.collection_interval_minutes)
