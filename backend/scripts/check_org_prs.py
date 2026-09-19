import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from github_app import get_installation_token
from github_api import fetch_installation_repos, fetch_repo_prs

async def main():
    load_dotenv(Path(__file__).parent.parent / '.env')
    installation_id = os.environ.get("GITHUB_APP_INSTALLATION_ID")
    
    token_data = await get_installation_token(installation_id)
    token = token_data['token']
    
    repos = await fetch_installation_repos(token)
    print(f"Found {len(repos)} repos")
    
    for repo in repos:
        owner = repo['owner']['login']
        name = repo['name']
        prs = await fetch_repo_prs(owner, name, token, filter_bot=False)
        print(f"\nRepo: {owner}/{name} - Found {len(prs)} PRs")
        for pr in prs:
             print(f"  - PR #{pr['number']}: {pr['title']} (Author: {pr['user']['login']})")

if __name__ == "__main__":
    asyncio.run(main())
