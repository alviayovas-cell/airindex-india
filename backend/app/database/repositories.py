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

    async def totals(self) -> dict:
        pipeline = [
            {
                "$group": {
                    "_id": None,
                    **{
                        f"{s.value}": {"$sum": f"${s.value}"}
                        for s in QuoteStatus
                    },
                    "total": {"$sum": "$total"},
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
