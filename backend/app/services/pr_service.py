"""PR service — fetch, cache-wrap, and action helpers for GitHub PRs/issues."""

import asyncio
import logging
from typing import Any, Callable, List, Optional

import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.integrations import github_api, github_app
from app.repositories import issue_repo
from app.core.config import settings

logger = logging.getLogger(__name__)

CACHE_TTL = 30  # 30 seconds
PR_CACHE_TTL = 30  # 30 seconds
ISSUE_CACHE_TTL = 30  # 30 seconds


async def _convert_prs_parallel(
    prs: List[dict], owner: str, repo_name: str, token: str, limit: int = 30
) -> List[dict]:
    """Convert open pull requests to CodeTok issue cards concurrently."""
    prs_to_process = [
        pr for pr in prs[:limit]
        if pr.get("state") == "open" and not pr.get("merged_at") and not pr.get("merged")
    ]
    if not prs_to_process:
        return []
    sem = asyncio.Semaphore(10)

    async def _safe_conv(pr):
        async with sem:
            try:
                return await github_api.convert_pr_to_issue(pr, owner, repo_name, token)
            except Exception as ex:
                logger.warning("Failed to convert PR #%s in %s/%s: %s", pr.get("number"), owner, repo_name, ex)
                return None

    converted = await asyncio.gather(*[_safe_conv(p) for p in prs_to_process])
    return [c for c in converted if c is not None]


async def _filter_out_merged_prs(db: AsyncIOMotorDatabase, issues: List[dict]) -> List[dict]:
    """Strictly filter out any PRs that are closed, merged on GitHub, or merged in local jobs/issues."""
    merged_jobs = await db.agent_jobs.find(
        {"$or": [{"merged": True}, {"status": "Merged"}]},
        {"pr_owner": 1, "pr_repo": 1, "pr_number": 1, "_id": 0}
    ).to_list(100)
    merged_pr_set = {
        (j.get("pr_owner"), j.get("pr_repo"), j.get("pr_number"))
        for j in merged_jobs if j.get("pr_number")
    }
    merged_issues = await db.issues.find(
        {"$or": [{"status": "Merged"}, {"merged": True}]},
        {"issue_id": 1, "_id": 0}
    ).to_list(100)
    merged_issue_ids = {i.get("issue_id") for i in merged_issues if i.get("issue_id")}

    filtered_issues = []
    for iss in issues:
        if (
            iss.get("github_state") != "open"
            or iss.get("merged")
            or iss.get("merged_at")
            or iss.get("status") == "Merged"
        ):
            continue
        pr_key = (iss.get("github_owner"), iss.get("github_repo"), iss.get("github_pr_number"))
        if pr_key in merged_pr_set or iss.get("issue_id") in merged_issue_ids:
            continue
        filtered_issues.append(iss)

    return filtered_issues



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
    if not user_id or user_id == "user_demo_local":
        # Unauthenticated / demo mode: return sample issues
        return await issue_repo.get_all_issues(db)

    cache_key = f"prs_personal_{user_id}"

    async def _fetch():
        all_issues = []
        user = await db.users.find_one({"user_id": user_id}) or {}
        username = user.get("github_username")
        effective_token = token or user.get("github_access_token")

        if not effective_token and not username:
            return []

        # 1. If we have a token, fetch repos directly for this user
        if effective_token:
            try:
                repos = await github_api.fetch_user_repos(effective_token)
                async def _process_repo(repo):
                    owner = repo.get("owner", {}).get("login")
                    repo_name = repo.get("name")
                    if not owner or not repo_name:
                        return []
                    try:
                        prs = await github_api.fetch_repo_prs(
                            owner, repo_name, effective_token, filter_bot=False
                        )
                        return await _convert_prs_parallel(prs, owner, repo_name, effective_token, limit=30)
                    except Exception:
                        return []

                batches = await asyncio.gather(*[_process_repo(r) for r in repos[:15]])
                for batch in batches:
                    all_issues.extend(batch)
            except Exception as e:
                logger.warning("Error fetching repos with token for user %s: %s", username, e)

        # 2. Also search authored PRs directly for this user on GitHub
        if username:
            try:
                user_prs = await github_api.fetch_user_prs_by_username(username, effective_token or "")
                existing_ids = {i["issue_id"] for i in all_issues}
                for pr in user_prs:
                    if pr["issue_id"] not in existing_ids:
                        all_issues.append(pr)
            except Exception as e:
                logger.warning("Error searching authored PRs for %s: %s", username, e)

        return await _filter_out_merged_prs(db, all_issues)

    result = await _cached_or_fetch(
        db, cache_key, _fetch, ttl=PR_CACHE_TTL, force=force
    )
    result = sorted(result, key=lambda x: x.get("created_at", ""), reverse=True)
    return await _enrich_with_agent_traces(db, result)


