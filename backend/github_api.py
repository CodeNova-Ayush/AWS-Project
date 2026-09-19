"""
GitHub API Integration Module
Handles fetching repos, PRs, files, and converting GitHub data to CodeTok format
"""

import httpx
from typing import List, Dict, Optional
import re


async def fetch_user_repos(access_token: str) -> List[Dict]:
    """
    Fetch user's personal repositories using OAuth token

    Args:
        access_token: GitHub OAuth access token

    Returns:
        List of repository objects from GitHub API
    """
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }

    async with httpx.AsyncClient() as client:
        # Fetch repos accessible to the user (personal + collaborator repos)
        response = await client.get(
            "https://api.github.com/user/repos",
            headers=headers,
            params={
                "affiliation": "owner,collaborator",
                "sort": "updated",
                "per_page": 100
            }
        )
        response.raise_for_status()
        return response.json()


async def fetch_installation_repos(installation_token: str) -> List[Dict]:
    """
    Fetch repositories accessible via GitHub App installation

    Args:
        installation_token: GitHub App installation access token

    Returns:
        List of repository objects from GitHub API
    """
    headers = {
        "Authorization": f"Bearer {installation_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }

    async with httpx.AsyncClient() as client:
        # Fetch all repos the GitHub App has access to
        response = await client.get(
            "https://api.github.com/installation/repositories",
            headers=headers,
            params={"per_page": 100}
        )
        response.raise_for_status()
        data = response.json()
        return data.get("repositories", [])


async def fetch_repo_prs(
    owner: str,
    repo: str,
    token: str,
    filter_bot: bool = True
) -> List[Dict]:
    """
    Fetch pull requests for a repository
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/pulls",
            headers=headers,
            params={
                "state": "open",
                "sort": "updated",
                "direction": "desc",
                "per_page": 50
            }
        )
        response.raise_for_status()
        prs = response.json()

    # Filter out bot PRs if requested
    if filter_bot:
        prs = [
            pr for pr in prs
            if pr.get("user", {}).get("type") != "Bot"
        ]

    return prs

async def fetch_repo_issues(
    owner: str,
    repo: str,
    token: str,
    filter_bot: bool = True
) -> List[Dict]:
    """
    Fetch raw issues (not PRs) for a repository
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/issues",
            headers=headers,
            params={
                "state": "open",
                "sort": "updated",
                "direction": "desc",
                "per_page": 50
            }
        )
        response.raise_for_status()
        issues = response.json()

    # GitHub's /issues API also returns PRs (they have a 'pull_request' key). Filter them out.
    issues = [
        issue for issue in issues
        if "pull_request" not in issue
    ]

    # Filter out bots
    if filter_bot:
        issues = [
            issue for issue in issues
            if issue.get("user", {}).get("type") != "Bot"
        ]

    return issues


