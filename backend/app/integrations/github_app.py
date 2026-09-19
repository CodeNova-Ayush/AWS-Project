"""
GitHub App Authentication Module.
Moved from root github_app.py.
Adds a simple in-process token cache so we don't generate a new installation token
on every request (installation tokens are valid for ~1 hour).
"""

import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional

import httpx
import jwt

from app.core.config import settings

# ──── In-process installation token cache ────
_cached_token: Optional[str] = None
_cached_token_expires_at: float = 0.0  # Unix timestamp
_TOKEN_REFRESH_BUFFER = 60  # Refresh 60 s before expiry


def generate_github_app_jwt() -> str:
    """Generate a short-lived JWT for GitHub App authentication (RS256, 10-min TTL)."""
    app_id = settings.github_app_id
    if not app_id:
        raise ValueError("GITHUB_APP_ID environment variable not set")

    key_path = Path(settings.github_app_private_key_path)
    if not key_path.is_absolute():
        key_path = Path(__file__).parent.parent.parent / settings.github_app_private_key_path

    if not key_path.exists():
        raise ValueError(f"Private key file not found: {key_path}")

    private_key = key_path.read_text()
    now = int(time.time())
    payload = {"iat": now, "exp": now + 600, "iss": app_id}
    return jwt.encode(payload, private_key, algorithm="RS256")


async def get_installation_token(installation_id: str) -> Dict[str, str]:
    """
    Exchange GitHub App JWT for an installation access token.
    Cached in-process until _TOKEN_REFRESH_BUFFER seconds before expiry.
    """
    global _cached_token, _cached_token_expires_at

    now_ts = time.time()
    if _cached_token and now_ts < (_cached_token_expires_at - _TOKEN_REFRESH_BUFFER):
        return {
            "token": _cached_token,
            "expires_at": datetime.fromtimestamp(
                _cached_token_expires_at, tz=timezone.utc
            ).isoformat(),
            "permissions": {},
            "repository_selection": "all",
        }

    jwt_token = generate_github_app_jwt()
    url = f"https://api.github.com/app/installations/{installation_id}/access_tokens"
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {jwt_token}",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers)
        response.raise_for_status()
        data = response.json()

    # Cache the token
    _cached_token = data["token"]
    expires_dt = datetime.fromisoformat(data["expires_at"].replace("Z", "+00:00"))
    _cached_token_expires_at = expires_dt.timestamp()

    return {
        "token": data["token"],
        "expires_at": data["expires_at"],
        "permissions": data.get("permissions", {}),
        "repository_selection": data.get("repository_selection", "all"),
    }
