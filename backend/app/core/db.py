import socket
from fastapi import FastAPI, Request
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings


def _resolve_mongo_url(url: str) -> str:
    """Fallback mongo host to localhost if running outside Docker container network."""
    if "://mongo:" in url or "://mongo/" in url:
        try:
            socket.gethostbyname("mongo")
        except socket.gaierror:
            return url.replace("://mongo:", "://localhost:").replace("://mongo/", "://localhost/")
    return url


async def init_db(app: FastAPI) -> None:
    """Create Motor client and attach the database to app.state."""
    resolved_url = _resolve_mongo_url(settings.mongo_url)
    client = AsyncIOMotorClient(resolved_url)
    app.state.db = client[settings.db_name]
    app.state.db_client = client


def get_db(request: Request) -> AsyncIOMotorDatabase:
    """FastAPI dependency — returns the database from app state."""
    return request.app.state.db
