"""PR action routes — approve, reject, merge."""

import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.db import get_db
from app.core.security import require_user
from app.services import pr_service
from app.repositories import issue_repo

router = APIRouter(prefix="/prs", tags=["prs"])
logger = logging.getLogger(__name__)


async def _invalidate_pr_caches(db, user: dict) -> None:
    """Bust both org and personal PR caches so the next fetch gets live data."""
    user_id = user.get("user_id", "")
    await issue_repo.invalidate_cache(db, "prs_org")
    await issue_repo.invalidate_cache(db, f"prs_personal_{user_id}")


def _require_github_token(user: dict) -> str:
    token = user.get("github_access_token")
    if not token:
        raise HTTPException(status_code=401, detail="GitHub account not connected")
    return token


@router.post("/{issue_id}/approve")
async def approve_pr(
    issue_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user = await require_user(request, db)
    token = _require_github_token(user)
    try:
        result = await pr_service.approve_pr(issue_id, token)
        await _invalidate_pr_caches(db, user)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except httpx.HTTPStatusError as exc:
        error_detail = exc.response.json() if exc.response else {}
        raise HTTPException(
            status_code=exc.response.status_code if exc.response else 502,
            detail=error_detail.get("message", "Failed to approve PR"),
        )


@router.post("/{issue_id}/reject")
async def reject_pr(
    issue_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user = await require_user(request, db)
    token = _require_github_token(user)
    body_data = {}
    if request.headers.get("content-type") == "application/json":
        body_data = await request.json()
    comment = body_data.get("comment", "Changes requested via MergeDeck")
    try:
        result = await pr_service.reject_pr(issue_id, token, comment)
        await _invalidate_pr_caches(db, user)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except httpx.HTTPStatusError as exc:
        error_detail = exc.response.json() if exc.response else {}
        raise HTTPException(
            status_code=exc.response.status_code if exc.response else 502,
            detail=error_detail.get("message", "Failed to request changes"),
        )


@router.post("/{issue_id}/merge")
async def merge_pr(
    issue_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user = await require_user(request, db)
    token = _require_github_token(user)
    body_data = {}
    if request.headers.get("content-type") == "application/json":
        body_data = await request.json()
    try:
        result = await pr_service.merge_pr(
            issue_id,
            token,
            commit_title=body_data.get("commit_title", ""),
            commit_message=body_data.get("commit_message", "Merged via MergeDeck"),
            merge_method=body_data.get("merge_method", "merge"),
        )
        await _invalidate_pr_caches(db, user)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except httpx.HTTPStatusError as exc:
        error_detail = exc.response.json() if exc.response else {}
        raise HTTPException(
            status_code=exc.response.status_code if exc.response else 502,
            detail=error_detail.get("message", "Failed to merge PR"),
        )


@router.post("/merge-all")
async def merge_all_prs(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Bulk merge multiple PRs by issue_ids."""
    user = await require_user(request, db)
    token = _require_github_token(user)
    body_data = {}
    if request.headers.get("content-type") == "application/json":
        body_data = await request.json()
    
    issue_ids = body_data.get("issue_ids", [])
    merge_method = body_data.get("merge_method", "squash")
    
    results = []
    for issue_id in issue_ids:
        try:
            res = await pr_service.merge_pr(
                issue_id,
                token,
                commit_message="Bulk merged via MergeDeck",
                merge_method=merge_method,
            )
            results.append({"issue_id": issue_id, "success": True, "res": res})
        except Exception as e:
            results.append({"issue_id": issue_id, "success": False, "error": str(e)})
            
    await _invalidate_pr_caches(db, user)
    return {
        "success": True,
        "total": len(issue_ids),
        "merged_count": sum(1 for r in results if r["success"]),
        "results": results,
    }
