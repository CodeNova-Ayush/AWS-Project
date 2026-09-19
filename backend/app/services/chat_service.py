"""Chat service — history retrieval + Anthropic LLM call via emergentintegrations."""

import logging
from datetime import datetime, timezone
from typing import List

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.repositories import chat_repo
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
) -> dict:
    now = datetime.now(timezone.utc).isoformat()

    # Persist user message
    await chat_repo.save_message(db, {
        "user_id": user_id,
        "issue_id": issue_id,
        "role": "user",
        "content": user_text,
        "timestamp": now,
    })

    # Build code context from diff lines
    code_context = ""
    for line in issue.get("diff_lines", []):
        prefix = "+" if line.get("type") == "add" else "-" if line.get("type") == "del" else " "
        code_context += f"{prefix} {line.get('content', '')}\n"

    system_msg = (
        f"You are an expert code reviewer AI assistant for the CodeTok platform.\n"
        f"You are discussing a specific code issue:\n"
        f"- Project: {issue.get('project', '')}\n"
        f"- Branch: {issue.get('branch', '')}\n"
        f"- Type: {issue.get('type', '')}\n"
        f"- Title: {issue.get('title', '')}\n"
        f"- Description: {issue.get('description', '')}\n"
        f"- Code diff:\n```\n{code_context}\n```\n"
        f"- Agent trajectory: {', '.join([s.get('text', '') for s in issue.get('trajectory_steps', [])])}\n\n"
        f"Answer questions about this specific code issue concisely. Focus on the technical details, "
        f"explain the bug/fix/suggestion clearly, and provide actionable insights. "
        f"Keep responses under 200 words unless the user asks for more detail."
    )

    session_id = f"codetok_{user_id}_{issue_id}"
    chat = LlmChat(
        api_key=settings.emergent_llm_key,
        session_id=session_id,
        system_message=system_msg,
    ).with_model("openai", "gpt-4.1-mini")

    try:
        ai_response = await chat.send_message(UserMessage(text=user_text))
    except Exception as exc:
        logger.error("GPT-4.1-mini chat error: %s", exc)
        ai_response = "I'm having trouble processing your request right now. Please try again."

    reply_ts = datetime.now(timezone.utc).isoformat()
    await chat_repo.save_message(db, {
        "user_id": user_id,
        "issue_id": issue_id,
        "role": "assistant",
        "content": ai_response,
        "timestamp": reply_ts,
    })

    return {"role": "assistant", "content": ai_response, "timestamp": reply_ts}
