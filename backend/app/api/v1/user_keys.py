"""User API key management routes."""

from fastapi import APIRouter, Depends, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
import httpx

from app.core.db import get_db
from app.core.security import require_user
from app.services import key_service

router = APIRouter(tags=["user-keys"])


class SaveKeysRequest(BaseModel):
    openai_key: str = ""
    anthropic_key: str = ""


@router.put("/user/keys")
async def save_keys(
    body: SaveKeysRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Save (encrypted) user API keys to MongoDB."""
    user = await require_user(request, db)
    await key_service.save_user_keys(
        db, user["user_id"],
        openai_key=body.openai_key,
        anthropic_key=body.anthropic_key,
    )
    return {"message": "Keys saved successfully"}


@router.get("/user/keys")
async def get_key_status(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Return which keys the user has stored (masked, never plaintext)."""
    user = await require_user(request, db)
    doc = await db.user_keys.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {
        "has_openai_key": bool(doc and doc.get("openai_key_enc")),
        "has_anthropic_key": bool(doc and doc.get("anthropic_key_enc")),
    }


@router.delete("/user/keys")
async def delete_keys(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Delete all stored keys for the user."""
    user = await require_user(request, db)
    await db.user_keys.delete_one({"user_id": user["user_id"]})
    return {"message": "Keys deleted"}


@router.get("/user/repos")
async def get_user_repos(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Return the authenticated user's GitHub repos (owner + collaborator + org member)."""
    user = await require_user(request, db)
    user_doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    token = user_doc.get("github_access_token") if user_doc else None
    if not token:
        return []

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.github.com/user/repos",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
            },
            params={
                "per_page": 100,
                "sort": "updated",
                "affiliation": "owner,collaborator,organization_member",
            },
        )
    if resp.status_code != 200:
        return []

    return [
        {
            "full_name": r["full_name"],
            "name": r["name"],
            "private": r["private"],
            "description": r.get("description") or "",
        }
        for r in resp.json()
    ]
