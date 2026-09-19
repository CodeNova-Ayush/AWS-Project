import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.codetok
    
    latest = await db.agent_jobs.find_one({"pr_owner": "Flowbee-AI-Assistant", "pr_repo": "CDC_system", "pr_number": 7})
    if latest:
        print("Patching correct job:", latest["job_id"])
        structured = [
            {"title": "Analyzed Repository", "details": ["Scanning files...", "Found target.py"]},
            {"title": "Implemented Fix", "details": ["Editing target.py", "Running tests", "Tests passed"]}
        ]
        await db.agent_jobs.update_one({"_id": latest["_id"]}, {"$set": {"structured_summary": structured}})
        print("Patched.")
    else:
        print("No job matched pr=7 finding fallback.")
        
asyncio.run(main())
