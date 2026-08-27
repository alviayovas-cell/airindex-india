"""User + auth models."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)
    remember_me: bool = False


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str = "analyst"


class TokenData(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserPublic


class UserInDB(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str = "analyst"
    password_hash: str
    created_at: datetime
