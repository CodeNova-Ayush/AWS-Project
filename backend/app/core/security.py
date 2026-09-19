from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.db import get_db


async def get_current_user(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Optional[dict]:
    """Read session cookie (or Bearer header) and return the user dict, or None."""
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    if not token:
        return None

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None

    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    return user


async def require_user(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """Like get_current_user but raises 401 if unauthenticated."""
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
