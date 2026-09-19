"""
GitHub API Integration Module
Handles fetching repos, PRs, files, and converting GitHub data to CodeTok format.
Moved from root github_api.py — config sourced from app.core.config.settings.
"""

import httpx
from typing import List, Dict


def _get_headers(token: str = "") -> dict:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "CodeTok-App",
    }
    if token and str(token).strip():
        headers["Authorization"] = f"Bearer {str(token).strip()}"
    return headers


async def fetch_user_repos(access_token: str) -> List[Dict]:
    headers = _get_headers(access_token)
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.github.com/user/repos",
            headers=headers,
            params={
                "affiliation": "owner,collaborator",
                "sort": "updated",
                "per_page": 100,
            },
        )
        response.raise_for_status()
        return response.json()


async def fetch_installation_repos(installation_token: str) -> List[Dict]:
    headers = _get_headers(installation_token)
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.github.com/installation/repositories",
            headers=headers,
            params={"per_page": 100},
        )
        response.raise_for_status()
        data = response.json()
        return data.get("repositories", [])


async def fetch_repo_prs(
    owner: str, repo: str, token: str, filter_bot: bool = True
) -> List[Dict]:
    headers = _get_headers(token)
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/pulls",
            headers=headers,
            params={
                "state": "open",
                "sort": "updated",
                "direction": "desc",
                "per_page": 50,
            },
        )
        response.raise_for_status()
        prs = response.json()

    if filter_bot:
        prs = [pr for pr in prs if pr.get("user", {}).get("type") != "Bot"]
    return prs


async def fetch_user_prs_by_username(username: str, token: str = "") -> List[Dict]:
    """Search GitHub for PRs authored by a given user and convert to CodeTok issue cards."""
    headers = _get_headers(token)
    results = []
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(
                "https://api.github.com/search/issues",
                headers=headers,
                params={
                    "q": f"is:pr author:{username}",
                    "sort": "updated",
                    "order": "desc",
                    "per_page": 20,
                },
            )
            if response.status_code != 200:
                return []
            items = response.json().get("items", [])
        except Exception:
            return []

    for item in items[:15]:
        pr_api_url = item.get("pull_request", {}).get("url")
        if not pr_api_url:
            continue
        try:
            repo_url = item.get("repository_url", "")
            parts = repo_url.split("/")
            owner, repo_name = parts[-2], parts[-1]
            async with httpx.AsyncClient(timeout=10.0) as client:
                pr_resp = await client.get(pr_api_url, headers=headers)
                if pr_resp.status_code != 200:
                    continue
                pr_data = pr_resp.json()
            issue = await convert_pr_to_issue(pr_data, owner, repo_name, token)
            results.append(issue)
        except Exception:
            continue
    return results


async def fetch_repo_issues(
    owner: str, repo: str, token: str, filter_bot: bool = True
) -> List[Dict]:
    headers = _get_headers(token)
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/issues",
            headers=headers,
            params={
                "state": "open",
                "sort": "updated",
                "direction": "desc",
                "per_page": 50,
            },
        )
        response.raise_for_status()
        issues = response.json()

    # GitHub /issues also returns PRs — strip them out
    issues = [i for i in issues if "pull_request" not in i]
    if filter_bot:
        issues = [i for i in issues if i.get("user", {}).get("type") != "Bot"]
    return issues


async def fetch_pr_files(
    owner: str, repo: str, pr_number: int, token: str
) -> List[Dict]:
    headers = _get_headers(token)
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/files",
            headers=headers,
            params={"per_page": 100},
        )
        response.raise_for_status()
        return response.json()


async def fetch_pr_details(owner: str, repo: str, pr_number: int, token: str) -> Dict:
    """Fetch complete PR object including mergeable, mergeable_state, additions, deletions, base, head."""
    headers = _get_headers(token)
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}",
            headers=headers,
        )
        response.raise_for_status()
        return response.json()


async def fetch_pr_check_runs(owner: str, repo: str, head_sha: str, token: str) -> List[Dict]:
    """Fetch CI/CD check runs for a commit SHA."""
    if not head_sha:
        return []
    headers = _get_headers(token)
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/commits/{head_sha}/check-runs",
                headers=headers,
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("check_runs", [])
    except Exception:
        pass
    return []


def parse_diff_to_lines(patch: str) -> List[Dict]:
    if not patch:
        return []
    diff_lines = []
    for line in patch.split("\n"):
        if not line:
            continue
        if line.startswith("@@") or line.startswith("+++") or line.startswith("---"):
            continue
        if line.startswith("+"):
            diff_lines.append({"type": "add", "content": line[1:]})
        elif line.startswith("-"):
            diff_lines.append({"type": "del", "content": line[1:]})
        else:
            diff_lines.append(
                {
                    "type": "context",
                    "content": line[1:] if line.startswith(" ") else line,
                }
            )
    return diff_lines


