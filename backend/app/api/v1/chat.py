"""Chat routes — history and send."""

from fastapi import APIRouter, Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.db import get_db
from app.core.security import require_user
from app.domain.models import ChatMessageIn
from app.repositories import issue_repo
from app.services import chat_service

router = APIRouter(tags=["chat"])


@router.get("/issues/{issue_id}/chat")
async def get_chat_history(
    issue_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user = await require_user(request, db)
    return await chat_service.get_history(db, issue_id, user["user_id"])


@router.post("/issues/{issue_id}/chat")
async def send_chat_message(
    issue_id: str,
    body: ChatMessageIn,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user = await require_user(request, db)
    # Try DB first; fall back to context sent from frontend (e.g. live GitHub PRs not in DB)
    issue = await issue_repo.get_issue_by_id(db, issue_id)
    if not issue:
        if body.issue_context:
            issue = body.issue_context
        else:
            raise HTTPException(status_code=404, detail="Issue not found")
    return await chat_service.send_message(db, issue_id, user["user_id"], body.message, issue)
