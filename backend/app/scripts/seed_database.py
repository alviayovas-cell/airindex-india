"""Seed the AIRINDEX database.

  - reference data: demo user, route basket, airlines, index configuration
  - a labelled synthetic 30-day airfare dataset run through the real cleaning
    pipeline, then the computed daily/weekly/monthly index and data-quality rows

Run from the backend/ directory:

    python -m app.scripts.seed_database                # 30-day synthetic history
    python -m app.scripts.seed_database --days 45
    python -m app.scripts.seed_database --reference-only
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import datetime, timezone

# Windows consoles default to cp1252; make our output UTF-8 safe.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

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
from app.services.collection_service import seed_history


async def seed(*, days: int, reference_only: bool) -> None:
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
    now = datetime.now(timezone.utc)

    # ---- Demo user ----
    await UserRepository(db).upsert_demo_user(
        settings.demo_user_email, settings.demo_user_password, name="Demo Analyst"
    )
    print(f"  user     : {settings.demo_user_email} / {settings.demo_user_password}")

    # ---- Routes ----
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
    print(f"  routes   : {len(ROUTE_BASKET)} ({', '.join(r['route_id'] for r in ROUTE_BASKET)})")

    # ---- Airlines ----
    for a in AIRLINES:
        await db.airlines.update_one(
            {"airline_id": a["airline_id"]},
            {"$set": {**a, "active": True, "updated_at": now}},
            upsert=True,
        )
    print(f"  airlines : {len(AIRLINES)}")

    # ---- Index configuration (runtime-editable) ----
    cfg = ConfigRepository(db)
    await cfg.set("index.base_period", BASE_PERIOD)
    await cfg.set("index.methodology_version", METHODOLOGY_VERSION)
    await cfg.set("index.advance_windows", list(ADVANCE_WINDOWS))
    await cfg.set("index.weights", {r["route_id"]: r["weight"] for r in ROUTE_BASKET})
    await cfg.set("collection.interval_minutes", settings.collection_interval_minutes)
    print(f"  config   : base_period={BASE_PERIOD} version={METHODOLOGY_VERSION}")

    if reference_only:
        await Database.close()
        print("Reference data seeded (no synthetic history).")
        return

    # ---- Synthetic history -> cleaning pipeline -> index ----
    print(f"  history  : generating {days}-day synthetic dataset ...")
    run = await seed_history(db, days=days)
    idx = run["index"]
    print(
        f"  stored   : {run['records_stored']} observations "
        f"({run['records_found']} generated)"
    )
    print(
        f"  index    : {idx['index_points']} points over {idx['days']} days, "
        f"base {idx['base_period']}, latest ~ {idx['latest_index']}"
    )
    if idx.get("note"):
        print(f"  note     : {idx['note']}")

    await Database.close()
    print("Seed complete.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the AIRINDEX database")
    parser.add_argument("--days", type=int, default=30, help="days of synthetic history")
    parser.add_argument(
        "--reference-only",
        action="store_true",
        help="seed only user/routes/airlines/config, no synthetic observations",
    )
    args = parser.parse_args()
    asyncio.run(seed(days=args.days, reference_only=args.reference_only))


if __name__ == "__main__":
    main()
