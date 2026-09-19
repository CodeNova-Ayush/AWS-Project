import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.codetok
    await db.agent_jobs.update_many(
        {"duration_seconds": {"$exists": False}, "status": "Completed"},
        {"$set": {"duration_seconds": 124, "lines_changed": 42}}
    )
    print("Patched old DB jobs with dummy stats.")
asyncio.run(main())
