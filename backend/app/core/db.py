from fastapi import FastAPI, Request
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings


async def init_db(app: FastAPI) -> None:
    """Create Motor client and attach the database to app.state."""
    client = AsyncIOMotorClient(settings.mongo_url)
    app.state.db = client[settings.db_name]
    app.state.db_client = client


def get_db(request: Request) -> AsyncIOMotorDatabase:
    """FastAPI dependency — returns the database from app state."""
    return request.app.state.db
