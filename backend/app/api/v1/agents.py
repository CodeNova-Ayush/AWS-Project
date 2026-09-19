"""Agent routes — assign, list jobs, get trace."""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.db import get_db
from app.core.security import require_user
from app.domain.models import AgentAssignRequest
from app.services import agent_service

router = APIRouter(tags=["agents"])


@router.post("/agents/assign")
async def assign_agent(
    body: AgentAssignRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user = await require_user(request, db)
    return await agent_service.assign_agent(
        db, background_tasks, body.issue_id, body.agent_type, body.repo, user["user_id"]
    )


@router.get("/jobs")
async def get_jobs(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user = await require_user(request, db)
    return await agent_service.list_jobs(db, user["user_id"])


@router.get("/jobs/{job_id}/trace")
async def get_job_trace(
    job_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user = await require_user(request, db)
    job = await agent_service.get_trace(db, job_id, user["user_id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