async def fetch_org_prs(
    db: AsyncIOMotorDatabase,
    token: str = "",
    user_id: str = "",
    force: bool = False,
) -> List[dict]:
    installation_id = settings.github_app_installation_id
    if installation_id:
        async def _fetch_app():
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
                    return await _convert_prs_parallel(prs, owner, repo_name, installation_token, limit=30)
                except httpx.HTTPStatusError as exc:
                    logger.warning(
                        "Failed to fetch PRs from %s/%s: %s", owner, repo_name, exc
                    )
                    return []

            batches = await asyncio.gather(*[_fetch_repo(r) for r in repos])
            app_issues = [issue for batch in batches for issue in batch]
            return await _filter_out_merged_prs(db, app_issues)

        result = await _cached_or_fetch(
            db, "prs_org_app", _fetch_app, ttl=PR_CACHE_TTL, force=force
        )
        result = sorted(result, key=lambda x: x.get("created_at", ""), reverse=True)
        return await _enrich_with_agent_traces(db, result)

    # When no GitHub App installation is configured:
    # If a user is logged in, fetch PRs from their organization/collaborative repos or review requests
    if user_id and user_id != "user_demo_local":
        cache_key = f"prs_org_{user_id}"

        async def _fetch_user_org():
            user = await db.users.find_one({"user_id": user_id}) or {}
            username = user.get("github_username")
            effective_token = token or user.get("github_access_token")

            if not effective_token and not username:
                return []

            org_issues = []
            if effective_token:
                try:
                    repos = await github_api.fetch_user_repos(effective_token)
                    # Filter for repos where owner is an organization or team member (not personal repo)
                    org_repos = [r for r in repos if username and r.get("owner", {}).get("login") != username]
                    async def _process_org_repo(repo):
                        owner = repo.get("owner", {}).get("login")
                        repo_name = repo.get("name")
                        if not owner or not repo_name:
                            return []
                        try:
                            prs = await github_api.fetch_repo_prs(
                                owner, repo_name, effective_token, filter_bot=False
                            )
                            return await _convert_prs_parallel(prs, owner, repo_name, effective_token, limit=30)
                        except Exception:
                            return []

                    batches = await asyncio.gather(*[_process_org_repo(r) for r in org_repos[:15]])
                    for batch in batches:
                        org_issues.extend(batch)
                except Exception as e:
                    logger.warning("Error fetching org repos for user %s: %s", username, e)

            # Also find PRs where review is requested from this user
            if username:
                try:
                    review_prs = await github_api.fetch_user_review_requested_prs(username, effective_token or "")
                    existing_ids = {i["issue_id"] for i in org_issues}
                    for pr in review_prs:
                        if pr["issue_id"] not in existing_ids:
                            org_issues.append(pr)
                except Exception as e:
                    logger.warning("Error fetching review requested PRs for %s: %s", username, e)

            return await _filter_out_merged_prs(db, org_issues)

        result = await _cached_or_fetch(
            db, cache_key, _fetch_user_org, ttl=PR_CACHE_TTL, force=force
        )
        result = sorted(result, key=lambda x: x.get("created_at", ""), reverse=True)
        return await _enrich_with_agent_traces(db, result)

    # Unauthenticated / guest visitor: return sample issues
    return await issue_repo.get_all_issues(db)


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


async def fetch_org_issues(
    db: AsyncIOMotorDatabase,
    force: bool = False,
    token: Optional[str] = None,
    user_id: Optional[str] = None,
) -> List[dict]:
    installation_id = settings.github_app_installation_id
    if not installation_id:
        # Fall back to personal or seeded issues if GitHub App is not configured
        if token and user_id:
            return await fetch_personal_issues(db, token=token, user_id=user_id, force=force)
        return await issue_repo.get_all_issues(db)

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


