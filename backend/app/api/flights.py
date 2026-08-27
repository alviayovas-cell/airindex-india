"""Airfare observation explorer + ad-hoc search (§22)."""

from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user
from app.collectors.base import CollectorError, SearchRequest
from app.database.connection import get_database
from app.database.repositories import AirfareQuoteRepository, RouteRepository
from app.models.common import ApiResponse, ok
from app.models.user import UserPublic
from app.services.collection_service import resolve_collector

router = APIRouter(prefix="/flights", tags=["flights"])

_SORTABLE = {
    "collected_at", "collection_date", "total_fare", "base_fare", "advance_days",
    "airline", "route_id", "travel_date",
}


@router.get("", response_model=ApiResponse[dict])
async def list_flights(
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    sort: str = Query("collected_at"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    origin: str | None = None,
    destination: str | None = None,
    route_id: str | None = None,
    airline: str | None = None,
    source: str | None = None,
    advance_window: str | None = None,
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    search: str | None = None,
) -> ApiResponse[dict]:
    repo = AirfareQuoteRepository(db)
    sort_field = sort if sort in _SORTABLE else "collected_at"
    filters = {
        "origin": origin, "destination": destination, "route_id": route_id,
        "airline": airline, "source": source, "advance_window": advance_window,
        "status": status, "date_from": date_from, "date_to": date_to, "search": search,
    }
    rows, total = await repo.query(
        filters,
        sort=sort_field,
        desc=order == "desc",
        skip=(page - 1) * page_size,
        limit=page_size,
    )
    options = await repo.filter_options()
    return ok(
        {
            "items": rows,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": max(1, -(-total // page_size)),
            },
            "filter_options": options,
        }
    )


@router.get("/search", response_model=ApiResponse[dict])
async def search_flights(
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
    route_id: str = Query(..., description="e.g. DEL-BOM"),
    advance_days: int = Query(15, ge=1, le=120),
) -> ApiResponse[dict]:
    """Ad-hoc live lookup for one route. Results are NOT stored."""
    route = await RouteRepository(db).get(route_id)
    if route is None:
        return ok({"route_id": route_id, "offers": [], "message": "unknown route"})

    collector = resolve_collector("auto")
    req = SearchRequest(
        route_id=route.route_id,
        origin=route.origin,
        destination=route.destination,
        travel_date=date.today() + timedelta(days=advance_days),
    )
    try:
        quotes = await collector.collect(req)
    except CollectorError as exc:
        await collector.aclose()
        return ok(
            {"route_id": route.route_id, "offers": [], "error": str(exc)},
            message="Live flight data temporarily unavailable",
        )
    await collector.aclose()
    return ok(
        {
            "route_id": route.route_id,
            "travel_date": req.travel_date.isoformat(),
            "source": collector.name,
            "is_synthetic": collector.is_synthetic,
            "offers": [q.model_dump(mode="json") for q in quotes],
        }
    )
