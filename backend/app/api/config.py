"""Runtime index configuration (spec §Part 5 / §Part 6).

Route weights, the base period, the methodology version and the outlier method
are stored in the `app_config` collection and edited here — never hard-coded in
the frontend. Any change triggers a full index recomputation so the dashboard and
every downstream analytic stay consistent.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.core.errors import AppError
from app.database.connection import get_database
from app.database.repositories import (
    AirfareQuoteRepository,
    ConfigRepository,
    DataQualityRepository,
    IndexRepository,
    RouteRepository,
)
from app.domain import ADVANCE_WINDOWS, BASE_PERIOD, METHODOLOGY_VERSION
from app.index_engine.weights import WeightError, default_weights, normalize_weights
from app.models.common import ApiResponse, ok
from app.models.user import UserPublic
from app.processors.outlier import OUTLIER_METHODS
from app.services.index_service import recompute_index

router = APIRouter(prefix="/config", tags=["config"])

DEFAULT_SPIKE_THRESHOLDS = {"moderate": 5.0, "high": 10.0, "critical": 20.0}


class WeightsUpdate(BaseModel):
    weights: dict[str, float] = Field(..., description="route_id -> weight (> 0)")


class IndexConfigUpdate(BaseModel):
    base_period: str | None = None
    methodology_version: str | None = None
    outlier_method: str | None = None


async def _snapshot(db: AsyncIOMotorDatabase) -> dict:
    cfg = ConfigRepository(db)
    raw_weights = await cfg.get("index.weights") or default_weights()
    normalized = normalize_weights(raw_weights)
    routes = {r.route_id: r for r in await RouteRepository(db).list_active()}
    return {
        "base_period": await cfg.get("index.base_period", BASE_PERIOD),
        "methodology_version": await cfg.get(
            "index.methodology_version", METHODOLOGY_VERSION
        ),
        "advance_windows": await cfg.get(
            "index.advance_windows", list(ADVANCE_WINDOWS)
        ),
        "outlier_method": await cfg.get("cleaning.outlier_method", "mad"),
        "outlier_methods": list(OUTLIER_METHODS),
        "spike_thresholds": await cfg.get(
            "alerts.spike_thresholds", DEFAULT_SPIKE_THRESHOLDS
        ),
        "weights_raw": {k: float(v) for k, v in raw_weights.items()},
        "weights": {k: round(v, 4) for k, v in normalized.items()},
        "weights_sum": round(sum(normalized.values()), 4),
        "routes": [
            {
                "route_id": rid,
                "label": f"{routes[rid].origin} → {routes[rid].destination}"
                if rid in routes
                else rid,
                "origin_city": routes[rid].origin_city if rid in routes else None,
                "destination_city": routes[rid].destination_city
                if rid in routes
                else None,
            }
            for rid in raw_weights
        ],
    }


async def _reindex(db: AsyncIOMotorDatabase) -> dict:
    cfg = ConfigRepository(db)
    return await recompute_index(
        AirfareQuoteRepository(db),
        IndexRepository(db),
        DataQualityRepository(db),
        cfg,
    )


@router.get("", response_model=ApiResponse[dict])
async def get_config(
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    return ok(await _snapshot(db))


@router.put("/weights", response_model=ApiResponse[dict])
async def update_weights(
    body: WeightsUpdate,
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    active = {r.route_id for r in await RouteRepository(db).list_active()}
    unknown = sorted(set(body.weights) - active)
    if unknown:
        raise AppError(f"Unknown route(s): {', '.join(unknown)}")
    try:
        normalize_weights(body.weights)  # validates > 0 and non-empty
    except WeightError as exc:
        raise AppError(str(exc)) from exc

    await ConfigRepository(db).set(
        "index.weights", {k: float(v) for k, v in body.weights.items()}
    )
    reindex = await _reindex(db)
    snap = await _snapshot(db)
    return ok(
        {**snap, "reindex": reindex},
        message="Weights updated and index recomputed",
    )


@router.put("/index", response_model=ApiResponse[dict])
async def update_index_config(
    body: IndexConfigUpdate,
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    cfg = ConfigRepository(db)
    if body.base_period is not None:
        try:
            date.fromisoformat(body.base_period)
        except ValueError as exc:
            raise AppError("base_period must be an ISO date (YYYY-MM-DD)") from exc
        await cfg.set("index.base_period", body.base_period)
    if body.methodology_version is not None:
        await cfg.set("index.methodology_version", body.methodology_version.strip())
    if body.outlier_method is not None:
        if body.outlier_method not in OUTLIER_METHODS:
            raise AppError(
                f"outlier_method must be one of: {', '.join(OUTLIER_METHODS)}"
            )
        await cfg.set("cleaning.outlier_method", body.outlier_method)

    reindex = await _reindex(db)
    snap = await _snapshot(db)
    return ok({**snap, "reindex": reindex}, message="Index configuration updated")
