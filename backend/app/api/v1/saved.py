"""Saved-issues routes — save, unsave, list, apply, share."""

from fastapi import APIRouter, Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.db import get_db
from app.core.security import require_user
from app.repositories import issue_repo

router = APIRouter(tags=["saved"])


@router.post("/issues/{issue_id}/save")
async def save_issue(
    issue_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user = await require_user(request, db)
    
    # Read optional payload from body if provided
    try:
        body = await request.json()
    except Exception:
        body = None

    if body and isinstance(body, dict) and (body.get("title") or body.get("issue_id")):
        body["issue_id"] = issue_id
        await issue_repo.upsert_issue(db, body)
    else:
        existing_issue = await db.issues.find_one({"issue_id": issue_id})
        if not existing_issue:
            # User saved a GitHub PR/Issue not tracked permanently in MongoDB.
            # Look in github_cache
            cache_docs = await db.github_cache.find({}).to_list(100)
            found_payload = None
            for doc in cache_docs:
                data = doc.get("data", [])
                if isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict) and item.get("issue_id") == issue_id:
                            found_payload = item
                            break
                if found_payload:
                    break
                    
            if found_payload:
                await issue_repo.upsert_issue(db, found_payload)
            else:
                # Minimal fallback document so it won't disappear from bookmarks
                await issue_repo.upsert_issue(db, {
                    "issue_id": issue_id,
                    "title": f"PR #{issue_id.split('_')[-1] if '_' in issue_id else issue_id}",
                    "description": "Saved GitHub Pull Request",
                    "type": "refactor",
                    "severity": "medium",
                    "is_pr": True,
                })
            
    await issue_repo.save_issue(db, user["user_id"], issue_id)
    return {"saved": True}


@router.delete("/issues/{issue_id}/save")
async def unsave_issue(
    issue_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user = await require_user(request, db)
    await issue_repo.unsave_issue(db, user["user_id"], issue_id)
    return {"saved": False}


@router.get("/saved-issues")
async def get_saved_issues(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user = await require_user(request, db)
    saved = await db.saved_issues.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    issue_ids = [s["issue_id"] for s in saved]
    if not issue_ids:
        return []

    issues = await db.issues.find({"issue_id": {"$in": issue_ids}}, {"_id": 0}).to_list(100)
    found_ids = {item["issue_id"] for item in issues}
    missing_ids = [iid for iid in issue_ids if iid not in found_ids]
    if missing_ids:
        cache_docs = await db.github_cache.find({}).to_list(100)
        for doc in cache_docs:
            data = doc.get("data", [])
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and item.get("issue_id") in missing_ids and item.get("issue_id") not in found_ids:
                        issues.append(item)
                        found_ids.add(item["issue_id"])
                        await issue_repo.upsert_issue(db, item)

    return issues


@router.get("/user/saved-ids")
async def get_saved_ids(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user = await require_user(request, db)
    return await issue_repo.get_saved_ids(db, user["user_id"])


@router.post("/issues/{issue_id}/apply")
async def apply_issue(
    issue_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user = await require_user(request, db)
    await issue_repo.apply_issue(db, user["user_id"], issue_id)
    return {"applied": True}


@router.post("/issues/{issue_id}/share")
async def share_issue(issue_id: str):
    return {"share_url": f"/issues/{issue_id}"}
