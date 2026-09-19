import asyncio
import json
import logging
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
import httpx

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

async def summarize_trajectory(db, job_id: str):
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
        chat = LlmChat(
            api_key=os.environ.get('OPENAI_API_KEY', ''),
            session_id=f"summary_{job_id}",
            system_message=system_msg
        ).with_model("openai", "gpt-4.1")

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
        # Also pass through "phase" for color-coded UI in AgentTrajectory component
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
        # structured_summary stays empty; text_summary stays as fallback

    await db.agent_jobs.update_one(
        {"job_id": job_id},
        {"$set": {
            "summary": text_summary,
            "structured_summary": structured_summary,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

async def stream_subprocess(db, job_id: str, cmd: str, cwd: str, env: dict = None):
    await append_trace(db, job_id, f"Running command: {cmd}")
    subprocess_env = {**os.environ, **(env or {})}
    process = await asyncio.create_subprocess_shell(
        cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
        cwd=cwd,
        env=subprocess_env,
    )
    
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

async def generate_pr_body(job_id: str, issue_id: str, issue: dict | None, traces: list[dict]) -> str:
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
        chat = LlmChat(
            api_key=os.environ.get("OPENAI_API_KEY", ""),
            session_id=f"pr_body_{job_id}",
            system_message="You are a senior software engineer writing clear, concise GitHub PR descriptions."
        ).with_model("openai", "gpt-4.1")

        response = await chat.send_message(UserMessage(text=prompt))
        return response.strip()
    except Exception as e:
        logger.error(f"Failed to generate PR body for job {job_id}: {e}")
        return f"Automated fix generated by CodeTok agent job `{job_id}`.\n\nCloses `{issue_id}`."


async def run_agent_job(db, job_id: str, issue_id: str, agent_type: str, repo: str, user_id: str = ""):
    """
    Background worker that runs `codex` or `opencode` in an isolated directory.
    """
    start_time = time.time()
    logger.info(f"Starting actual agent job {job_id} using {agent_type} for {repo}")
    await update_job_status(db, job_id, "Running")
    worktree_path = f"/tmp/codetok_workspaces/{job_id}"

    try:
        if "/" in repo:
            owner, repo_name = repo.split("/", 1)
        else:
            raise ValueError("Invalid repo format. Must be owner/repo")

        # Get installation token
        installation_id = settings.github_app_installation_id
        if not installation_id:
            raise ValueError("GITHUB_APP_INSTALLATION_ID not configured")

        token_data = await get_installation_token(installation_id)
        token = token_data["token"]

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

        # Get default branch name to base PR against
        proc = await asyncio.create_subprocess_shell("git branch --show-current", cwd=worktree_path, stdout=asyncio.subprocess.PIPE)
        out, _ = await proc.communicate()
        base_branch = out.decode().strip() or "main"

        # Checkout dynamic branch
        branch_name = f"codetok/agent-{job_id}"
        await append_trace(db, job_id, f"Creating and checking out branch {branch_name}...")
        checkout_cmd = f"git checkout -b {branch_name}"
        proc = await asyncio.create_subprocess_shell(checkout_cmd, cwd=worktree_path)
        await proc.wait()

        # Fetch issue details for prompt
        issue = await db.issues.find_one({"issue_id": issue_id})

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

        # Append code quality and PR format guides so agent knows what standard to follow
        prompt_text += CODE_QUALITY_GUIDE + PR_FORMAT_GUIDE

        escaped_prompt = prompt_text.replace('"', '\\"')
        
        # Fetch per-user API keys early so we can write opencode config before spawning
        from app.services.key_service import get_user_keys
        user_keys = await get_user_keys(db, user_id) if user_id else {}
        resolved_openai_key = user_keys.get("openai_key") or os.environ.get("OPENAI_API_KEY", "")
        resolved_anthropic_key = user_keys.get("anthropic_key") or os.environ.get("ANTHROPIC_API_KEY", "")

        # Spawn Agent Target
        if agent_type == "codex":
            cmd = f'codex exec --full-auto -C {worktree_path} "{escaped_prompt}"'
        elif agent_type == "opencode":
            # opencode v1.x does NOT read OPENAI_API_KEY from the subprocess env.
            # It reads provider credentials from auth.json OR from an opencode.json config
            # file in the project directory using the {env:VAR} syntax.
            # We write a per-job opencode.json into the worktree so the API key is always
            # picked up regardless of what's in the system auth.json.
            opencode_config = {
                "model": "openai/gpt-4o",
                "provider": {
                    "openai": {
                        "options": {
                            "apiKey": resolved_openai_key
                        }
                    }
                }
            }
            import json as _json
            opencode_config_path = os.path.join(worktree_path, "opencode.json")
            with open(opencode_config_path, "w") as f:
                _json.dump(opencode_config, f)
            await append_trace(db, job_id, "Written opencode.json config with OpenAI credentials.")
            cmd = f'opencode run "{escaped_prompt}" --dir {worktree_path} -m openai/gpt-4o'
        elif agent_type == "claude_code":
            # -p = non-interactive print mode (BYOK via ANTHROPIC_API_KEY env var)
            # --dangerously-skip-permissions = needed for fully autonomous headless runs
            # --output-format text = human-readable traces (stream-json floods logs with raw JSON events)
            cmd = f'claude -p "{escaped_prompt}" --dangerously-skip-permissions --output-format text'
        elif agent_type == "kiro":
            # kiro-cli chat --no-interactive runs the prompt headlessly
            # --trust-all-tools auto-approves all file/shell tool usage without confirmation prompts
            # Requires prior one-time auth: kiro-cli login (device-code flow, works on remote VMs)
            cmd = f'kiro-cli chat --no-interactive --trust-all-tools "{escaped_prompt}"'
        else:
            await append_trace(db, job_id, f"Starting agent {agent_type} (might take a few minutes)...")
            raise ValueError(f"Unknown agent type: {agent_type}")
            
        # Build subprocess env with resolved keys (user key takes priority over system env)
        agent_env = {
            "OPENAI_API_KEY": resolved_openai_key,
            "ANTHROPIC_API_KEY": resolved_anthropic_key,
            # Unset CLAUDECODE so the subprocess doesn't think it's a nested Claude Code
            # session, which would cause an immediate crash with "Nested sessions share
            # runtime resources and will crash all active sessions."
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
            
        # Push changes
        await append_trace(db, job_id, "Committing and pushing changes...")
        # We handle quotes properly by using proper shell logic
        git_cmds = f"git add . && git commit -m \"Agent fixes for {issue_id}\" || echo 'No changes' && git push origin {branch_name}"
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
                        
            # Create PR
            await append_trace(db, job_id, "Creating Pull Request via GitHub API...")
            pr_title = f"Fix: {issue.get('title', 'Issue')}" if issue else f"Automated fix by {agent_type}"

            # Fetch current traces for LLM PR body generation
            current_traces = await db.agent_traces.find({"job_id": job_id}).sort("timestamp", 1).to_list(1000)
            pr_body = await generate_pr_body(job_id, issue_id, issue, current_traces)

            try:
                pr_data = await create_github_pr(owner, repo_name, pr_title, pr_body, branch_name, base_branch, token)
                pr_number = pr_data.get("number")
                pr_url = pr_data.get("html_url", "")
                await append_trace(db, job_id, f"Pull Request successfully created at: {pr_url}")

                end_time = time.time()
                duration_seconds = int(end_time - start_time)

                # Store PR link on job for trace-to-PR linkage
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
        else:
            await append_trace(db, job_id, "No changes were pushed to GitHub.")

        await update_job_status(db, job_id, "Completed")
        
        # Summarize
        await append_trace(db, job_id, "Generating trajectory summary...")
        await summarize_trajectory(db, job_id)
        
    except Exception as e:
        logger.error(f"Agent job {job_id} failed: {e}")
        await append_trace(db, job_id, f"Error: {str(e)}")
        await update_job_status(db, job_id, "Failed")
    finally:
        # Cleanup
        if os.path.exists(worktree_path):
            shutil.rmtree(worktree_path, ignore_errors=True)
            await append_trace(db, job_id, "Cleaned up temporary workspace.")
