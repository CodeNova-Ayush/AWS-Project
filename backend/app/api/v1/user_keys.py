"""User API key management routes — dynamic multi-provider (Groq, Mistral, NVIDIA, OpenAI, Anthropic, Custom)."""

from typing import Optional
from fastapi import APIRouter, Depends, Request, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
import httpx

from app.core.db import get_db
from app.core.security import require_user
from app.services import key_service

router = APIRouter(tags=["user-keys"])


class SaveKeysRequest(BaseModel):
    # Dynamic provider format
    provider: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None
    set_active: Optional[bool] = True

    # Legacy format
    openai_key: Optional[str] = ""
    anthropic_key: Optional[str] = ""


class SetActiveProviderRequest(BaseModel):
    provider: str
    model: Optional[str] = ""


@router.put("/user/keys")
async def save_keys(
    body: SaveKeysRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Save (encrypted) user API keys to MongoDB for any provider."""
    user = await require_user(request, db)

    # Dynamic single provider save
    if body.provider and body.api_key:
        await key_service.save_provider_key(
            db,
            user["user_id"],
            provider=body.provider,
            api_key=body.api_key,
            model=body.model or "",
            base_url=body.base_url or "",
            set_active=body.set_active if body.set_active is not None else True,
        )
        return {
            "message": f"{body.provider.capitalize()} API key saved successfully",
            "provider": body.provider.lower(),
        }

    # Legacy format
    if body.openai_key or body.anthropic_key:
        await key_service.save_user_keys(
            db,
            user["user_id"],
            openai_key=body.openai_key or "",
            anthropic_key=body.anthropic_key or "",
        )
        return {"message": "Keys saved successfully"}

    raise HTTPException(status_code=400, detail="Missing provider and api_key")


@router.get("/user/keys")
async def get_key_status(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Return status and configured models of all providers for the user (masked, never plaintext)."""
    user = await require_user(request, db)
    return await key_service.get_user_providers_status(db, user["user_id"])


@router.put("/user/keys/active")
async def set_active_provider_endpoint(
    body: SetActiveProviderRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Switch the user's active LLM provider and model."""
    user = await require_user(request, db)
    success = await key_service.set_active_provider(db, user["user_id"], body.provider, body.model or "")
    if not success and body.provider:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot activate {body.provider.capitalize()}: please enter and save an API key first.",
        )
    return {
        "message": f"Active provider set to {body.provider}",
        "active_provider": body.provider,
        "active_model": body.model,
    }


@router.delete("/user/keys/{provider}")
async def delete_single_provider_key(
    provider: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Delete a specific provider key."""
    user = await require_user(request, db)
    await key_service.delete_provider_key(db, user["user_id"], provider)
    return {"message": f"{provider.capitalize()} key deleted"}


@router.delete("/user/keys")
async def delete_all_keys(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Delete all stored keys for the user."""
    user = await require_user(request, db)
    await db.user_keys.delete_one({"user_id": user["user_id"]})
    return {"message": "All keys deleted"}


class TestProviderRequest(BaseModel):
    provider: str
    api_key: Optional[str] = ""
    model: Optional[str] = ""
    base_url: Optional[str] = ""


@router.get("/user/models")
async def get_provider_models(
    provider: str,
    api_key: Optional[str] = "",
    base_url: Optional[str] = "",
    request: Request = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Dynamically fetch available models directly from the provider's API."""
    user = await require_user(request, db)
    return await key_service.fetch_provider_models(
        db=db,
        user_id=user["user_id"],
        provider=provider,
        api_key=api_key or "",
        base_url=base_url or "",
    )


@router.post("/user/test-key")
async def test_provider_connection_endpoint(
    body: TestProviderRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Test live connectivity for a provider with a given or stored API key and model."""
    user = await require_user(request, db)
    return await key_service.test_provider_connection(
        db=db,
        user_id=user["user_id"],
        provider=body.provider,
        api_key=body.api_key or "",
        model=body.model or "",
        base_url=body.base_url or "",
    )


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
