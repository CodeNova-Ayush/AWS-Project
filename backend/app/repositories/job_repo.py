from datetime import datetime, timezone
from typing import List, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase


async def create_job(db: AsyncIOMotorDatabase, job_data: dict) -> None:
    await db.agent_jobs.insert_one(job_data)


async def get_job(db: AsyncIOMotorDatabase, job_id: str) -> Optional[dict]:
    return await db.agent_jobs.find_one({"job_id": job_id}, {"_id": 0})


async def list_jobs_by_user(db: AsyncIOMotorDatabase, user_id: str) -> List[dict]:
    return (
        await db.agent_jobs.find({"user_id": user_id}, {"_id": 0, "traces": 0})
        .sort("created_at", -1)
        .to_list(100)
    )


async def update_job_status(
    db: AsyncIOMotorDatabase, job_id: str, status: str
) -> None:
    await db.agent_jobs.update_one(
        {"job_id": job_id},
        {
            "$set": {
                "status": status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )


async def get_traces(db: AsyncIOMotorDatabase, job_id: str) -> List[dict]:
    return (
        await db.agent_traces.find({"job_id": job_id}, {"_id": 0})
        .sort("timestamp", 1)
        .to_list(1000)
    )


async def append_trace(db: AsyncIOMotorDatabase, job_id: str, step: str) -> None:
    trace_entry = {
        "job_id": job_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "step": step,
    }
    await db.agent_traces.insert_one(trace_entry)
    await db.agent_jobs.update_one(
        {"job_id": job_id},
        {"$push": {"traces": trace_entry}},
    )
