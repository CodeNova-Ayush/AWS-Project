"""PR service — fetch, cache-wrap, and action helpers for GitHub PRs/issues."""

import asyncio
import logging
from typing import Any, Callable, List

import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.integrations import github_api, github_app
from app.repositories import issue_repo
from app.core.config import settings

logger = logging.getLogger(__name__)

CACHE_TTL = 300  # 5 minutes
PR_CACHE_TTL = 3600  # 1 hour
ISSUE_CACHE_TTL = 900  # 15 minutes


async def _cached_or_fetch(
    db: AsyncIOMotorDatabase,
    cache_key: str,
    fetch_fn: Callable,
    ttl: int = PR_CACHE_TTL,
    force: bool = False,
) -> Any:
    """Return cached result if fresh, otherwise call fetch_fn and store result."""
    if not force:
        cached = await issue_repo.get_cache(db, cache_key, ttl)
        if cached is not None:
            logger.info("Cache HIT for '%s'", cache_key)
            return cached
    logger.info("Cache %s for '%s'", "FORCE REFRESH" if force else "MISS", cache_key)
    data = await fetch_fn()
    await issue_repo.set_cache(db, cache_key, data)
    return data


async def _enrich_with_agent_traces(
    db: AsyncIOMotorDatabase, issues: List[dict]
) -> List[dict]:
    """If a PR was created by an agent job, attach the agent traces and summary."""
    for issue in issues:
        owner = issue.get("github_owner")
        repo = issue.get("github_repo")
        pr_number = issue.get("github_pr_number")
        if owner and repo and pr_number:
            agent_job = await db.agent_jobs.find_one(
                {"pr_owner": owner, "pr_repo": repo, "pr_number": pr_number},
                {
                    "_id": 0,
                    "job_id": 1,
                    "summary": 1,
                    "traces": 1,
                    "structured_summary": 1,
                    "duration_seconds": 1,
                    "lines_changed": 1,
                    "agent_type": 1,
                },
            )
            if agent_job:
                issue["agent_job_id"] = agent_job.get("job_id")
                issue["agent_summary"] = agent_job.get("summary")
                issue["agent_duration"] = agent_job.get("duration_seconds")
                issue["agent_lines_changed"] = agent_job.get("lines_changed")
                issue["agent_type"] = agent_job.get("agent_type")

                existing_trajectory = issue.get("trajectory_steps", [])

                structured_summary = agent_job.get("structured_summary", [])
                if (
                    structured_summary
                    and isinstance(structured_summary, list)
                    and len(structured_summary) > 0
                ):
                    formatted_traces = []
                    for step in structured_summary:
                        formatted_traces.append(
                            {
                                # structured_summary stores key "text" after normalization
                                "text": step.get("text", step.get("title", "Agent Action")),
                                "phase": step.get("phase", "other"),
                                "details": step.get("details", []),
                            }
                        )
                else:
                    # Cap raw traces to last 30 lines — raw logs can be thousands of lines
                    # and rendering them all freezes the feed. Full logs are on the session page.
                    traces = agent_job.get("traces", [])
                    last_traces = traces[-30:] if len(traces) > 30 else traces
                    formatted_traces = [{"text": t.get("step", "")} for t in last_traces]

                issue["trajectory_steps"] = existing_trajectory + formatted_traces
    return issues


