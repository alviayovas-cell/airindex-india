"""Analytics: lead-time and route heatmap (§22)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user
from app.database.connection import get_database
from app.models.common import ApiResponse, ok
from app.models.user import UserPublic
from app.services.analytics_service import (
    airline_overview,
    lead_time_analysis,
    route_heatmap,
    route_volatility,
)
from app.services.festival_service import analyze_festivals

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/lead-time", response_model=ApiResponse[dict])
async def get_lead_time(
    route: str | None = None,
    airline: str | None = None,
    fare_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    return ok(
        await lead_time_analysis(
            db,
            route,
            airline=airline,
            fare_type=fare_type,
            date_from=date_from,
            date_to=date_to,
        )
    )


@router.get("/routes", response_model=ApiResponse[dict])
async def get_route_heatmap(
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    rows = await route_heatmap(db)
    changes = [r["change_7d"] for r in rows if r["change_7d"] is not None]
    return ok(
        {
            "routes": rows,
            "range": {
                "min": min(changes) if changes else None,
                "max": max(changes) if changes else None,
            },
        }
    )


@router.get("/airlines", response_model=ApiResponse[dict])
async def get_airline_comparison(
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    return ok({"airlines": await airline_overview(db)})


@router.get("/volatility", response_model=ApiResponse[dict])
async def get_volatility(
    window_days: int = Query(14, ge=3, le=90),
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    return ok(await route_volatility(db, window_days))


@router.get("/festivals", response_model=ApiResponse[dict])
async def get_festivals(
    event: str | None = None,
    route_id: str | None = None,
    airline: str | None = None,
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    return ok(await analyze_festivals(db, event=event, route_id=route_id, airline=airline))
