from typing import List, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase


async def get_chat_history(
    db: AsyncIOMotorDatabase, issue_id: str, user_id: str
) -> List[dict]:
    messages = (
        await db.chat_messages.find(
            {"user_id": user_id, "issue_id": issue_id}, {"_id": 0}
        )
        .sort("timestamp", 1)
        .to_list(100)
    )
    return messages


async def save_message(db: AsyncIOMotorDatabase, message: dict) -> None:
    """Insert a single chat message document."""
    await db.chat_messages.insert_one(message)
