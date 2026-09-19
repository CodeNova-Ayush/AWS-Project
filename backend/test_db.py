import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.codetok
    latest = await db.agent_jobs.find_one({}, sort=[("_id", -1)])
    if latest:
        print("JobID:", latest.get("job_id"))
        print("Has structured_summary:", "structured_summary" in latest)
        if "structured_summary" in latest:
            print(latest["structured_summary"])
    else:
        print("No jobs found")
        
asyncio.run(main())
