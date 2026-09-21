"""Chat service — history retrieval + deep PR bug analysis, merge conflict detection, and multi-provider LLM review."""

import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.repositories import chat_repo
from app.integrations import github_api
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)


async def get_history(
    db: AsyncIOMotorDatabase, issue_id: str, user_id: str
) -> List[dict]:
    return await chat_repo.get_chat_history(db, issue_id, user_id)


async def send_message(
    db: AsyncIOMotorDatabase,
    issue_id: str,
    user_id: str,
    user_text: str,
    issue: dict,
    provider: Optional[str] = None,
    model: Optional[str] = None,
) -> dict:
    now = datetime.now(timezone.utc).isoformat()

    # 1. Persist user message
    await chat_repo.save_message(db, {
        "user_id": user_id,
        "issue_id": issue_id,
        "role": "user",
        "content": user_text,
        "timestamp": now,
    })

    # 2. Retrieve user's GitHub token to pull live PR intelligence if available
    user_doc = await db.users.find_one({"user_id": user_id})
    gh_token = user_doc.get("github_access_token") if user_doc else None

    # Determine PR identifiers
    owner = issue.get("github_owner")
    repo = issue.get("github_repo")
    pr_number = issue.get("github_pr_number")

    if not (owner and repo and pr_number) and issue_id.startswith("gh_pr_"):
        parts = issue_id[6:].split("_")
        if len(parts) >= 3:
            owner = parts[0]
            repo = parts[1]
            try:
                pr_number = int(parts[2])
            except ValueError:
                pass

    # 3. Fetch live PR details, mergeability, CI checks, and all files from GitHub
    live_pr = None
    live_files = []
    live_checks = []
    if owner and repo and pr_number and gh_token:
        try:
            live_pr = await github_api.fetch_pr_details(owner, repo, pr_number, gh_token)
        except Exception as e:
            logger.warning("Failed to fetch live PR details for %s/%s #%s: %s", owner, repo, pr_number, e)

        try:
            live_files = await github_api.fetch_pr_files(owner, repo, pr_number, gh_token)
        except Exception as e:
            logger.warning("Failed to fetch live PR files for %s/%s #%s: %s", owner, repo, pr_number, e)

        head_sha = live_pr.get("head", {}).get("sha") if live_pr else None
        if head_sha:
            try:
                live_checks = await github_api.fetch_pr_check_runs(owner, repo, head_sha, gh_token)
            except Exception as e:
                logger.warning("Failed to fetch CI check runs for %s/%s #%s: %s", owner, repo, pr_number, e)

    # 4. Construct rich PR intelligence context
    title = live_pr.get("title") if live_pr else issue.get("title", "Untitled PR")
    description = live_pr.get("body") if live_pr else issue.get("description", "No description")
    project = f"{owner}/{repo}" if (owner and repo) else issue.get("project", "Unknown Project")
    base_ref = live_pr.get("base", {}).get("ref") if live_pr else "main"
    head_ref = live_pr.get("head", {}).get("ref") if live_pr else issue.get("branch", "unknown")
    author = live_pr.get("user", {}).get("login") if live_pr else issue.get("github_user", "author")

    # Analyze Mergeability & Merge Conflicts
    mergeable = live_pr.get("mergeable") if live_pr else issue.get("github_mergeable")
    mergeable_state = live_pr.get("mergeable_state", "unknown") if live_pr else "unknown"

    if mergeable_state == "dirty" or mergeable is False:
        merge_status_desc = "⚠️ MERGE CONFLICTS PRESENT: Cannot be merged automatically into base branch. The head branch has conflicting modifications that must be resolved manually."
    elif mergeable is True or mergeable_state == "clean":
        merge_status_desc = f"✅ CLEAN — NO MERGE CONFLICTS: Ready to be merged cleanly into `{base_ref}`."
    elif mergeable_state == "behind":
        merge_status_desc = f"⚠️ BRANCH BEHIND: Head branch `{head_ref}` is behind `{base_ref}` and needs to be updated with latest commits from `{base_ref}`."
    elif mergeable_state == "blocked":
        merge_status_desc = "🛑 MERGE BLOCKED: Protected branch rules, required approvals, or failing status checks are blocking the merge."
    else:
        merge_status_desc = f"Status: {mergeable_state.capitalize()} (Mergeable: {mergeable})"

    # Analyze CI / CD Checks
    if live_checks:
        passed_count = sum(1 for c in live_checks if c.get("conclusion") == "success")
        failed_checks = [c.get("name") for c in live_checks if c.get("conclusion") in ("failure", "timed_out", "action_required")]
        in_progress = sum(1 for c in live_checks if c.get("status") in ("in_progress", "queued"))
        ci_summary = f"{passed_count}/{len(live_checks)} checks passed."
        if failed_checks:
            ci_summary += f" ❌ FAILED CHECKS: {', '.join(failed_checks)}."
        if in_progress:
            ci_summary += f" ⏳ {in_progress} checks still running."
    else:
        ci_summary = "No GitHub Actions check-runs reported or checks are pending."

    # Build comprehensive code diff context
    code_diff_context = ""
    if live_files:
        code_diff_context += f"Files Changed ({len(live_files)} files):\n"
        for f in live_files:
            fn = f.get("filename", "")
            st = f.get("status", "modified")
            adds = f.get("additions", 0)
            dels = f.get("deletions", 0)
            patch = f.get("patch", "")
            code_diff_context += f"\n--- File: {fn} ({st}, +{adds}/-{dels} lines) ---\n"
            if patch:
                # include full patch up to 250 lines per file
                patch_lines = patch.split("\n")[:250]
                code_diff_context += "\n".join(patch_lines) + "\n"
            else:
                code_diff_context += "(Binary or large file with no patch diff)\n"
    else:
        # Fallback to diff_lines from issue payload
        for line in issue.get("diff_lines", []):
            prefix = "+" if line.get("type") == "add" else "-" if line.get("type") == "del" else " "
            code_diff_context += f"{prefix} {line.get('content', '')}\n"

    # Build the Snippet Senior Code Reviewer System Prompt (as per info.md PRD specifications)
    system_msg = (
        f"You are Snippet AI — the intelligent GitHub Code Review & PR Analysis engine from the Snippet Product Requirements Document (PRD).\n"
        f"Your mission is to help software engineers and team leads review, understand, inspect for bugs, check merge conflicts, and manage PRs directly from mobile.\n\n"
        f"================= PULL REQUEST SPECIFICATION =================\n"
        f"- Repository: {project}\n"
        f"- PR #{pr_number if pr_number else ''}: {title}\n"
        f"- Author: @{author}\n"
        f"- Target Branch: `{base_ref}` <- Head Feature Branch: `{head_ref}`\n"
        f"- Mergeability & Conflict Status: {merge_status_desc}\n"
        f"- CI / CD Health: {ci_summary}\n"
        f"- Description:\n{description}\n\n"
        f"================= CODE DIFF & MODIFIED FILES =================\n"
        f"{code_diff_context if code_diff_context else 'No diff provided.'}\n\n"
        f"================= CORE REVIEW INSTRUCTIONS =================\n"
        f"When answering user questions or performing reviews, adhere strictly to these principles from info.md:\n"
        f"1. DEEP BUG & RISK DETECTION:\n"
        f"   - Scrutinize the code diff thoroughly for bugs, edge cases, unhandled null/undefined values, logic flaws, off-by-one errors, missing error handlers, and security vulnerabilities.\n"
        f"   - Categorize overall risk: LOW, MEDIUM, HIGH, or CRITICAL.\n"
        f"   - Point to the exact files and lines of code when explaining bugs.\n\n"
        f"2. MERGE CONFLICTS & MERGE READINESS:\n"
        f"   - Explicitly evaluate whether the PR has merge conflicts with `{base_ref}`.\n"
        f"   - If conflicts exist (or if the branch is dirty/behind), clearly identify why and give the exact step-by-step Git commands to resolve the conflicts (e.g. `git checkout {head_ref}`, `git fetch origin`, `git merge origin/{base_ref}`).\n\n"
        f"3. CI/CD & BUILD IMPACT:\n"
        f"   - Highlight any failed checks, test breakages, or potential regression risks.\n\n"
        f"4. ACTIONABLE CODE SOLUTIONS:\n"
        f"   - Don't just point out problems — provide clean, concrete replacement code snippets so the reviewer can fix them or request changes with 1 tap.\n"
        f"5. FORMATTING:\n"
        f"   - Use structured GitHub Markdown with clean headings, bold text, bullet points, and code blocks for maximum readability on mobile screens."
    )

    # 5. Resolve active or requested AI provider & model
    from app.services import key_service
    prov_cfg = await key_service.get_provider_config(db, user_id, provider=provider)
    resolved_provider = prov_cfg.get("provider", "mistral")
    resolved_key = prov_cfg.get("api_key", "")
    resolved_base_url = prov_cfg.get("base_url", "")
    resolved_model = model or prov_cfg.get("model", "")

    session_id = f"snippet_{user_id}_{issue_id}"
    chat = LlmChat(
        api_key=resolved_key,
        session_id=session_id,
        system_message=system_msg,
        base_url=resolved_base_url or None,
        provider=resolved_provider,
        model=resolved_model,
    ).with_model(resolved_provider, resolved_model, base_url=resolved_base_url)

    # 6. Execute AI inference
    try:
        ai_response = await chat.send_message(UserMessage(text=user_text))
    except Exception as exc:
        logger.error("Chat error (%s - %s): %s", resolved_provider, resolved_model, exc)
        exc_str = str(exc)
        if "401" in exc_str or "API key" in exc_str or "AuthenticationError" in exc_str:
            ai_response = f"⚠️ Invalid or expired API key for {resolved_provider.capitalize()}. Please configure your API key in Profile settings."
        elif "403" in exc_str and "tier_not_allowed" in exc_str:
            ai_response = f"⚠️ Model '{resolved_model}' is not available in your {resolved_provider.capitalize()} subscription tier. Please select an active model in Profile settings."
        elif "404" in exc_str and "model_not_found" in exc_str:
            ai_response = f"⚠️ Model '{resolved_model}' was not found on {resolved_provider.capitalize()}. Please configure your model or API key in Profile settings."
        elif "403" in exc_str:
            ai_response = f"⚠️ Access forbidden for {resolved_provider.capitalize()} ({resolved_model}). Please verify your API key in Profile settings."
        elif "quota" in exc_str.lower() or "429" in exc_str or "rate limit" in exc_str.lower():
            ai_response = f"⚠️ {resolved_provider.capitalize()} API rate limit or quota exceeded. Please check your account in Profile settings."
        else:
            ai_response = f"⚠️ Error communicating with {resolved_provider.capitalize()} ({resolved_model}): {exc}. Please verify in Profile settings."

    # 7. Persist assistant response
    reply_ts = datetime.now(timezone.utc).isoformat()
    await chat_repo.save_message(db, {
        "user_id": user_id,
        "issue_id": issue_id,
        "role": "assistant",
        "content": ai_response,
        "timestamp": reply_ts,
        "provider": resolved_provider,
        "model": resolved_model,
    })

    return {
        "role": "assistant",
        "content": ai_response,
        "timestamp": reply_ts,
        "provider": resolved_provider,
        "model": resolved_model,
    }

