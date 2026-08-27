"""Airfare Price Index endpoints (§22)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user
from app.database.connection import get_database
from app.database.repositories import IndexRepository
from app.models.common import ApiResponse, ok
from app.models.index import Frequency
from app.models.user import UserPublic
from app.services.analytics_service import current_index
from app.services.explain_service import index_calculation, index_explain

router = APIRouter(prefix="/index", tags=["index"])


async def _history(db: AsyncIOMotorDatabase, frequency: Frequency) -> dict:
    rows = await IndexRepository(db).history(frequency)
    return {
        "frequency": frequency.value,
        "base_period": rows[0]["base_period"] if rows else None,
        "methodology_version": rows[0]["methodology_version"] if rows else None,
        "points": [
            {
                "date": r["date"],
                "index_value": r["index_value"],
                "change_pct": r.get("change_pct"),
                "observation_count": r.get("observation_count", 0),
                "routes_covered": r.get("routes_covered", 0),
            }
            for r in rows
        ],
    }


@router.get("/current", response_model=ApiResponse[dict])
async def get_current(
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    idx = await current_index(db)
    if idx is None:
        raise HTTPException(404, "No index has been computed yet. Seed the database.")
    return ok(idx.model_dump())


@router.get("/calculation", response_model=ApiResponse[dict])
async def get_calculation(
    date: str | None = None,
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    """Per-route weight / route-index / contribution table for one day."""
    result = await index_calculation(db, date)
    if result is None:
        raise HTTPException(404, "No index has been computed yet. Seed the database.")
    return ok(result)


@router.get("/explain", response_model=ApiResponse[dict])
async def get_explain(
    date: str | None = None,
    compare: str | None = None,
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    """Largest observed contributors to the index change between two days."""
    result = await index_explain(db, date, compare)
    if result is None:
        raise HTTPException(404, "No index has been computed yet. Seed the database.")
    return ok(result)


@router.get("/history", response_model=ApiResponse[dict])
async def get_history(
    frequency: Frequency = Frequency.DAILY,
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    return ok(await _history(db, frequency))


@router.get("/daily", response_model=ApiResponse[dict])
async def get_daily(
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    return ok(await _history(db, Frequency.DAILY))


@router.get("/weekly", response_model=ApiResponse[dict])
async def get_weekly(
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    return ok(await _history(db, Frequency.WEEKLY))


@router.get("/monthly", response_model=ApiResponse[dict])
async def get_monthly(
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    return ok(await _history(db, Frequency.MONTHLY))
