from datetime import datetime, timezone
from typing import Any, List, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

CACHE_TTL_SECONDS = 300  # 5 minutes


async def get_all_issues(db: AsyncIOMotorDatabase) -> List[dict]:
    return await db.issues.find({}, {"_id": 0}).to_list(100)


async def get_issue_by_id(db: AsyncIOMotorDatabase, issue_id: str) -> Optional[dict]:
    return await db.issues.find_one({"issue_id": issue_id}, {"_id": 0})


async def upsert_issue(db: AsyncIOMotorDatabase, issue_data: dict) -> None:
    await db.issues.update_one(
        {"issue_id": issue_data["issue_id"]},
        {"$set": issue_data},
        upsert=True,
    )


async def get_saved_ids(db: AsyncIOMotorDatabase, user_id: str) -> List[str]:
    saved = await db.saved_issues.find(
        {"user_id": user_id}, {"_id": 0}
    ).to_list(100)
    return [s["issue_id"] for s in saved]


async def save_issue(db: AsyncIOMotorDatabase, user_id: str, issue_id: str) -> None:
    existing = await db.saved_issues.find_one(
        {"user_id": user_id, "issue_id": issue_id}
    )
    if not existing:
        await db.saved_issues.insert_one(
            {
                "user_id": user_id,
                "issue_id": issue_id,
                "saved_at": datetime.now(timezone.utc).isoformat(),
            }
        )


async def unsave_issue(db: AsyncIOMotorDatabase, user_id: str, issue_id: str) -> None:
    await db.saved_issues.delete_many({"user_id": user_id, "issue_id": issue_id})


async def apply_issue(db: AsyncIOMotorDatabase, user_id: str, issue_id: str) -> None:
    await db.applied_issues.insert_one(
        {
            "user_id": user_id,
            "issue_id": issue_id,
            "applied_at": datetime.now(timezone.utc).isoformat(),
        }
    )


async def get_cache(
    db: AsyncIOMotorDatabase, key: str, ttl_seconds: int = CACHE_TTL_SECONDS
) -> Optional[Any]:
    """Return cached data if fresher than ttl_seconds, else None."""
    cached = await db.github_cache.find_one({"key": key})
    if not cached:
        return None
    fetched_at = cached["fetched_at"]
    if fetched_at.tzinfo is None:
        fetched_at = fetched_at.replace(tzinfo=timezone.utc)
    age = (datetime.now(timezone.utc) - fetched_at).total_seconds()
    if age < ttl_seconds:
        return cached["data"]
    return None


async def set_cache(
    db: AsyncIOMotorDatabase, key: str, data: Any
) -> None:
    await db.github_cache.update_one(
        {"key": key},
        {"$set": {"data": data, "fetched_at": datetime.now(timezone.utc)}},
        upsert=True,
    )


async def invalidate_cache(db: AsyncIOMotorDatabase, key: str) -> None:
    """Mark a cache entry as stale so the next read triggers a fresh fetch."""
    await db.github_cache.update_one(
        {"key": key},
        {"$set": {"fetched_at": datetime(1970, 1, 1, tzinfo=timezone.utc)}},
    )
