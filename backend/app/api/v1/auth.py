"""Auth routes — GitHub OAuth, session management, /me, /logout."""

import logging
import uuid
from datetime import datetime, timezone, timedelta
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.core.db import get_db
from app.core.security import get_current_user
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


@router.post("/session")
async def auth_session(request: Request, response: Response, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Emergent OAuth session flow — exchanges emergent session_id for our session cookie."""
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    async with httpx.AsyncClient() as http_client:
        resp = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        data = resp.json()

    email = data["email"]
    name = data.get("name", "")
    picture = data.get("picture", "")
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"email": email}, {"$set": {"name": name, "picture": picture}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": name, "picture": picture,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    is_https = request.url.scheme == "https"
    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=is_https, samesite="none" if is_https else "lax", path="/", max_age=7 * 24 * 60 * 60,
    )
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if user:
        user["session_token"] = session_token
    return user


@router.post("/demo-login")
async def demo_login(request: Request, response: Response, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Fast local demo login with sample data."""
    user_id = "user_demo_local"
    session_token = f"demo_token_{uuid.uuid4().hex}"

    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "email": "demo@codetok.local",
            "name": "Demo Developer",
            "github_username": "demo",
            "picture": "https://avatars.githubusercontent.com/u/9919?v=4",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )

    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    is_https = request.url.scheme == "https"
    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=is_https, samesite="none" if is_https else "lax", path="/", max_age=7 * 24 * 60 * 60,
    )

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    user["session_token"] = session_token
    return user


@router.post("/github/token")
async def connect_github_token(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Allow connecting a GitHub Personal Access Token (PAT) directly."""
    body = await request.json()
    token = (body.get("token") or body.get("access_token") or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Token required")

    user = await get_current_user(request, db)
    user_id = user["user_id"] if user else "user_demo_local"

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {token}", "User-Agent": "MergeDeck"},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Invalid GitHub token")
        gh_data = resp.json()

    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "github_access_token": token,
            "github_username": gh_data.get("login"),
            "name": gh_data.get("name") or gh_data.get("login"),
            "picture": gh_data.get("avatar_url"),
        }},
        upsert=True,
    )
    from app.repositories import issue_repo
    await issue_repo.invalidate_cache(db, f"prs_personal_{user_id}")
    await issue_repo.invalidate_cache(db, "prs_org")

    return {
        "status": "connected",
        "github_username": gh_data.get("login"),
        "name": gh_data.get("name"),
    }


@router.get("/me")
async def auth_me(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


@router.post("/logout")
async def auth_logout(request: Request, response: Response, db: AsyncIOMotorDatabase = Depends(get_db)):
    token = request.cookies.get("session_token")
    if token:
        await auth_service.logout(db, token)
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out"}


@router.get("/github/login")
async def github_login(platform: str = Query(default="web")):
    """Return the GitHub OAuth authorisation URL."""
    if not settings.github_oauth_client_id or not settings.github_redirect_uri:
        return {
            "configured": False,
            "oauth_url": None,
            "message": "GitHub OAuth not configured in .env. Falling back to Demo Login."
        }
    scope = "repo user"
    oauth_url = (
        "https://github.com/login/oauth/authorize"
        f"?client_id={quote(settings.github_oauth_client_id, safe='')}"
        f"&redirect_uri={quote(settings.github_redirect_uri, safe='')}"
        f"&scope={quote(scope, safe='')}"
        f"&state={quote(platform, safe='')}"
    )
    return {"configured": True, "oauth_url": oauth_url}


@router.get("/github/callback")
async def github_callback(
    code: str,
    request: Request,
    response: Response,
    db: AsyncIOMotorDatabase = Depends(get_db),
    state: str = Query(default="web"),
    mobile: str = Query(default=""),
):
    """Exchange OAuth code → access token → user upsert → session cookie."""
    if not settings.github_oauth_client_id or not settings.github_oauth_client_secret:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured")

    try:
        access_token = await auth_service.exchange_github_code(code)
    except (httpx.HTTPStatusError, ValueError) as exc:
        logger.error("Token exchange failed: %s", exc)
        raise HTTPException(status_code=401, detail="Failed to exchange OAuth code")

    try:
        github_user = await auth_service.get_github_user_info(access_token)
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=401, detail="Failed to fetch GitHub user info")

    user_id = await auth_service.get_or_create_user(db, access_token, github_user)
    session_token = await auth_service.create_session(db, user_id)

    is_https = request.url.scheme == "https"
    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=is_https, samesite="none" if is_https else "lax", path="/", max_age=7 * 24 * 60 * 60,
    )

    if mobile == "true":
        app_url = f"frontend://auth-callback?session_token={session_token}"
        logger.info("Mobile OAuth: redirecting to %s", app_url)
        return RedirectResponse(url=app_url)

    # If accessed directly via browser navigation, redirect to frontend auth-callback with token
    accept_header = request.headers.get("accept", "")
    if "text/html" in accept_header:
        host = request.headers.get("host", "localhost:8000")
        scheme = "https" if is_https else "http"
        web_url = f"{scheme}://{host}/auth-callback?session_token={session_token}"
        logger.info("Web browser OAuth: redirecting to %s", web_url)
        return RedirectResponse(url=web_url)

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    user["session_token"] = session_token
    return user

