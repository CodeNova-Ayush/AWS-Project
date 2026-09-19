import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import sys

async def main():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.codetok
    
    # Simulate _enrich_with_agent_traces on the exact PR that we know has a job
    # "Flowbee-AI-Assistant", "CDC_system", pr=7
    agent_job = await db.agent_jobs.find_one(
        {"pr_owner": "Flowbee-AI-Assistant", "pr_repo": "CDC_system", "pr_number": 7},
        {"_id": 0, "job_id": 1, "summary": 1, "traces": 1, "structured_summary": 1}
    )
    
    if agent_job:
        print("Found job:", agent_job.get("job_id"))
        print("Structured summary:", agent_job.get("structured_summary"))
    else:
        print("No job matched pr_owner=Flowbee-AI-Assistant, pr_repo=CDC_system, pr_number=7")
        
asyncio.run(main())
