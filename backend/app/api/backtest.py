"""30-day back-test / validation (§22, §29)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user
from app.database.connection import get_database
from app.models.common import ApiResponse, ok
from app.models.user import UserPublic
from app.services.backtest_service import run_backtest

router = APIRouter(tags=["backtest"])


@router.get("/backtest", response_model=ApiResponse[dict])
async def get_backtest(
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    return ok(await run_backtest(db))
