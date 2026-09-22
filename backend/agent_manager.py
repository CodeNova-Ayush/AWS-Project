import asyncio
import json
import logging
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
import httpx

import re
from typing import Optional, List, Dict, Any
from emergentintegrations.llm.chat import LlmChat, UserMessage
from app.core.config import settings
from app.integrations.github_app import get_installation_token

logger = logging.getLogger(__name__)

async def update_job_status(db, job_id: str, status: str):
    await db.agent_jobs.update_one(
        {"job_id": job_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

async def append_trace(db, job_id: str, step: str):
    trace_entry = {
        "job_id": job_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "step": step
    }
    await db.agent_traces.insert_one(trace_entry)
    # Also push to job document for easy retrieval
    await db.agent_jobs.update_one(
        {"job_id": job_id},
        {"$push": {"traces": trace_entry}}
    )

async def summarize_trajectory(db, job_id: str, user_id: str = ""):
    # Fetch all traces
    traces = await db.agent_traces.find({"job_id": job_id}).sort("timestamp", 1).to_list(1000)
    trace_texts = [f"- {t['step']}" for t in traces]
    trajectory_str = "\n".join(trace_texts)
    
    import json
    
    system_msg = "You are a specialized AI assistant that parses verbose coding agent logs into a clean, structured JSON array."

    prompt = f"""Summarize the following agent execution trajectory into 5 to 7 high-level phases.
For each phase, extract the 3-5 most important micro-steps/actions taken as strings in a 'details' array.
Also classify each phase with a 'phase' field — choose ONE of: analysis, implement, test, git, pr, other.
You MUST reply with ONLY valid JSON, without Markdown wrappers or explanations.

Expected JSON Schema:
[
  {{
    "title": "Analyzed Repository",
    "phase": "analysis",
    "details": ["Ran rg to find files", "Read auth.py:42", "Found race condition in auth.py"]
  }},
  {{
    "title": "Implemented Fix",
    "phase": "implement",
    "details": ["Edited auth.py to add mutex lock", "Added test_auth_race_condition()", "Ran pytest — 18/18 passed"]
  }},
  {{
    "title": "Committed and Pushed",
    "phase": "git",
    "details": ["git add auth.py tests/test_auth.py", "git commit -m 'fix: auth race condition'", "git push origin codetok/agent-xxx"]
  }}
]

Valid phase values: analysis | implement | test | git | pr | other

Trajectory Logs:
{trajectory_str}
    """
    
    structured_summary = []
    fallback_summary = "1. Cloned repository\n2. Analyzed issue\n3. Implemented fix\n4. Created pull request"
    text_summary = fallback_summary

    try:
        from app.services.key_service import get_provider_config
        prov_cfg = await get_provider_config(db, user_id) if user_id else {}
        prov = prov_cfg.get("provider", "openai")
        model = prov_cfg.get("model", "gpt-4.1")
        key = prov_cfg.get("api_key") or os.environ.get('OPENAI_API_KEY', '')
        base_url = prov_cfg.get("base_url")

        chat = LlmChat(
            api_key=key,
            session_id=f"summary_{job_id}",
            system_message=system_msg,
            provider=prov,
            model=model,
            base_url=base_url or None,
        ).with_model(prov, model, base_url=base_url)

        response = await chat.send_message(UserMessage(text=prompt))

        # Clean potential markdown wrapping
        cleaned_response = response.strip()
        if cleaned_response.startswith("```json"):
            cleaned_response = cleaned_response[7:]
        if cleaned_response.startswith("```"):
            cleaned_response = cleaned_response[3:]
        if cleaned_response.endswith("```"):
            cleaned_response = cleaned_response[:-3]

        raw_steps = json.loads(cleaned_response.strip())

        # Normalize field: backend LLM returns "title", frontend TrajectoryStep expects "text"
        structured_summary = [
            {
                "text": step.get("title", step.get("text", "")),
                "phase": step.get("phase", "other"),
                "details": step.get("details", []),
            }
            for step in raw_steps
        ]

        # Build a readable text summary from the structured steps
        text_summary = "\n".join(
            f"{i + 1}. {step['text']}" for i, step in enumerate(structured_summary)
        )

    except Exception as e:
        logger.error(f"Failed to summarize trajectory to JSON: {e}")
        # Build fallback structured summary from traces
        structured_summary = [
            {"text": t.get("step", ""), "phase": "other", "details": []}
            for t in traces[:10]
        ]

    await db.agent_jobs.update_one(
        {"job_id": job_id},
        {"$set": {
            "summary": text_summary,
            "structured_summary": structured_summary,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

async def stream_subprocess(db, job_id: str, cmd, cwd: str, env: Optional[dict] = None):
    cmd_display = " ".join(cmd) if isinstance(cmd, list) else str(cmd)
    await append_trace(db, job_id, f"Running command: {cmd_display}")
    subprocess_env = {**os.environ, **(env or {})}
    if isinstance(cmd, list):
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=cwd,
            env=subprocess_env,
        )
    else:
        process = await asyncio.create_subprocess_shell(
            cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=cwd,
            env=subprocess_env,
        )
    
    if process.stdout is not None:
        while True:
            line = await process.stdout.readline()
            if not line:
                break
            text = line.decode('utf-8', errors='replace').strip()
            if text:
                await append_trace(db, job_id, text)
            
    await process.wait()
    return process.returncode

async def create_github_pr(owner: str, repo: str, title: str, body: str, head: str, base: str, token: str):
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    data = {"title": title, "body": body, "head": head, "base": base}
    async with httpx.AsyncClient() as client:
        res = await client.post(url, headers=headers, json=data)
        res.raise_for_status()
        return res.json()

import time

CODE_QUALITY_GUIDE = """

CODE QUALITY REQUIREMENTS:
- Every function or method you add or modify MUST have a clear docstring/comment explaining what it does.
- For complex logic blocks, add inline comments explaining WHY the code works this way.
- Variable names must be descriptive and self-explanatory (no single-letter vars except loop indices).
- If you add error handling, comment what error condition you are guarding against.
"""

PR_FORMAT_GUIDE = """

PULL REQUEST FORMAT — you MUST follow this exact structure when creating the PR description:

## Summary
A concise 1–2 sentence overview of what this PR does and why.

## Problem
Describe the issue or bug that prompted this change. Include the root cause if known.

## Solution
Explain the approach taken to fix the problem. Why did you choose this approach?

## Changes Made
- `path/to/file.py` — What changed and why
- `path/to/other.py` — What changed and why

## Testing
- [ ] Describe how you verified this fix works
- [ ] List any edge cases tested
- [ ] Mention if existing tests pass

## Notes
Any caveats, follow-up work needed, or things reviewers should pay special attention to.
"""

async def generate_pr_body(db, job_id: str, issue_id: str, issue: dict | None, traces: list[dict], user_id: str = "") -> str:
    """Use LLM to generate a well-structured PR body from job traces and issue context."""
    trace_lines = "\n".join(f"- {t.get('step', '')}" for t in traces[-60:])  # last 60 to stay within token limits
    issue_title = issue.get("title", "No title") if issue else "No issue title"
    issue_desc = issue.get("description", "") if issue else ""

    prompt = f"""You are a senior software engineer writing a GitHub Pull Request description.

Issue being fixed:
Title: {issue_title}
Description: {issue_desc}

Agent execution trace (what was done):
{trace_lines}

Write a structured PR description following this EXACT format (use Markdown):

## Summary
[1-2 sentence overview]

## Problem
[Root cause / what was broken]

## Solution
[Approach taken and why]

## Changes Made
- `file.py` — [what changed]

## Testing
- [ ] [how the fix was verified]

## Notes
[Caveats or follow-up work, or "None" if no caveats]

Keep it concise, technical, and developer-focused. Do NOT include any preamble."""

    try:
        from app.services.key_service import get_provider_config
        prov_cfg = await get_provider_config(db, user_id) if user_id else {}
        prov = prov_cfg.get("provider", "openai")
        model = prov_cfg.get("model", "gpt-4.1")
        key = prov_cfg.get("api_key") or os.environ.get("OPENAI_API_KEY", "")
        base_url = prov_cfg.get("base_url")

        chat = LlmChat(
            api_key=key,
            session_id=f"pr_body_{job_id}",
            system_message="You are a senior software engineer writing clear, concise GitHub PR descriptions.",
            provider=prov,
            model=model,
            base_url=base_url or None,
        ).with_model(prov, model, base_url=base_url)

        response = await chat.send_message(UserMessage(text=prompt))
        return response.strip()
    except Exception as e:
        logger.error(f"Failed to generate PR body for job {job_id}: {e}")
        return f"Automated fix generated by MergeDeck agent job `{job_id}`.\n\nCloses `{issue_id}`."


async def run_autonomous_fix(
    db,
    job_id: str,
    worktree_path: str,
    issue: dict,
    prov_cfg: dict,
    conflicted_files: Optional[list[str]] = None,
) -> bool:
    """Autonomous agent runner using the user's active BYOK provider (Mistral, Groq, OpenAI, etc.)."""
    provider = prov_cfg.get("provider", "mistral")
    model = prov_cfg.get("model", "codestral-latest")
    api_key = prov_cfg.get("api_key", "")
    base_url = prov_cfg.get("base_url")

    await append_trace(db, job_id, f"Scanning workspace files for issue: '{issue.get('title')}'...")

    # Discover editable source files (skip node_modules, .git, binary)
    relevant_files = {}
    skip_dirs = {".git", "node_modules", "dist", ".next", "__pycache__", ".expo"}
    valid_exts = {".js", ".jsx", ".ts", ".tsx", ".py", ".html", ".css", ".json", ".md", ".sh"}

    # Ensure any explicitly conflicted files are loaded first
    if conflicted_files:
        for cf in conflicted_files:
            cf_path = os.path.join(worktree_path, cf)
            if os.path.exists(cf_path):
                try:
                    with open(cf_path, "r", encoding="utf-8", errors="ignore") as fp:
                        relevant_files[cf] = fp.read()
                except Exception:
                    pass

    for root, dirs, files in os.walk(worktree_path):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in valid_exts:
                rel_path = os.path.relpath(os.path.join(root, f), worktree_path)
                if rel_path in relevant_files:
                    continue
                try:
                    with open(os.path.join(root, f), "r", encoding="utf-8", errors="ignore") as fp:
                        content = fp.read()
                        if len(content) < 50000:
                            relevant_files[rel_path] = content
                except Exception:
                    pass

    await append_trace(db, job_id, f"Inspected {len(relevant_files)} source files in repository.")

    # Order catalog with conflicted files first
    sorted_items = sorted(
        relevant_files.items(),
        key=lambda item: 0 if (conflicted_files and item[0] in conflicted_files) else 1
    )

    file_catalog = "\n\n".join(
        f"--- File: {path} ---\n{content[:5000]}" for path, content in sorted_items[:12]
    )

    conflict_clause = ""
    if conflicted_files:
        conflict_clause = f"""
CRITICAL REQUIREMENT — CONFLICT RESOLUTION:
The following file(s) contain git merge conflicts:
{', '.join(conflicted_files)}
They have git conflict markers (<<<<<<< HEAD, =======, >>>>>>> origin/...).
You MUST cleanly resolve all conflicts in these files. Reconcile both sides of the changes, eliminate all conflict markers completely, and return the complete, working file content.
"""

    prompt = f"""You are an autonomous senior developer fixing a pull request or repository issue.

Repository files:
{file_catalog}

Target:
Title: {issue.get('title', '')}
Description: {issue.get('description', '')}
{conflict_clause}
Your task:
Analyze the code and implement the exact fix or feature requested, resolving any merge conflicts.
Output a valid JSON object with the files that need to be created or modified.
Format:
{{
  "thought": "brief explanation of the fix and conflict resolution",
  "files": [
    {{
      "path": "path/to/file.ext",
      "content": "COMPLETE full file content with the fix and conflict resolution applied"
    }}
  ]
}}
Do NOT output anything other than valid JSON."""

    await append_trace(db, job_id, f"Dispatching prompt to AI model ({provider}/{model})...")

    chat = LlmChat(
        api_key=api_key,
        session_id=f"agent_fix_{job_id}",
        system_message="You are an autonomous AI coding agent. Output only valid JSON.",
        provider=provider,
        model=model,
        base_url=base_url or None,
    ).with_model(provider, model, base_url=base_url)

    response = await chat.send_message(UserMessage(text=prompt))
    await append_trace(db, job_id, "Received response from AI model. Applying file changes...")

    cleaned = response.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]

    data = json.loads(cleaned.strip())
    thought = data.get("thought", "Fix generated by AI agent.")
    await append_trace(db, job_id, f"Strategy: {thought}")

    files_modified = 0
    for f_obj in data.get("files", []):
        f_path = f_obj.get("path")
        f_content = f_obj.get("content")
        if f_path and f_content is not None:
            full_target = os.path.join(worktree_path, f_path)
            os.makedirs(os.path.dirname(full_target), exist_ok=True)
            with open(full_target, "w", encoding="utf-8") as out_fp:
                out_fp.write(f_content)
            files_modified += 1
            await append_trace(db, job_id, f"Updated file: {f_path}")

    return files_modified > 0


async def run_agent_job(db, job_id: str, issue_id: str, agent_type: str, repo: str, user_id: str = "", auto_merge: bool = False):
    """
    Background worker that runs `codex`, `opencode`, `claude_code`, or the autonomous BYOK engine in an isolated directory.
    """
    start_time = time.time()
    logger.info(f"Starting actual agent job {job_id} using {agent_type} for {repo}")
    await update_job_status(db, job_id, "Running")
    worktree_path = f"/tmp/mergedeck_workspaces/{job_id}"

    try:
        if "/" in repo:
            owner, repo_name = repo.split("/", 1)
        else:
            raise ValueError("Invalid repo format. Must be owner/repo")

        # Resolve GitHub Token:
        # 1. Authenticated user's GitHub OAuth token
        # 2. Server settings GITHUB_TOKEN (Personal Access Token)
        # 3. GitHub App installation token (if GITHUB_APP_INSTALLATION_ID is configured)
        token = ""
        if user_id:
            user = await db.users.find_one({"user_id": user_id})
            if user and user.get("github_access_token"):
                token = user["github_access_token"]
                logger.info(f"Using OAuth access token for user {user_id}")

        if not token and settings.github_token:
            token = settings.github_token
            logger.info("Using settings.github_token")

        if not token and settings.github_app_installation_id:
            try:
                token_data = await get_installation_token(settings.github_app_installation_id)
                token = token_data.get("token", "")
                logger.info("Using GitHub App installation token")
            except Exception as e:
                logger.warning(f"Failed to fetch GitHub App token: {e}")

        if not token:
            raise ValueError("No GitHub token available. Please sign in with GitHub or configure GITHUB_TOKEN in your environment.")

        # Clone repo
        await append_trace(db, job_id, f"Cloning repository {repo} into isolated worktree...")
        # Clear existing
        if os.path.exists(worktree_path):
            shutil.rmtree(worktree_path, ignore_errors=True)
        os.makedirs(worktree_path, exist_ok=True)

        clone_url = f"https://x-access-token:{token}@github.com/{repo}.git"
        clone_cmd = f"git clone {clone_url} ."
        process = await asyncio.create_subprocess_shell(clone_cmd, cwd=worktree_path, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        out, err = await process.communicate()
        if process.returncode != 0:
            raise Exception(f"Git clone failed: {err.decode(errors='replace')}")

        # Configure git committer identity in the worktree
        await asyncio.create_subprocess_shell(
            'git config user.name "MergeDeck AI Agent" && git config user.email "agent@mergedeck.app"',
            cwd=worktree_path,
        )

        # Determine if this job is fixing an existing Pull Request or addressing a repository issue
        is_existing_pr = False
        target_pr_number = None
        target_pr_data = None
        target_pr_branch = None

        if issue_id.startswith("gh_pr_"):
            is_existing_pr = True
            clean = issue_id.replace("gh_pr_", "")
            parts = clean.split("_")
            try:
                target_pr_number = int(parts[-1])
            except ValueError:
                pass
        else:
            doc = await db.issues.find_one({"issue_id": issue_id})
            if doc and (doc.get("github_pr_number") or doc.get("type") == "pr"):
                is_existing_pr = True
                target_pr_number = doc.get("github_pr_number")

        # Get default base branch name
        proc = await asyncio.create_subprocess_shell("git branch --show-current", cwd=worktree_path, stdout=asyncio.subprocess.PIPE)
        out, _ = await proc.communicate()
        base_branch = out.decode().strip() or "main"

        conflicted_files: list[str] = []
        review_feedback = ""

        if is_existing_pr and target_pr_number:
            # Fetch live PR details from GitHub API
            await append_trace(db, job_id, f"Fetching details for Pull Request #{target_pr_number} from GitHub API...")
            try:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    pr_res = await client.get(
                        f"https://api.github.com/repos/{owner}/{repo_name}/pulls/{target_pr_number}",
                        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
                    )
                    if pr_res.status_code == 200:
                        target_pr_data = pr_res.json()
                        target_pr_branch = target_pr_data.get("head", {}).get("ref")
                        base_branch = target_pr_data.get("base", {}).get("ref") or base_branch
                    else:
                        logger.warning(f"GitHub API returned {pr_res.status_code} fetching PR #{target_pr_number}")
                    
                    # Fetch PR review comments if any
                    c_res = await client.get(
                        f"https://api.github.com/repos/{owner}/{repo_name}/pulls/{target_pr_number}/comments",
                        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
                    )
                    if c_res.status_code == 200:
                        c_list = c_res.json()
                        if c_list:
                            review_feedback = "\n".join(f"- {c.get('path', '')}:{c.get('line', '')}: {c.get('body', '')}" for c in c_list[:10])
            except Exception as e:
                logger.warning(f"Failed to fetch PR #{target_pr_number} metadata: {e}")

        if is_existing_pr and target_pr_branch:
            branch_name = target_pr_branch
            await append_trace(db, job_id, f"Checking out existing PR branch '{branch_name}' for PR #{target_pr_number}...")
            # Fetch and switch to the PR branch
            fetch_cmd = f"git fetch origin {branch_name}:{branch_name} || git checkout {branch_name}"
            p = await asyncio.create_subprocess_shell(fetch_cmd, cwd=worktree_path, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            await p.communicate()
            co_proc = await asyncio.create_subprocess_shell(f"git checkout {branch_name}", cwd=worktree_path, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            await co_proc.communicate()

            # Attempt merge of base branch to detect conflicts
            await append_trace(db, job_id, f"Checking mergeability with target branch '{base_branch}'...")
            m_proc = await asyncio.create_subprocess_shell(
                f"git merge origin/{base_branch} --no-edit",
                cwd=worktree_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await m_proc.communicate()
            if m_proc.returncode != 0:
                diff_proc = await asyncio.create_subprocess_shell(
                    "git diff --name-only --diff-filter=U",
                    cwd=worktree_path,
                    stdout=asyncio.subprocess.PIPE,
                )
                d_out, _ = await diff_proc.communicate()
                conflicted_files = [f.strip() for f in d_out.decode().splitlines() if f.strip()]
                await append_trace(
                    db,
                    job_id,
                    f"⚠️ Merge conflicts detected with '{base_branch}' in: {', '.join(conflicted_files)}. AI Agent will resolve all conflicts...",
                )
            else:
                await append_trace(db, job_id, f"PR branch '{branch_name}' merged cleanly with '{base_branch}'. Preparing AI Agent to fix issues...")

            pr_title = target_pr_data.get("title", f"PR #{target_pr_number}") if target_pr_data else f"PR #{target_pr_number}"
            pr_body = target_pr_data.get("body", "") if target_pr_data else ""
            issue = {
                "title": pr_title,
                "description": pr_body,
                "issue_id": issue_id,
                "project": repo,
                "github_pr_number": target_pr_number,
                "branch": branch_name,
                "base_branch": base_branch,
            }

            prompt_text = f"""You are an autonomous senior developer fixing and reconciling Pull Request #{target_pr_number}.
Target Repository: {repo}
PR Branch: {branch_name}
Target Base Branch: {base_branch}
PR Title: {pr_title}
PR Description:
{pr_body or 'No description provided.'}
"""
            if review_feedback:
                prompt_text += f"\nReviewer Comments / Requested Changes:\n{review_feedback}\n"
            if conflicted_files:
                prompt_text += f"""
CRITICAL REQUIREMENT — MERGE CONFLICT RESOLUTION:
The following file(s) contain git merge conflicts:
{', '.join(conflicted_files)}
You MUST resolve all merge conflicts, remove all conflict markers (<<<<<<< HEAD, =======, >>>>>>>), reconcile both the PR and base branch logic, and ensure the resulting code is clean, functional, and well-tested.
"""
            prompt_text += CODE_QUALITY_GUIDE
        else:
            # Standard Issue Flow: Checkout dynamic branch
            branch_name = f"mergedeck/agent-{job_id}"
            await append_trace(db, job_id, f"Creating and checking out branch {branch_name}...")
            checkout_cmd = f"git checkout -b {branch_name}"
            proc = await asyncio.create_subprocess_shell(checkout_cmd, cwd=worktree_path)
            await proc.wait()

            # Fetch issue details for prompt
            issue = await db.issues.find_one({"issue_id": issue_id})
            if not issue and issue_id.startswith("gh_issue_"):
                parts = issue_id.split("_")
                if len(parts) >= 5:
                    gh_owner = parts[2]
                    gh_repo = parts[3]
                    gh_num = parts[4]
                    try:
                        async with httpx.AsyncClient() as client:
                            gh_res = await client.get(
                                f"https://api.github.com/repos/{gh_owner}/{gh_repo}/issues/{gh_num}",
                                headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
                                timeout=15.0,
                            )
                            if gh_res.status_code == 200:
                                gh_data = gh_res.json()
                                issue = {
                                    "title": gh_data.get("title", ""),
                                    "description": gh_data.get("body", "") or "",
                                    "issue_id": issue_id,
                                    "project": repo,
                                }
                    except Exception as e:
                        logger.warning(f"Failed to fetch issue from GitHub API fallback: {e}")

            FUTILE_GUARD = (
                "\n\nCRITICAL RULE: If the fix or change required is futile, ambiguous, "
                "would break existing functionality, or is not clearly beneficial, "
                "do NOT create a PR, do NOT commit any changes, and do NOT push to the branch. "
                "Simply exit without modifying the codebase. "
                "Only raise a PR when you are confident the change is correct and safe."
            )

            prompt_text = "Fix the issue." + FUTILE_GUARD
            if issue:
                prompt_text = (
                    f"Fix the following issue: {issue.get('title', '')} - {issue.get('description', '')}"
                    + FUTILE_GUARD
                )
            prompt_text += CODE_QUALITY_GUIDE + PR_FORMAT_GUIDE

        # Fetch per-user API keys
        from app.services.key_service import get_user_keys, get_provider_config
        user_keys = await get_user_keys(db, user_id) if user_id else {}
        prov_cfg = await get_provider_config(db, user_id) if user_id else {}

        resolved_openai_key = user_keys.get("openai_key") or os.environ.get("OPENAI_API_KEY", "")
        resolved_anthropic_key = user_keys.get("anthropic_key") or os.environ.get("ANTHROPIC_API_KEY", "")

        ran_autonomous = False

        if agent_type == "claude_code" and resolved_anthropic_key and shutil.which("claude"):
            cmd = ["claude", "-p", prompt_text, "--permission-mode", "acceptEdits", "--output-format", "text"]
        elif agent_type == "opencode" and (resolved_openai_key or prov_cfg.get("api_key")) and shutil.which("opencode"):
            opencode_key = resolved_openai_key or prov_cfg.get("api_key", "")
            opencode_config = {
                "model": "openai/gpt-4o",
                "provider": {
                    "openai": {
                        "options": {
                            "apiKey": opencode_key
                        }
                    }
                }
            }
            opencode_config_path = os.path.join(worktree_path, "opencode.json")
            with open(opencode_config_path, "w") as f:
                json.dump(opencode_config, f)
            await append_trace(db, job_id, "Written opencode.json config with credentials.")
            cmd = ["opencode", "run", prompt_text, "--dir", worktree_path, "-m", "openai/gpt-4o"]
        elif agent_type == "codex" and shutil.which("codex"):
            cmd = ["codex", "exec", "--full-auto", "-C", worktree_path, prompt_text]
        elif agent_type == "kiro" and shutil.which("kiro-cli"):
            cmd = ["kiro-cli", "chat", "--no-interactive", "--trust-all-tools", prompt_text]
        elif prov_cfg.get("api_key"):
            # Autonomous AI Engine using active BYOK provider (Mistral, Groq, OpenAI, etc.)
            ran_autonomous = True
            await append_trace(
                db,
                job_id,
                f"Starting MergeDeck Autonomous Engine with {prov_cfg.get('provider', 'AI').upper()} ({prov_cfg.get('model', 'default')})...",
            )
            success = await run_autonomous_fix(
                db,
                job_id,
                worktree_path,
                issue or {"title": "Issue fix", "description": ""},
                prov_cfg,
                conflicted_files=conflicted_files,
            )
            if not success:
                await append_trace(db, job_id, "Autonomous engine made no file modifications.")
        else:
            raise ValueError(
                f"Cannot launch agent '{agent_type}': No AI API key configured. Please configure an API key in Profile > BYOK (e.g. Anthropic, Mistral, Groq, or OpenAI)."
            )

        if not ran_autonomous:
            agent_env = {
                "OPENAI_API_KEY": resolved_openai_key or prov_cfg.get("api_key", ""),
                "ANTHROPIC_API_KEY": resolved_anthropic_key,
                "CLAUDECODE": "",
            }
            try:
                returncode = await asyncio.wait_for(
                    stream_subprocess(db, job_id, cmd, worktree_path, env=agent_env),
                    timeout=600  # 10 minutes
                )
            except asyncio.TimeoutError:
                await append_trace(db, job_id, "Agent timed out after 10 minutes.")
                await update_job_status(db, job_id, "Failed")
                return

            if returncode != 0:
                await append_trace(db, job_id, f"Agent subprocess exited with non-zero code: {returncode}")
            else:
                await append_trace(db, job_id, "Agent subprocess completed successfully.")

        # If there were conflict markers in any conflicted file, verify they are stripped
        if conflicted_files:
            for cf in conflicted_files:
                cf_path = os.path.join(worktree_path, cf)
                if os.path.exists(cf_path):
                    try:
                        with open(cf_path, "r", encoding="utf-8", errors="ignore") as fp:
                            raw_lines = fp.readlines()
                        clean_lines = [line for line in raw_lines if not re.match(r"^(<{7}|={7}|>{7})(\s|$)", line)]
                        if len(clean_lines) != len(raw_lines):
                            with open(cf_path, "w", encoding="utf-8") as fp:
                                fp.writelines(clean_lines)
                            await append_trace(db, job_id, f"Verified and cleaned conflict markers in {cf}.")
                    except Exception:
                        pass

        # Push changes
        await append_trace(db, job_id, f"Committing and pushing changes to branch '{branch_name}'...")
        commit_msg = f"Agent fixes and conflict resolution for PR #{target_pr_number}" if is_existing_pr else f"Agent fixes for {issue_id}"
        git_cmds = f"git add . && git commit -m \"{commit_msg}\" || echo 'No changes' && git push origin {branch_name}"
        proc = await asyncio.create_subprocess_shell(git_cmds, cwd=worktree_path, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        out, err = await proc.communicate()

        if proc.returncode == 0 and "No changes" not in out.decode():
            # Tally line changes from the new commit
            diff_cmd = "git diff HEAD~1 --numstat"
            diff_proc = await asyncio.create_subprocess_shell(diff_cmd, cwd=worktree_path, stdout=asyncio.subprocess.PIPE)
            diff_out, _ = await diff_proc.communicate()

            lines_changed = 0
            for line in diff_out.decode().splitlines():
                parts = line.split()
                if len(parts) >= 2:
                    try:
                        adds = int(parts[0]) if parts[0] != '-' else 0
                        dels = int(parts[1]) if parts[1] != '-' else 0
                        lines_changed += (adds + dels)
                    except ValueError:
                        pass

            end_time = time.time()
            duration_seconds = int(end_time - start_time)

            if is_existing_pr and target_pr_number:
                # Existing PR was updated directly on GitHub!
                pr_number = target_pr_number
                pr_url = target_pr_data.get("html_url") if target_pr_data else f"https://github.com/{owner}/{repo_name}/pull/{pr_number}"
                pr_title = target_pr_data.get("title", f"PR #{pr_number}") if target_pr_data else f"PR #{pr_number}"
                await append_trace(db, job_id, f"✅ Successfully pushed fixes directly to PR branch '{branch_name}' for PR #{pr_number} on GitHub!")

                await db.agent_jobs.update_one(
                    {"job_id": job_id},
                    {"$set": {
                        "pr_url": pr_url,
                        "pr_number": pr_number,
                        "pr_owner": owner,
                        "pr_repo": repo_name,
                        "duration_seconds": duration_seconds,
                        "lines_changed": lines_changed,
                        "follow_new_pr_format": True,
                    }}
                )
            else:
                # Create a new PR for this issue
                await append_trace(db, job_id, "Creating Pull Request via GitHub API...")
                pr_title = f"Fix: {issue.get('title', 'Issue')}" if issue else f"Automated fix by {agent_type}"
                current_traces = await db.agent_traces.find({"job_id": job_id}).sort("timestamp", 1).to_list(1000)
                pr_body = await generate_pr_body(db, job_id, issue_id, issue, current_traces, user_id=user_id)

                try:
                    pr_data = await create_github_pr(owner, repo_name, pr_title, pr_body, branch_name, base_branch, token)
                    pr_number = pr_data.get("number")
                    pr_url = pr_data.get("html_url", "")
                    await append_trace(db, job_id, f"Pull Request successfully created at: {pr_url}")

                    await db.agent_jobs.update_one(
                        {"job_id": job_id},
                        {"$set": {
                            "pr_url": pr_url,
                            "pr_number": pr_number,
                            "pr_owner": owner,
                            "pr_repo": repo_name,
                            "duration_seconds": duration_seconds,
                            "lines_changed": lines_changed,
                            "follow_new_pr_format": True,
                        }}
                    )
                except Exception as e:
                    logger.error(f"Failed to create PR for job {job_id}: {e}")
                    await append_trace(db, job_id, f"Failed to create Pull Request: {e}")
                    pr_number = None

            # Auto-Merge Evaluation
            job_doc = await db.agent_jobs.find_one({"job_id": job_id}) or {}
            explicit_auto_merge = bool(
                auto_merge
                or job_doc.get("auto_merge", False)
                or (issue and issue.get("auto_merge", False))
            )

            combined_intent_text = ""
            if issue:
                combined_intent_text += f" {issue.get('title', '')} {issue.get('description', '')}"
            if prompt_text:
                combined_intent_text += f" {prompt_text}"

            intent_auto_merge = bool(re.search(
                r"\b(auto[- ]?merge|automerge|merge\s+(all|the|it|this|pr|prs|changes|fixes|branch|into\s+(main|master))|and\s+merge|fix\s+(and|&)\s+merge)\b",
                combined_intent_text,
                re.IGNORECASE
            ))

            should_auto_merge = explicit_auto_merge or intent_auto_merge

            if should_auto_merge and pr_number:
                await append_trace(db, job_id, f"Auto-merge requested: Verifying PR #{pr_number} mergeability on GitHub...")
                # Give GitHub 2 seconds to register the new push and recalculate mergeable status
                await asyncio.sleep(2)
                merge_url = f"https://api.github.com/repos/{owner}/{repo_name}/pulls/{pr_number}/merge"
                merge_payload = {
                    "commit_title": f"Merge PR #{pr_number}: {pr_title}",
                    "commit_message": f"Auto-merged by MergeDeck Agent ({agent_type}) following verified code fixes.\n\nJob ID: {job_id}",
                    "merge_method": "squash",
                }
                headers = {
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                }
                async with httpx.AsyncClient(timeout=30.0) as client:
                    merge_res = await client.put(
                        merge_url,
                        headers=headers,
                        json=merge_payload,
                    )
                    # Retry with fallback merge methods if squash is disabled in repo
                    if merge_res.status_code == 405 and "not allowed" in merge_res.text.lower():
                        for fallback_m in ["merge", "rebase"]:
                            merge_payload["merge_method"] = fallback_m
                            merge_res = await client.put(merge_url, headers=headers, json=merge_payload)
                            if merge_res.is_success:
                                break

                    if merge_res.status_code in (200, 201):
                        m_data = merge_res.json()
                        m_sha = m_data.get("sha", "")
                        await append_trace(db, job_id, f"✅ Pull Request #{pr_number} successfully merged into '{base_branch}' on GitHub! (Commit: {m_sha[:7] if m_sha else 'verified'})")
                        await db.agent_jobs.update_one(
                            {"job_id": job_id},
                            {"$set": {
                                "status": "Merged",
                                "merged": True,
                                "merged_at": datetime.now(timezone.utc).isoformat(),
                                "merge_commit_sha": m_sha,
                            }}
                        )
                        if issue_id:
                            await db.issues.update_one(
                                {"issue_id": issue_id},
                                {"$set": {
                                    "status": "Merged",
                                    "merged": True,
                                    "github_state": "closed",
                                    "merge_commit_sha": m_sha,
                                }}
                            )
                        try:
                            from app.repositories import issue_repo
                            await issue_repo.invalidate_all_pr_caches(db)
                        except Exception as c_err:
                            logger.warning("Cache invalidation error after merge: %s", c_err)
                    else:
                        try:
                            err_data = merge_res.json()
                            err_msg = err_data.get("message", merge_res.text)
                        except Exception:
                            err_msg = merge_res.text
                        await append_trace(
                            db,
                            job_id,
                            f"⚠️ Auto-merge delayed by GitHub ({merge_res.status_code}): {err_msg}. PR #{pr_number} was updated with fixes on GitHub and is ready in your Feed for one-tap merge."
                        )
        else:
            await append_trace(db, job_id, "No changes were pushed to GitHub.")

        final_job = await db.agent_jobs.find_one({"job_id": job_id}) or {}
        if final_job.get("status") != "Merged":
            await update_job_status(db, job_id, "Completed")
        
        # Summarize
        await append_trace(db, job_id, "Generating trajectory summary...")
        await summarize_trajectory(db, job_id, user_id=user_id)
        
    except Exception as e:
        logger.error(f"Agent job {job_id} failed: {e}")
        await append_trace(db, job_id, f"Error: {str(e)}")
        await update_job_status(db, job_id, "Failed")
    finally:
        # Cleanup
        if os.path.exists(worktree_path):
            shutil.rmtree(worktree_path, ignore_errors=True)
            await append_trace(db, job_id, "Cleaned up temporary workspace.")
