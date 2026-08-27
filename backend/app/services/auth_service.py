"""Authentication logic, including an offline degraded mode.

If MongoDB is unreachable the API still permits the single configured demo account
to sign in, so the dashboard remains demonstrable. This path is logged loudly and
only ever accepts the exact `DEMO_USER_*` credentials from the environment.
"""

from __future__ import annotations

import logging

from app.config import settings
from app.core.errors import InvalidCredentials
from app.core.security import create_access_token, verify_password
from app.database.connection import Database
from app.database.repositories import UserRepository
from app.models.user import LoginRequest, TokenData, UserPublic

logger = logging.getLogger("airindex.auth")

_OFFLINE_USER = UserPublic(
    id="offline-demo",
    email=settings.demo_user_email,
    name="Demo Analyst",
    role="analyst",
)


def _issue(user: UserPublic, remember: bool) -> TokenData:
    expire_minutes = 60 * 24 * 30 if remember else None
    token, expires_in = create_access_token(
        subject=user.email,
        extra={"name": user.name, "role": user.role},
        expires_minutes=expire_minutes,
    )
    return TokenData(access_token=token, expires_in=expires_in, user=user)


async def authenticate(body: LoginRequest, users: UserRepository) -> TokenData:
    db_up = await Database.ping()

    if not db_up:
        if (
            body.email.lower() == settings.demo_user_email.lower()
            and body.password == settings.demo_user_password
        ):
            logger.warning(
                "OFFLINE MODE: issuing token for demo user (MongoDB unreachable)"
            )
            return _issue(_OFFLINE_USER, body.remember_me)
        raise InvalidCredentials()

    user = await users.get_by_email(body.email)
    if user is None or not verify_password(body.password, user.password_hash):
        raise InvalidCredentials()

    public = UserPublic(id=user.id, email=user.email, name=user.name, role=user.role)
    return _issue(public, body.remember_me)