async def _resolve_pr_info(
    issue_id: str, db: Optional[AsyncIOMotorDatabase] = None
) -> tuple[str, str, int]:
    """Resolve (owner, repo, pr_number) from issue_id or DB lookup."""
    # 1. DB lookup if db instance provided
    if db is not None:
        try:
            doc = await db.issues.find_one({"issue_id": issue_id})
            if doc:
                owner = doc.get("github_owner")
                repo = doc.get("github_repo")
                pr_num = doc.get("github_pr_number") or doc.get("github_issue_number")
                if owner and repo and pr_num:
                    return str(owner), str(repo), int(pr_num)
        except Exception as exc:
            logger.warning("DB lookup failed in _resolve_pr_info: %s", exc)

    # 2. String parsing for standard gh_pr_ or gh_issue_ prefix
    if issue_id.startswith("gh_pr_") or issue_id.startswith("gh_issue_"):
        clean = issue_id.replace("gh_pr_", "").replace("gh_issue_", "")
        parts = clean.split("_")
        if len(parts) >= 3:
            owner = parts[0]
            try:
                pr_number = int(parts[-1])
                repo = "_".join(parts[1:-1])
                return owner, repo, pr_number
            except ValueError:
                pass

    # 3. String parsing for owner/repo format
    if "/" in issue_id:
        parts = issue_id.strip("/").split("/")
        if len(parts) >= 3:
            owner = parts[0]
            repo = parts[1]
            try:
                pr_number = int(parts[-1])
                return owner, repo, pr_number
            except ValueError:
                pass

    # 4. Fallback to classic _parse_issue_id if it matches
    return _parse_issue_id(issue_id)


def _parse_issue_id(issue_id: str):
    """Parse gh_pr_{owner}_{repo}_{pr_number} → (owner, repo, pr_number)."""
    if not issue_id.startswith("gh_pr_"):
        raise ValueError(
            f"Invalid issue_id format '{issue_id}'. Expected: gh_pr_{{owner}}_{{repo}}_{{pr_number}}"
        )
    parts = issue_id.replace("gh_pr_", "").split("_")
    if len(parts) < 3:
        raise ValueError(f"Not enough parts in issue_id '{issue_id}'")
    owner = parts[0]
    try:
        pr_number = int(parts[-1])
    except ValueError:
        raise ValueError(f"Invalid PR number in issue_id '{issue_id}'")
    repo = "_".join(parts[1:-1])
    return owner, repo, pr_number


def _github_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


async def approve_pr(
    issue_id: str, token: str, db: Optional[AsyncIOMotorDatabase] = None
) -> dict:
    owner, repo, pr_number = await _resolve_pr_info(issue_id, db)
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/reviews",
            headers=_github_headers(token),
            json={"event": "APPROVE", "body": "Approved via MergeDeck"},
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
    issue_id: str,
    token: str,
    comment: str = "Changes requested via MergeDeck",
    db: Optional[AsyncIOMotorDatabase] = None,
) -> dict:
    owner, repo, pr_number = await _resolve_pr_info(issue_id, db)
    async with httpx.AsyncClient(timeout=30.0) as client:
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
    commit_message: str = "Merged via MergeDeck",
    merge_method: str = "merge",
    db: Optional[AsyncIOMotorDatabase] = None,
) -> dict:
    owner, repo, pr_number = await _resolve_pr_info(issue_id, db)
    payload = {"commit_message": commit_message, "merge_method": merge_method}
    if commit_title:
        payload["commit_title"] = commit_title

    headers = _github_headers(token)
    merge_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/merge"

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.put(merge_url, headers=headers, json=payload)
        
        # If the repository disallows this specific merge method, try sensible fallbacks
        if resp.status_code == 405 and "not allowed" in resp.text.lower():
            for fallback_method in ["squash", "merge", "rebase"]:
                if fallback_method != merge_method:
                    fallback_payload = dict(payload, merge_method=fallback_method)
                    fb_resp = await client.put(merge_url, headers=headers, json=fallback_payload)
                    if fb_resp.is_success:
                        resp = fb_resp
                        break

        resp.raise_for_status()
        data = resp.json()

    sha = data.get("sha", "")
    merged = data.get("merged", True)

    if db is not None:
        try:
            await db.issues.update_one(
                {"issue_id": issue_id},
                {"$set": {"status": "Merged", "merged": True, "github_state": "closed", "merge_commit_sha": sha}},
            )
            await issue_repo.invalidate_all_pr_caches(db)
        except Exception as e:
            logger.warning("Failed to update issue status in DB for %s: %s", issue_id, e)

    return {
        "success": True,
        "message": "PR merged successfully on GitHub",
        "sha": sha,
        "merged": merged,
    }