def detect_language_from_filename(filename: str) -> str:
    extension_map = {
        ".js": "javascript",
        ".jsx": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".py": "python",
        ".java": "java",
        ".kt": "kotlin",
        ".swift": "swift",
        ".go": "go",
        ".rs": "rust",
        ".c": "c",
        ".cpp": "cpp",
        ".cc": "cpp",
        ".cxx": "cpp",
        ".h": "c",
        ".hpp": "cpp",
        ".cs": "csharp",
        ".rb": "ruby",
        ".php": "php",
        ".html": "html",
        ".css": "css",
        ".scss": "scss",
        ".sass": "sass",
        ".vue": "vue",
        ".sql": "sql",
        ".sh": "shell",
        ".bash": "shell",
        ".yaml": "yaml",
        ".yml": "yaml",
        ".json": "json",
        ".xml": "xml",
        ".md": "markdown",
        ".r": "r",
        ".dart": "dart",
        ".scala": "scala",
        ".clj": "clojure",
        ".ex": "elixir",
        ".exs": "elixir",
        ".erl": "erlang",
        ".hs": "haskell",
        ".lua": "lua",
        ".pl": "perl",
        ".m": "objective-c",
        ".mm": "objective-c",
    }
    if "." in filename:
        ext = "." + filename.rsplit(".", 1)[-1].lower()
        return extension_map.get(ext, "plaintext")
    return "plaintext"


async def convert_pr_to_issue(pr: Dict, owner: str, repo: str, token: str) -> Dict:
    pr_number = pr["number"]
    issue_id = f"gh_pr_{owner}_{repo}_{pr_number}"

    files = await fetch_pr_files(owner, repo, pr_number, token)
    all_diff_lines = []
    primary_language = "plaintext"

    if files:
        primary_language = detect_language_from_filename(files[0].get("filename", ""))
        for file in files[:3]:
            patch = file.get("patch", "")
            if patch:
                all_diff_lines.append(
                    {"type": "context", "content": f"// File: {file['filename']}"}
                )
                all_diff_lines.extend(parse_diff_to_lines(patch))

    issue_type, type_label = "suggestion", "Suggestion"
    labels = [lbl.get("name", "").lower() for lbl in pr.get("labels", [])]
    title_lower = pr.get("title", "").lower()
    if "bug" in labels or "fix" in title_lower or "bug" in title_lower:
        issue_type, type_label = "bug", "Bug Fix"
    elif "performance" in labels or "perf" in labels or "performance" in title_lower:
        issue_type, type_label = "performance", "Performance"
    elif "feature" in labels or "enhancement" in labels:
        issue_type, type_label = "suggestion", "Feature"

    trajectory_steps = []
    if pr.get("commits", 0) > 0:
        trajectory_steps.append({"text": f"Analyzed {pr['commits']} commit(s)"})
    changed_files = pr.get("changed_files", 0)
    if changed_files > 0:
        trajectory_steps.append(
            {
                "text": f"Modified {changed_files} file(s): +{pr.get('additions', 0)} -{pr.get('deletions', 0)} lines"
            }
        )
    if pr.get("requested_reviewers"):
        reviewers = [r.get("login") for r in pr.get("requested_reviewers", [])]
        trajectory_steps.append(
            {"text": f"Requested reviews from: {', '.join(reviewers[:3])}"}
        )

    return {
        "issue_id": issue_id,
        "project": f"{owner}/{repo}",
        "branch": pr.get("head", {}).get("ref", "unknown"),
        "type": issue_type,
        "type_label": type_label,
        "title": pr.get("title", "Untitled PR"),
        "description": pr.get("body", "") or "No description provided",
        "language": primary_language,
        "diff_lines": all_diff_lines,
        "trajectory_steps": trajectory_steps,
        "created_at": pr.get("created_at", ""),
        "github_pr_number": pr_number,
        "github_owner": owner,
        "github_repo": repo,
        "github_pr_url": pr.get("html_url", ""),
        "github_state": pr.get("state", "open"),
        "github_user": pr.get("user", {}).get("login", "unknown"),
        "github_mergeable": pr.get("mergeable"),
        "github_draft": pr.get("draft", False),
    }


async def convert_issue_to_codeissue(
    issue: Dict, owner: str, repo: str, token: str
) -> Dict:
    issue_number = issue["number"]
    issue_id = f"gh_issue_{owner}_{repo}_{issue_number}"

    issue_type, type_label = "suggestion", "Suggestion"
    labels = [lbl.get("name", "").lower() for lbl in issue.get("labels", [])]
    title_lower = issue.get("title", "").lower()
    if "bug" in labels or "fix" in title_lower or "bug" in title_lower:
        issue_type, type_label = "bug", "Bug Fix"
    elif "performance" in labels or "perf" in labels or "performance" in title_lower:
        issue_type, type_label = "performance", "Performance"
    elif "feature" in labels or "enhancement" in labels:
        issue_type, type_label = "suggestion", "Feature"

    return {
        "issue_id": issue_id,
        "project": f"{owner}/{repo}",
        "branch": "main",
        "type": issue_type,
        "type_label": type_label,
        "title": issue.get("title", "Untitled Issue"),
        "description": issue.get("body", "") or "No description provided",
        "language": "plaintext",
        "diff_lines": [],
        "trajectory_steps": [],
        "created_at": issue.get("created_at", ""),
        "github_pr_number": issue_number,
        "github_owner": owner,
        "github_repo": repo,
        "github_pr_url": issue.get("html_url", ""),
        "github_state": issue.get("state", "open"),
        "github_user": issue.get("user", {}).get("login", "unknown"),
    }


async def create_issue(
    owner: str, repo: str, token: str, title: str, body: str, labels: List[str] = None
) -> Dict:
    headers = _get_headers(token)
    payload = {"title": title, "body": body}
    if labels:
        payload["labels"] = labels

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"https://api.github.com/repos/{owner}/{repo}/issues",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        return response.json()