async def fetch_personal_prs(
    db: AsyncIOMotorDatabase, token: str, user_id: str, force: bool = False
) -> List[dict]:
    cache_key = f"prs_personal_{user_id}"

    async def _fetch():
        all_issues = []
        user = await db.users.find_one({"user_id": user_id}) or {}
        username = user.get("github_username") or getattr(settings, "github_username", "") or "iamksr05"
        effective_token = token or user.get("github_access_token") or getattr(settings, "github_token", "")

        # 1. If we have a token, fetch repos directly
        if effective_token:
            try:
                repos = await github_api.fetch_user_repos(effective_token)
                for repo in repos[:10]:
                    owner = repo["owner"]["login"]
                    repo_name = repo["name"]
                    try:
                        prs = await github_api.fetch_repo_prs(
                            owner, repo_name, effective_token, filter_bot=False
                        )
                        for pr in prs[:5]:
                            try:
                                issue = await github_api.convert_pr_to_issue(
                                    pr, owner, repo_name, effective_token
                                )
                                all_issues.append(issue)
                            except Exception:
                                pass
                    except Exception:
                        pass
            except Exception as e:
                logger.warning("Error fetching repos with token: %s", e)

        # 2. If no PRs found from repos or no token, fetch authored PRs directly by username
        if not all_issues and username:
            try:
                user_prs = await github_api.fetch_user_prs_by_username(username, effective_token)
                all_issues.extend(user_prs)
            except Exception as e:
                logger.warning("Error searching PRs for username %s: %s", username, e)

        return all_issues

    result = await _cached_or_fetch(
        db, cache_key, _fetch, ttl=PR_CACHE_TTL, force=force
    )
    result = sorted(result, key=lambda x: x.get("created_at", ""), reverse=True)
    return await _enrich_with_agent_traces(db, result)


async def fetch_org_prs(db: AsyncIOMotorDatabase, force: bool = False) -> List[dict]:
    installation_id = settings.github_app_installation_id
    if not installation_id:
        username = getattr(settings, "github_username", "iamksr05")
        token = getattr(settings, "github_token", "")
        personal_prs = await github_api.fetch_user_prs_by_username(username, token)
        if personal_prs:
            return await _enrich_with_agent_traces(db, personal_prs)
        return await issue_repo.get_all_issues(db)

    async def _fetch():
        token_data = await github_app.get_installation_token(installation_id)
        installation_token = token_data["token"]
        repos = await github_api.fetch_installation_repos(installation_token)
        logger.info("GitHub App has access to %d repos", len(repos))

        async def _fetch_repo(repo):
            owner = repo["owner"]["login"]
            repo_name = repo["name"]
            try:
                prs = await github_api.fetch_repo_prs(
                    owner, repo_name, installation_token, filter_bot=False
                )
                results = []
                for pr in prs[:5]:
                    try:
                        issue = await github_api.convert_pr_to_issue(
                            pr, owner, repo_name, installation_token
                        )
                        results.append(issue)
                    except Exception as exc:
                        logger.warning(
                            "Failed to convert PR #%s from %s/%s: %s",
                            pr["number"],
                            owner,
                            repo_name,
                            exc,
                        )
                return results
            except httpx.HTTPStatusError as exc:
                logger.warning(
                    "Failed to fetch PRs from %s/%s: %s", owner, repo_name, exc
                )
                return []

        batches = await asyncio.gather(*[_fetch_repo(r) for r in repos])
        return [issue for batch in batches for issue in batch]

    result = await _cached_or_fetch(
        db, "prs_org", _fetch, ttl=PR_CACHE_TTL, force=force
    )
    result = sorted(result, key=lambda x: x.get("created_at", ""), reverse=True)
    return await _enrich_with_agent_traces(db, result)


async def fetch_personal_issues(
    db: AsyncIOMotorDatabase, token: str, user_id: str, force: bool = False
) -> List[dict]:
    cache_key = f"issues_personal_{user_id}"

    async def _fetch():
        repos = await github_api.fetch_user_repos(token)
        all_issues = []
        for repo in repos[:10]:
            owner = repo["owner"]["login"]
            repo_name = repo["name"]
            try:
                issues_data = await github_api.fetch_repo_issues(
                    owner, repo_name, token, filter_bot=False
                )
                for issue in issues_data[:10]:
                    try:
                        converted = await github_api.convert_issue_to_codeissue(
                            issue, owner, repo_name, token
                        )
                        all_issues.append(converted)
                    except Exception as exc:
                        logger.error(
                            "Failed to convert issue #%s: %s", issue.get("number"), exc
                        )
            except httpx.HTTPStatusError as exc:
                logger.warning(
                    "Failed to fetch issues from %s/%s: %s", owner, repo_name, exc
                )
        return all_issues

    result = await _cached_or_fetch(
        db, cache_key, _fetch, ttl=ISSUE_CACHE_TTL, force=force
    )
    return sorted(result, key=lambda x: x.get("created_at", ""), reverse=True)


