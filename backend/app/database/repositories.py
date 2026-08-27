"""Data-access layer. API/services never touch Motor collections directly."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.security import hash_password
from app.models.airfare import AirfareQuote, QuoteStatus
from app.models.index import Frequency, IndexValue
from app.models.route import Airline, Route
from app.models.user import UserInDB


def _now() -> datetime:
    return datetime.now(timezone.utc)


class UserRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.col = db.users

    async def get_by_email(self, email: str) -> UserInDB | None:
        doc = await self.col.find_one({"email": email.lower()})
        if not doc:
            return None
        return UserInDB(
            id=str(doc["_id"]),
            email=doc["email"],
            name=doc.get("name", "Analyst"),
            role=doc.get("role", "analyst"),
            password_hash=doc["password_hash"],
            created_at=doc.get("created_at", _now()),
        )

    async def upsert_demo_user(self, email: str, password: str, name: str) -> None:
        existing = await self.col.find_one({"email": email.lower()})
        if existing:
            return
        await self.col.insert_one(
            {
                "email": email.lower(),
                "name": name,
                "role": "analyst",
                "password_hash": hash_password(password),
                "created_at": _now(),
            }
        )


class ConfigRepository:
    """Key/value store for runtime-editable configuration (index weights, base period…)."""

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.col = db.app_config

    async def get(self, key: str, default: Any = None) -> Any:
        doc = await self.col.find_one({"key": key})
        return doc["value"] if doc else default

    async def set(self, key: str, value: Any) -> None:
        await self.col.update_one(
            {"key": key},
            {"$set": {"value": value, "updated_at": _now()}},
            upsert=True,
        )

    async def get_many(self, prefix: str) -> dict[str, Any]:
        out: dict[str, Any] = {}
        async for doc in self.col.find({"key": {"$regex": f"^{prefix}"}}):
            out[doc["key"]] = doc["value"]
        return out


class RouteRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.col = db.routes

    async def list_active(self) -> list[Route]:
        out: list[Route] = []
        async for doc in self.col.find({"active": True}).sort("route_id", 1):
            doc.pop("_id", None)
            out.append(Route(**{k: doc[k] for k in doc if k in Route.model_fields}))
        return out

    async def get(self, route_id: str) -> Route | None:
        doc = await self.col.find_one({"route_id": route_id.upper()})
        if not doc:
            return None
        doc.pop("_id", None)
        return Route(**{k: doc[k] for k in doc if k in Route.model_fields})


class AirlineRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.col = db.airlines

    async def list_all(self) -> list[Airline]:
        out: list[Airline] = []
        async for doc in self.col.find().sort("name", 1):
            doc.pop("_id", None)
            out.append(Airline(**{k: doc[k] for k in doc if k in Airline.model_fields}))
        return out


class AirfareQuoteRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.col = db.airfare_quotes

    async def replace_all(self, quotes: list[AirfareQuote]) -> int:
        await self.col.delete_many({})
        if not quotes:
            return 0
        docs = [_quote_doc(q) for q in quotes]
        for i in range(0, len(docs), 1000):
            await self.col.insert_many(docs[i : i + 1000], ordered=False)
        return len(docs)

    async def insert_many(self, quotes: list[AirfareQuote]) -> int:
        if not quotes:
            return 0
        await self.col.insert_many([_quote_doc(q) for q in quotes], ordered=False)
        return len(quotes)

    async def valid_observations_by_day(self) -> dict[str, list[tuple[str, str, float]]]:
        """{collection_date: [(route_id, advance_window, total_fare), …]} for VALID rows."""
        out: dict[str, list[tuple[str, str, float]]] = {}
        cursor = self.col.find(
            {"status": QuoteStatus.VALID.value, "total_fare": {"$gt": 0}},
            {"collection_date": 1, "route_id": 1, "advance_window": 1, "total_fare": 1},
        )
        async for doc in cursor:
            out.setdefault(doc["collection_date"], []).append(
                (doc["route_id"], doc["advance_window"], float(doc["total_fare"]))
            )
        return out

    async def count(self) -> int:
        return await self.col.count_documents({})

    async def status_counts_by_day(self) -> dict[str, dict[str, int]]:
        pipeline = [
            {
                "$group": {
                    "_id": {"date": "$collection_date", "status": "$status"},
                    "n": {"$sum": 1},
                }
            }
        ]
        out: dict[str, dict[str, int]] = {}
        async for doc in self.col.aggregate(pipeline):
            day = doc["_id"]["date"]
            out.setdefault(day, {})[doc["_id"]["status"]] = doc["n"]
        return out

    async def distinct_values(self, field: str) -> list[str]:
        return sorted(v for v in await self.col.distinct(field) if v)

    @staticmethod
    def _build_filter(f: dict) -> dict:
        query: dict = {}
        for key in ("origin", "destination", "route_id", "airline", "source",
                    "advance_window", "status"):
            val = f.get(key)
            if val:
                query[key] = val.upper() if key in {
                    "origin", "destination", "route_id", "airline"
                } else val
        if f.get("date_from") or f.get("date_to"):
            rng: dict = {}
            if f.get("date_from"):
                rng["$gte"] = f["date_from"]
            if f.get("date_to"):
                rng["$lte"] = f["date_to"]
            query["collection_date"] = rng
        if f.get("search"):
            s = f["search"].upper()
            query["$or"] = [
                {"route_id": {"$regex": s}},
                {"airline": {"$regex": s}},
                {"flight_number": {"$regex": s}},
            ]
        return query

    async def query(
        self, filters: dict, *, sort: str = "collected_at", desc: bool = True,
        skip: int = 0, limit: int = 25,
    ) -> tuple[list[dict], int]:
        q = self._build_filter(filters)
        total = await self.col.count_documents(q)
        direction = -1 if desc else 1
        rows: list[dict] = []
        cursor = self.col.find(q).sort(sort, direction).skip(skip).limit(limit)
        async for doc in cursor:
            doc["id"] = str(doc.pop("_id"))
            rows.append(doc)
        return rows, total

    async def filter_options(self) -> dict[str, list[str]]:
        return {
            "origins": await self.distinct_values("origin"),
            "destinations": await self.distinct_values("destination"),
            "routes": await self.distinct_values("route_id"),
            "airlines": await self.distinct_values("airline"),
            "sources": await self.distinct_values("source"),
            "advance_windows": await self.distinct_values("advance_window"),
            "statuses": await self.distinct_values("status"),
        }

    async def lead_time_pairs(
        self,
        route_id: str | None = None,
        *,
        airline: str | None = None,
        fare_type: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> list[tuple[str, float]]:
        q: dict = {"status": QuoteStatus.VALID.value, "total_fare": {"$gt": 0}}
        if route_id:
            q["route_id"] = route_id.upper()
        if airline:
            q["airline"] = airline.upper()
        if fare_type:
            q["fare_type"] = fare_type.lower()
        if date_from or date_to:
            rng: dict = {}
            if date_from:
                rng["$gte"] = date_from
            if date_to:
                rng["$lte"] = date_to
            q["collection_date"] = rng
        out: list[tuple[str, float]] = []
        async for doc in self.col.find(q, {"advance_window": 1, "total_fare": 1}):
            out.append((doc["advance_window"], float(doc["total_fare"])))
        return out

    async def route_fare_and_counts(self) -> dict[str, dict]:
        """Per route: latest-day average valid fare + total observation count."""
        pipeline = [
            {
                "$group": {
                    "_id": "$route_id",
                    "observation_count": {"$sum": 1},
                    "avg_fare": {
                        "$avg": {
                            "$cond": [
                                {"$eq": ["$status", QuoteStatus.VALID.value]},
                                "$total_fare",
                                None,
                            ]
                        }
                    },
                }
            }
        ]
        out: dict[str, dict] = {}
        async for doc in self.col.aggregate(pipeline):
            out[doc["_id"]] = {
                "observation_count": doc["observation_count"],
                "average_fare": round(doc["avg_fare"], 0) if doc.get("avg_fare") else None,
            }
        return out

    async def daily_aggregates(
        self,
        date_from: str | None = None,
        date_to: str | None = None,
        route_id: str | None = None,
    ) -> list[dict]:
        match: dict = {}
        if route_id:
            match["route_id"] = route_id.upper()
        if date_from or date_to:
            rng: dict = {}
            if date_from:
                rng["$gte"] = date_from
            if date_to:
                rng["$lte"] = date_to
            match["collection_date"] = rng
        pipeline: list[dict] = []
        if match:
            pipeline.append({"$match": match})
        pipeline.append(
            {
                "$group": {
                    "_id": "$collection_date",
                    "total": {"$sum": 1},
                    "valid": {
                        "$sum": {
                            "$cond": [{"$eq": ["$status", QuoteStatus.VALID.value]}, 1, 0]
                        }
                    },
                    "fare_sum": {
                        "$sum": {
                            "$cond": [
                                {"$eq": ["$status", QuoteStatus.VALID.value]},
                                "$total_fare",
                                0,
                            ]
                        }
                    },
                }
            }
        )
        rows: list[dict] = []
        async for doc in self.col.aggregate(pipeline):
            valid = doc["valid"] or 0
            rows.append(
                {
                    "date": doc["_id"],
                    "total": doc["total"],
                    "valid": valid,
                    "average_fare": round(doc["fare_sum"] / valid, 0) if valid else None,
                    "quality_pct": round(100.0 * valid / doc["total"], 1) if doc["total"] else 0.0,
                }
            )
        rows.sort(key=lambda r: r["date"])
        return rows

    async def route_window_avg_fare(self, dates: list[str]) -> dict:
        """{collection_date: {route_id: {"avg": mean-of-window-means,
        "windows": {advance_window: avg_fare}}}} for VALID rows on the given dates."""
        if not dates:
            return {}
        pipeline = [
            {
                "$match": {
                    "collection_date": {"$in": dates},
                    "status": QuoteStatus.VALID.value,
                    "total_fare": {"$gt": 0},
                }
            },
            {
                "$group": {
                    "_id": {
                        "date": "$collection_date",
                        "route": "$route_id",
                        "window": "$advance_window",
                    },
                    "avg": {"$avg": "$total_fare"},
                }
            },
        ]
        out: dict = {}
        async for doc in self.col.aggregate(pipeline):
            key = doc["_id"]
            node = out.setdefault(key["date"], {}).setdefault(
                key["route"], {"windows": {}}
            )
            node["windows"][key["window"]] = doc["avg"]
        for day in out.values():
            for node in day.values():
                vals = list(node["windows"].values())
                node["avg"] = sum(vals) / len(vals) if vals else None
        return out

    async def avg_fare_by_group(
        self, date_from: str, date_to: str, *, by_airline: bool = False
    ) -> dict[tuple[str, str, str | None], tuple[float, int]]:
        """Mean VALID fare per (route, advance_window[, airline]) over a date span.
        Key = (route_id, advance_window, airline|None); value = (avg_fare, n)."""
        group_id: dict = {"route": "$route_id", "window": "$advance_window"}
        if by_airline:
            group_id["airline"] = "$airline"
        pipeline = [
            {
                "$match": {
                    "collection_date": {"$gte": date_from, "$lte": date_to},
                    "status": QuoteStatus.VALID.value,
                    "total_fare": {"$gt": 0},
                }
            },
            {
                "$group": {
                    "_id": group_id,
                    "avg": {"$avg": "$total_fare"},
                    "n": {"$sum": 1},
                }
            },
        ]
        out: dict[tuple[str, str, str | None], tuple[float, int]] = {}
        async for doc in self.col.aggregate(pipeline):
            gid = doc["_id"]
            key = (gid["route"], gid["window"], gid.get("airline"))
            out[key] = (doc["avg"], doc["n"])
        return out

    async def airline_stats(self) -> list[dict]:
        pipeline = [
            {"$match": {"status": QuoteStatus.VALID.value, "total_fare": {"$gt": 0}}},
            {
                "$group": {
                    "_id": "$airline",
                    "observation_count": {"$sum": 1},
                    "average_fare": {"$avg": "$total_fare"},
                    "routes": {"$addToSet": "$route_id"},
                }
            },
            {"$sort": {"observation_count": -1}},
        ]
        out: list[dict] = []
        async for doc in self.col.aggregate(pipeline):
            out.append(
                {
                    "airline": doc["_id"],
                    "observation_count": doc["observation_count"],
                    "average_fare": round(doc["average_fare"], 0),
                    "routes_served": len(doc["routes"]),
                }
            )
        return out


class IndexRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.col = db.index_values

    async def replace_all(self, values: list[IndexValue]) -> int:
        await self.col.delete_many({})
        if not values:
            return 0
        await self.col.insert_many(
            [v.model_dump(mode="json") for v in values], ordered=False
        )
        return len(values)

    async def history(self, frequency: Frequency) -> list[dict]:
        cursor = self.col.find({"frequency": frequency.value}, {"_id": 0}).sort("date", 1)
        return [doc async for doc in cursor]

    async def latest(self, frequency: Frequency = Frequency.DAILY) -> dict | None:
        return await self.col.find_one(
            {"frequency": frequency.value}, {"_id": 0}, sort=[("date", -1)]
        )

    async def daily_series(self) -> list[dict]:
        cursor = self.col.find(
            {"frequency": Frequency.DAILY.value}, {"_id": 0}
        ).sort("date", 1)
        return [doc async for doc in cursor]

    async def count(self) -> int:
        return await self.col.count_documents({})


class CollectionRunRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.col = db.collection_runs

    async def record(self, run: dict) -> None:
        await self.col.insert_one({**run, "recorded_at": _now()})

    async def latest(self) -> dict | None:
        return await self.col.find_one({}, {"_id": 0}, sort=[("started_at", -1)])


class DataQualityRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.col = db.data_quality

    async def replace_all(self, rows: list[dict]) -> int:
        await self.col.delete_many({})
        if not rows:
            return 0
        await self.col.insert_many(rows, ordered=False)
        return len(rows)

    async def latest(self) -> dict | None:
        return await self.col.find_one({}, {"_id": 0}, sort=[("date", -1)])

    async def daily(self) -> list[dict]:
        cursor = self.col.find({}, {"_id": 0}).sort("date", 1)
        return [doc async for doc in cursor]

    async def totals(self) -> dict:
        pipeline = [
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": "$total"},
                    "valid": {"$sum": "$valid_count"},
                    "missing": {"$sum": "$missing_count"},
                    "duplicate": {"$sum": "$duplicate_count"},
                    "outlier": {"$sum": "$outlier_count"},
                    "cancelled": {"$sum": "$cancelled_count"},
                    "sold_out": {"$sum": "$sold_out_count"},
                }
            }
        ]
        docs = [d async for d in self.col.aggregate(pipeline)]
        if not docs:
            return {}
        docs[0].pop("_id", None)
        return docs[0]


def _quote_doc(q: AirfareQuote) -> dict:
    doc = q.model_dump(mode="json")
    doc["status"] = q.status.value
    return doc
