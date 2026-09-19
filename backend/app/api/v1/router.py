"""Aggregates all domain sub-routers under /api prefix."""

from fastapi import APIRouter

from app.api.v1 import auth, issues, prs, saved, chat, agents, user_keys

router = APIRouter(prefix="/api")

router.include_router(auth.router)
router.include_router(issues.router)
router.include_router(prs.router)
router.include_router(saved.router)
router.include_router(chat.router)
router.include_router(agents.router)
router.include_router(user_keys.router)
