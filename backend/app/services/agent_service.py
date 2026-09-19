"""Agent service — job creation, listing, and trace retrieval."""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories import job_repo


async def assign_agent(
    db: AsyncIOMotorDatabase,
    background_tasks: BackgroundTasks,
    issue_id: str,
    agent_type: str,
    repo: str,
    user_id: str,
) -> dict:
    """Create a job record and dispatch the background worker."""
    # Import here to avoid circular dependency with agent_manager at module load
    from agent_manager import run_agent_job

    job_id = f"job_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    job_entry = {
        "job_id": job_id,
        "issue_id": issue_id,
        "agent_type": agent_type,
        "repo": repo,
        "status": "Pending",
        "user_id": user_id,
        "created_at": now,
        "updated_at": now,
        "traces": [],
        "summary": None,
        "follow_new_pr_format": True,
    }
    await job_repo.create_job(db, job_entry)
    background_tasks.add_task(run_agent_job, db, job_id, issue_id, agent_type, repo, user_id)
    return {"message": "Agent job started", "job_id": job_id}


async def list_jobs(db: AsyncIOMotorDatabase, user_id: str) -> List[dict]:
    return await job_repo.list_jobs_by_user(db, user_id)


async def get_trace(
    db: AsyncIOMotorDatabase, job_id: str, user_id: str
) -> Optional[dict]:
    """Return job with traces attached, or None if not found / not owned by user."""
    job = await db.agent_jobs.find_one(
        {"job_id": job_id, "user_id": user_id}, {"_id": 0}
    )
    if not job:
        return None
    traces = await job_repo.get_traces(db, job_id)
    job["traces"] = traces
    return job
