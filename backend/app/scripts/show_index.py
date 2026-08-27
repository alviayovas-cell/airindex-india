"""Print the computed Airfare Price Index straight from the database.

A quick way to see the Checkpoint B output before the dashboard exists:

    python -m app.scripts.show_index
"""

from __future__ import annotations

import asyncio
import sys

from app.database.connection import Database

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


async def main() -> None:
    if not await Database.ping(force=True):
        raise SystemExit("MongoDB not reachable — check backend/.env")
    db = Database.get_db()

    quotes = await db.airfare_quotes.count_documents({})
    daily = [d async for d in db.index_values.find(
        {"frequency": "daily"}, {"_id": 0}
    ).sort("date", 1)]
    if not daily:
        raise SystemExit("No index computed. Run: python -m app.scripts.seed_database")

    latest = daily[-1]
    base = latest["base_period"]
    print(f"\n  AIRFARE PRICE INDEX  (experimental prototype)")
    print(f"  {'-' * 44}")
    print(f"  base period      : {base}  (= 100.00)")
    print(f"  methodology      : {latest['methodology_version']}")
    print(f"  observations     : {quotes:,}")
    print(f"  latest ({latest['date']}) : {latest['index_value']:.2f}"
          f"   ({latest['change_pct']:+.2f}% d/d)" if latest["change_pct"] is not None
          else f"  latest ({latest['date']}) : {latest['index_value']:.2f}")

    def at(offset: int) -> float | None:
        return daily[-1 - offset]["index_value"] if len(daily) > offset else None

    for label, off in (("7-day", 7), ("30-day", len(daily) - 1)):
        prev = at(off)
        if prev:
            chg = 100 * (latest["index_value"] - prev) / prev
            print(f"  {label:15}: {chg:+.2f}%")

    print(f"\n  daily series ({len(daily)} days)")
    for d in daily:
        bar = "#" * max(int((d["index_value"] - 90) * 1.5), 0)
        print(f"   {d['date']}  {d['index_value']:7.2f}  {bar}")

    for freq in ("weekly", "monthly"):
        rows = [r async for r in db.index_values.find(
            {"frequency": freq}, {"_id": 0, "date": 1, "index_value": 1}
        ).sort("date", 1)]
        print(f"\n  {freq}: " + "  ".join(f"{r['date']}={r['index_value']:.2f}" for r in rows))

    q = await db.data_quality.find_one({}, {"_id": 0}, sort=[("date", -1)])
    if q:
        print(f"\n  data quality ({q['date']}): {q['quality_pct']}%  "
              f"valid={q['valid_count']} outlier={q['outlier_count']} "
              f"sold_out={q['sold_out_count']} cancelled={q['cancelled_count']}")

    await Database.close()


if __name__ == "__main__":
    asyncio.run(main())
