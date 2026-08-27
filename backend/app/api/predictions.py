"""Fare-range prediction endpoint (spec §Part 14).

The model is trained on the AIRINDEX airfare observation history in the database
(through the same cleaning pipeline as the index). A prediction is a fare *range*,
not a guaranteed fare, and is never used in the AIRINDEX calculation. When there
are too few observations the endpoint returns ``available: false`` with a reason.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.core.errors import AppError
from app.ml.predict import model_info, predict_fare_range
from app.models.common import ApiResponse, ok
from app.models.user import UserPublic

router = APIRouter(prefix="/predictions", tags=["predictions"])


@router.get("/status", response_model=ApiResponse[dict])
async def prediction_status(
    _: UserPublic = Depends(get_current_user),
) -> ApiResponse[dict]:
    return ok(model_info())


@router.get("/fare", response_model=ApiResponse[dict])
async def predict_fare(
    route_id: str = Query(..., description="e.g. DEL-BOM"),
    airline: str = Query("6E"),
    advance_days: int = Query(15, ge=1, le=120),
    travel_date: str | None = Query(None, description="ISO date; defaults to today + advance_days"),
    fare_type: str = Query("standard"),
    _: UserPublic = Depends(get_current_user),
) -> ApiResponse[dict]:
    if travel_date is not None:
        try:
            date.fromisoformat(travel_date)
        except ValueError as exc:
            raise AppError("travel_date must be an ISO date (YYYY-MM-DD)") from exc
    return ok(
        predict_fare_range(
            route_id=route_id,
            airline=airline,
            advance_days=advance_days,
            travel_date=travel_date,
            fare_type=fare_type,
        )
    )
