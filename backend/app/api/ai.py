"""AIRINDEX AI assistant endpoint (spec §Part 13)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.config import settings
from app.database.connection import get_database
from app.models.common import ApiResponse, ok
from app.models.user import UserPublic
from app.services.ai_service import answer, build_context, rate_limiter

router = APIRouter(prefix="/ai", tags=["ai"])


class HistoryTurn(BaseModel):
    role: str
    content: str


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
    history: list[HistoryTurn] | None = None


@router.get("/status", response_model=ApiResponse[dict])
async def ai_status(
    _: UserPublic = Depends(get_current_user),
) -> ApiResponse[dict]:
    return ok(
        {
            "enabled": settings.ai_configured,
            "engine": "claude" if settings.ai_configured else "rule-based",
            "model": settings.ai_model if settings.ai_configured else None,
        }
    )


@router.post("/ask", response_model=ApiResponse[dict])
async def ask(
    body: AskRequest,
    _: UserPublic = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ApiResponse[dict]:
    if not rate_limiter.allow():
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many questions in a short window. Please wait a moment.",
        )
    context = await build_context(db)
    result = await answer(
        body.question,
        context,
        [t.model_dump() for t in body.history] if body.history else None,
    )
    return ok({**result, "context_fields": sorted(context.keys())})
