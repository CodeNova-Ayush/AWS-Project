"""
GitHub App Authentication Module
Handles JWT generation and installation token exchange for GitHub App integration
"""

import os
import time
import jwt
from pathlib import Path
import httpx
from typing import Dict
from dotenv import load_dotenv

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Environment variables
GITHUB_APP_ID = os.getenv("GITHUB_APP_ID")
GITHUB_APP_PRIVATE_KEY_PATH = os.getenv("GITHUB_APP_PRIVATE_KEY_PATH", "github-app-private-key.pem")


def generate_github_app_jwt() -> str:
    """
    Generate JWT for GitHub App authentication

    Returns:
        str: JWT token valid for 10 minutes

    Raises:
        ValueError: If GITHUB_APP_ID is not set or private key file not found
    """
    if not GITHUB_APP_ID:
        raise ValueError("GITHUB_APP_ID environment variable not set")

    # Resolve private key path
    private_key_path = Path(GITHUB_APP_PRIVATE_KEY_PATH)
    if not private_key_path.is_absolute():
        # If relative, resolve from backend directory
        private_key_path = Path(__file__).parent / GITHUB_APP_PRIVATE_KEY_PATH

    if not private_key_path.exists():
        raise ValueError(f"Private key file not found: {private_key_path}")

    # Read private key
    with open(private_key_path, 'r') as key_file:
        private_key = key_file.read()

    # Create JWT payload
    # GitHub requires:
    # - iat: issued at time (current time)
    # - exp: expiration time (max 10 minutes from iat)
    # - iss: GitHub App ID
    now = int(time.time())
    payload = {
        'iat': now,
        'exp': now + (10 * 60),  # Expires in 10 minutes
        'iss': GITHUB_APP_ID
    }

    # Generate JWT using RS256 algorithm
    token = jwt.encode(payload, private_key, algorithm='RS256')

    return token


async def get_installation_token(installation_id: str) -> Dict[str, str]:
    """
    Exchange GitHub App JWT for installation access token

    Args:
        installation_id: The installation ID for the GitHub App

    Returns:
        Dict with 'token', 'expires_at', and 'permissions' keys

    Raises:
        httpx.HTTPStatusError: If GitHub API request fails
        ValueError: If JWT generation fails
    """
    # Generate JWT for authentication
    jwt_token = generate_github_app_jwt()

    # Exchange JWT for installation token
    url = f"https://api.github.com/app/installations/{installation_id}/access_tokens"
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {jwt_token}",
        "X-GitHub-Api-Version": "2022-11-28"
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers)
        response.raise_for_status()
        data = response.json()

    return {
        'token': data['token'],
        'expires_at': data['expires_at'],
        'permissions': data.get('permissions', {}),
        'repository_selection': data.get('repository_selection', 'all')
    }