async def fetch_org_issues(db: AsyncIOMotorDatabase, force: bool = False) -> List[dict]:
    installation_id = settings.github_app_installation_id
    if not installation_id:
        raise ValueError("GITHUB_APP_INSTALLATION_ID not configured")

    async def _fetch():
        token_data = await github_app.get_installation_token(installation_id)
        installation_token = token_data["token"]
        repos = await github_api.fetch_installation_repos(installation_token)

        async def _fetch_repo(repo):
            owner = repo["owner"]["login"]
            repo_name = repo["name"]
            try:
                issues_data = await github_api.fetch_repo_issues(
                    owner, repo_name, installation_token, filter_bot=True
                )
                results = []
                for issue in issues_data[:10]:
                    try:
                        converted = await github_api.convert_issue_to_codeissue(
                            issue, owner, repo_name, installation_token
                        )
                        results.append(converted)
                    except Exception as exc:
                        logger.warning(
                            "Failed to convert issue #%s: %s", issue["number"], exc
                        )
                return results
            except httpx.HTTPStatusError as exc:
                logger.warning(
                    "Failed to fetch issues from %s/%s: %s", owner, repo_name, exc
                )
                return []

        batches = await asyncio.gather(*[_fetch_repo(r) for r in repos])
        return [issue for batch in batches for issue in batch]

    result = await _cached_or_fetch(
        db, "issues_org", _fetch, ttl=ISSUE_CACHE_TTL, force=force
    )
    return sorted(result, key=lambda x: x.get("created_at", ""), reverse=True)


def _parse_issue_id(issue_id: str):
    """Parse gh_pr_{owner}_{repo}_{pr_number} → (owner, repo, pr_number)."""
    if not issue_id.startswith("gh_pr_"):
        raise ValueError(
            "Invalid issue_id format. Expected: gh_pr_{owner}_{repo}_{pr_number}"
        )
    parts = issue_id.replace("gh_pr_", "").split("_")
    if len(parts) < 3:
        raise ValueError("Not enough parts in issue_id")
    owner = parts[0]
    pr_number = int(parts[-1])
    repo = "_".join(parts[1:-1])
    return owner, repo, pr_number


def _github_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


async def approve_pr(issue_id: str, token: str) -> dict:
    owner, repo, pr_number = _parse_issue_id(issue_id)
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/reviews",
            headers=_github_headers(token),
            json={"event": "APPROVE", "body": "Approved via CodeTok"},
        )
        resp.raise_for_status()
        data = resp.json()
    return {
        "success": True,
        "message": "PR approved successfully",
        "review_id": data.get("id"),
        "state": data.get("state"),
    }


async def reject_pr(
    issue_id: str, token: str, comment: str = "Changes requested via CodeTok"
) -> dict:
    owner, repo, pr_number = _parse_issue_id(issue_id)
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/reviews",
            headers=_github_headers(token),
            json={"event": "REQUEST_CHANGES", "body": comment},
        )
        resp.raise_for_status()
        data = resp.json()
    return {
        "success": True,
        "message": "Changes requested successfully",
        "review_id": data.get("id"),
        "state": data.get("state"),
    }


async def merge_pr(
    issue_id: str,
    token: str,
    commit_title: str = "",
    commit_message: str = "Merged via CodeTok",
    merge_method: str = "merge",
) -> dict:
    owner, repo, pr_number = _parse_issue_id(issue_id)
    payload = {"commit_message": commit_message, "merge_method": merge_method}
    if commit_title:
        payload["commit_title"] = commit_title
    async with httpx.AsyncClient() as client:
        resp = await client.put(
            f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/merge",
            headers=_github_headers(token),
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
    return {
        "success": True,
        "message": "PR merged successfully",
        "sha": data.get("sha"),
        "merged": data.get("merged", True),
    }
