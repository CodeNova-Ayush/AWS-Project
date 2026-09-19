import asyncio
import os
import sys
import httpx
from pathlib import Path

async def main():
    print("Fetching PRs from local API...")
    url = "http://localhost:8000/api/prs/org"
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(url, timeout=30.0)
            res.raise_for_status()
            data = res.json()
            print(f"Status Code: {res.status_code}")
            print(f"Total PRs fetched: {len(data)}")
            for item in data:
                print(f"- [{item['project']}] {item['title']} ({item['issue_id']})")
        except Exception as e:
            print(f"Error checking endpoint: {e}")

if __name__ == "__main__":
    asyncio.run(main())
