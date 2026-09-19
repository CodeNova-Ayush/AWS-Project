from datetime import datetime, timezone
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase


async def get_user_by_id(db: AsyncIOMotorDatabase, user_id: str) -> Optional[dict]:
    return await db.users.find_one({"user_id": user_id}, {"_id": 0})


async def get_user_by_github_username(
    db: AsyncIOMotorDatabase, github_username: str
) -> Optional[dict]:
    return await db.users.find_one({"github_username": github_username}, {"_id": 0})


async def upsert_user(db: AsyncIOMotorDatabase, user_data: dict) -> None:
    """Insert or update a user keyed on user_id."""
    await db.users.update_one(
        {"user_id": user_data["user_id"]},
        {"$set": user_data},
        upsert=True,
    )


async def get_session(
    db: AsyncIOMotorDatabase, session_token: str
) -> Optional[dict]:
    return await db.user_sessions.find_one(
        {"session_token": session_token}, {"_id": 0}
    )


async def create_session(
    db: AsyncIOMotorDatabase,
    user_id: str,
    token: str,
    expires_at: str,
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    await db.user_sessions.insert_one(
        {
            "user_id": user_id,
            "session_token": token,
            "expires_at": expires_at,
            "created_at": now,
        }
    )


async def delete_session(db: AsyncIOMotorDatabase, session_token: str) -> None:
    await db.user_sessions.delete_many({"session_token": session_token})
