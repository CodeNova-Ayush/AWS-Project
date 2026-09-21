"""Auth service — GitHub OAuth exchange, user upsert, session CRUD."""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.repositories import user_repo


async def exchange_github_code(code: str, redirect_uri: Optional[str] = None) -> str:
    """POST to GitHub token endpoint and return the access_token string."""
    data = {
        "client_id": settings.github_oauth_client_id,
        "client_secret": settings.github_oauth_client_secret,
        "code": code,
    }
    if redirect_uri:
        data["redirect_uri"] = redirect_uri
    elif settings.github_redirect_uri:
        data["redirect_uri"] = settings.github_redirect_uri

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data=data,
        )
        resp.raise_for_status()
        res_json = resp.json()

    if "error" in res_json:
        error_desc = res_json.get("error_description", res_json.get("error"))
        raise ValueError(f"GitHub OAuth error: {error_desc}")

    access_token = res_json.get("access_token")
    if not access_token:
        raise ValueError(f"No access_token in GitHub response: {res_json}")
    return access_token


async def get_github_user_info(token: str) -> dict:
    """GET https://api.github.com/user with the OAuth token."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def get_or_create_user(
    db: AsyncIOMotorDatabase, access_token: str, github_user: dict
) -> str:
    """
    Upsert a user from GitHub OAuth data.
    Returns the user_id.
    """
    github_username = github_user.get("login")
    github_email = github_user.get("email") or f"{github_username}@github.local"
    name = github_user.get("name") or github_username
    picture = github_user.get("avatar_url", "")

    existing = await db.users.find_one(
        {"$or": [{"github_username": github_username}, {"email": github_email}]},
        {"_id": 0},
    )

    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "github_username": github_username,
                    "github_access_token": access_token,
                    "name": name,
                    "picture": picture,
                    "email": github_email,
                }
            },
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await user_repo.upsert_user(
            db,
            {
                "user_id": user_id,
                "email": github_email,
                "name": name,
                "picture": picture,
                "github_username": github_username,
                "github_access_token": access_token,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        )
    return user_id


async def create_session(db: AsyncIOMotorDatabase, user_id: str) -> str:
    """Generate a session token, persist it, and return it."""
    session_token = f"session_{uuid.uuid4().hex}"
    expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    await user_repo.create_session(db, user_id, session_token, expires_at)
    return session_token


async def logout(db: AsyncIOMotorDatabase, session_token: str) -> None:
    await user_repo.delete_session(db, session_token)