async def fetch_pr_files(
    owner: str,
    repo: str,
    pr_number: int,
    token: str
) -> List[Dict]:
    """
    Fetch files changed in a pull request

    Args:
        owner: Repository owner
        repo: Repository name
        pr_number: PR number
        token: GitHub access token

    Returns:
        List of file objects with patches
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/files",
            headers=headers,
            params={"per_page": 100}
        )
        response.raise_for_status()
        return response.json()


def parse_diff_to_lines(patch: str) -> List[Dict]:
    """
    Convert git diff patch to list of DiffLine objects

    Args:
        patch: Git diff patch string

    Returns:
        List of diff line objects with type ('add', 'del', 'context') and content
    """
    if not patch:
        return []

    diff_lines = []
    lines = patch.split('\n')

    for line in lines:
        if not line:
            continue

        # Skip diff headers (@@, +++, ---)
        if line.startswith('@@') or line.startswith('+++') or line.startswith('---'):
            continue

        # Added line
        if line.startswith('+'):
            diff_lines.append({
                "type": "add",
                "content": line[1:]  # Remove the + prefix
            })
        # Deleted line
        elif line.startswith('-'):
            diff_lines.append({
                "type": "del",
                "content": line[1:]  # Remove the - prefix
            })
        # Context line
        else:
            diff_lines.append({
                "type": "context",
                "content": line[1:] if line.startswith(' ') else line
            })

    return diff_lines


def detect_language_from_filename(filename: str) -> str:
    """
    Detect programming language from file extension

    Args:
        filename: File name or path

    Returns:
        Language name (lowercase)
    """
    extension_map = {
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.py': 'python',
        '.java': 'java',
        '.kt': 'kotlin',
        '.swift': 'swift',
        '.go': 'go',
        '.rs': 'rust',
        '.c': 'c',
        '.cpp': 'cpp',
        '.cc': 'cpp',
        '.cxx': 'cpp',
        '.h': 'c',
        '.hpp': 'cpp',
        '.cs': 'csharp',
        '.rb': 'ruby',
        '.php': 'php',
        '.html': 'html',
        '.css': 'css',
        '.scss': 'scss',
        '.sass': 'sass',
        '.vue': 'vue',
        '.sql': 'sql',
        '.sh': 'shell',
        '.bash': 'shell',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.json': 'json',
        '.xml': 'xml',
        '.md': 'markdown',
        '.r': 'r',
        '.dart': 'dart',
        '.scala': 'scala',
        '.clj': 'clojure',
        '.ex': 'elixir',
        '.exs': 'elixir',
        '.erl': 'erlang',
        '.hs': 'haskell',
        '.lua': 'lua',
        '.pl': 'perl',
        '.m': 'objective-c',
        '.mm': 'objective-c'
    }

    # Extract extension
    ext = None
    if '.' in filename:
        ext = '.' + filename.rsplit('.', 1)[-1].lower()

    return extension_map.get(ext, 'plaintext')


async def convert_pr_to_issue(
    pr: Dict,
    owner: str,
    repo: str,
    token: str
) -> Dict:
    """
    Convert GitHub PR to CodeTok CodeIssue format

    Args:
        pr: GitHub PR object
        owner: Repository owner
        repo: Repository name
        token: GitHub access token

    Returns:
        CodeIssue object with all required fields
    """
    pr_number = pr['number']
    issue_id = f"gh_pr_{owner}_{repo}_{pr_number}"

    # Fetch files changed in the PR
    files = await fetch_pr_files(owner, repo, pr_number, token)

    # Combine all patches into diff_lines
    all_diff_lines = []
    primary_language = "plaintext"

    if files:
        # Use the first file's language as primary language
        primary_language = detect_language_from_filename(files[0].get('filename', ''))

        # Combine patches from all files (limit to first 3 files to avoid too much data)
        for file in files[:3]:
            patch = file.get('patch', '')
            if patch:
                # Add file header as context
                all_diff_lines.append({
                    "type": "context",
                    "content": f"// File: {file['filename']}"
                })
                all_diff_lines.extend(parse_diff_to_lines(patch))

    # Determine issue type based on PR labels and title
    issue_type = "suggestion"
    type_label = "Suggestion"

    labels = [label.get('name', '').lower() for label in pr.get('labels', [])]
    title_lower = pr.get('title', '').lower()

    if 'bug' in labels or 'fix' in title_lower or 'bug' in title_lower:
        issue_type = "bug"
        type_label = "Bug Fix"
    elif 'performance' in labels or 'perf' in labels or 'performance' in title_lower:
        issue_type = "performance"
        type_label = "Performance"
    elif 'feature' in labels or 'enhancement' in labels:
        issue_type = "suggestion"
        type_label = "Feature"

    # Build trajectory steps from PR info
    trajectory_steps = []

    # Add commits info
    commits_count = pr.get('commits', 0)
    if commits_count > 0:
        trajectory_steps.append({
            "text": f"Analyzed {commits_count} commit(s)"
        })

    # Add file changes info
    changed_files = pr.get('changed_files', 0)
    additions = pr.get('additions', 0)
    deletions = pr.get('deletions', 0)

    if changed_files > 0:
        trajectory_steps.append({
            "text": f"Modified {changed_files} file(s): +{additions} -{deletions} lines"
        })

    # Add review status
    if pr.get('requested_reviewers'):
        reviewers = [r.get('login') for r in pr.get('requested_reviewers', [])]
        trajectory_steps.append({
            "text": f"Requested reviews from: {', '.join(reviewers[:3])}"
        })

    # Construct the CodeIssue object
    code_issue = {
        "issue_id": issue_id,
        "project": f"{owner}/{repo}",
        "branch": pr.get('head', {}).get('ref', 'unknown'),
        "type": issue_type,
        "type_label": type_label,
        "title": pr.get('title', 'Untitled PR'),
        "description": pr.get('body', '') or "No description provided",
        "language": primary_language,
        "diff_lines": all_diff_lines,
        "trajectory_steps": trajectory_steps,
        "created_at": pr.get('created_at', ''),
        # GitHub-specific fields
        "github_pr_number": pr_number,
        "github_owner": owner,
        "github_repo": repo,
        "github_pr_url": pr.get('html_url', ''),
        "github_state": pr.get('state', 'open'),
        "github_user": pr.get('user', {}).get('login', 'unknown'),
        "github_mergeable": pr.get('mergeable'),
        "github_draft": pr.get('draft', False)
    }

    return code_issue

async def convert_issue_to_codeissue(
    issue: Dict,
    owner: str,
    repo: str,
    token: str
) -> Dict:
    """
    Convert GitHub raw Issue to CodeTok CodeIssue format
    """
    issue_number = issue['number']
    issue_id = f"gh_issue_{owner}_{repo}_{issue_number}"

    issue_type = "suggestion"
    type_label = "Suggestion"

    labels = [label.get('name', '').lower() for label in issue.get('labels', [])]
    title_lower = issue.get('title', '').lower()

    if 'bug' in labels or 'fix' in title_lower or 'bug' in title_lower:
        issue_type = "bug"
        type_label = "Bug Fix"
    elif 'performance' in labels or 'perf' in labels or 'performance' in title_lower:
        issue_type = "performance"
        type_label = "Performance"
    elif 'feature' in labels or 'enhancement' in labels:
        issue_type = "suggestion"
        type_label = "Feature"

    code_issue = {
        "issue_id": issue_id,
        "project": f"{owner}/{repo}",
        "branch": "main",
        "type": issue_type,
        "type_label": type_label,
        "title": issue.get('title', 'Untitled Issue'),
        "description": issue.get('body', '') or "No description provided",
        "language": "plaintext",
        "diff_lines": [],
        "trajectory_steps": [],
        "created_at": issue.get('created_at', ''),
        "github_pr_number": issue_number, # Reuse this attribute for frontend compatibility
        "github_owner": owner,
        "github_repo": repo,
        "github_pr_url": issue.get('html_url', ''), # Reuse this attribute for frontend compatibility
        "github_state": issue.get('state', 'open'),
        "github_user": issue.get('user', {}).get('login', 'unknown')
    }

    return code_issue
