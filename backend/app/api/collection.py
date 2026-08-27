"""Collection run status + manual trigger (§20, §22)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user
from app.database.connection import get_database
from app.database.repositories import CollectionRunRepository
from app.models.common import ApiResponse, ok
from app.models.user import UserPublic
from app.services.collection_service import SourceMode, run_collection

router = APIRouter(prefix="/collection", tags=["collection"])


@router.get("/status", response_model=ApiResponse[dict])
async def collection_status(
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    latest = await CollectionRunRepository(db).latest()
    return ok({"latest_run": latest})


@router.post("/run", response_model=ApiResponse[dict])
async def trigger_collection(
    mode: SourceMode = Query("auto", description="auto | amadeus | synthetic"),
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    """Run one collection snapshot now and recompute the index."""
    run = await run_collection(db, mode=mode)
    return ok(run, message=f"Collection {run['status']}: {run['records_stored']} stored")
