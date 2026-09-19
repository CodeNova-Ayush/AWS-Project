"""
App factory for CodeTok backend.
Entry point: uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

import json
import logging
import os
import shutil
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import router
from app.core.db import init_db
from app.core.errors import register_error_handlers

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)


def ensure_opencode_installed():
    """Check if opencode CLI is available, install it globally if missing."""
    if os.environ.get("SKIP_CLI_INSTALL", "").lower() in ("1", "true", "yes"):
        return
    if shutil.which("opencode"):
        return
    logger.info("opencode not found on PATH — installing via npm...")
    import subprocess
    try:
        result = subprocess.run(
            ["npm", "install", "-g", "opencode"],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode == 0:
            logger.info("opencode installed successfully")
        else:
            logger.error("Failed to install opencode: %s", result.stderr)
    except Exception as e:
        logger.error("Error installing opencode: %s", e)


def ensure_opencode_auth():
    """Provision or refresh OpenCode auth.json from env vars on every startup.

    Always overwrites so that key rotations or new user keys take effect
    without needing to delete the file manually.
    """
    auth_dir = Path.home() / ".local" / "share" / "opencode"
    auth_file = auth_dir / "auth.json"
    auth_data = {}
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
    openai_key = os.environ.get("OPENAI_API_KEY", "")
    if anthropic_key:
        auth_data["anthropic"] = {"apiKey": anthropic_key}
    if openai_key:
        auth_data["openai"] = {"apiKey": openai_key}
    if not auth_data:
        logger.warning("No API keys found — skipping OpenCode auth.json provisioning")
        return
    auth_dir.mkdir(parents=True, exist_ok=True)
    auth_file.write_text(json.dumps(auth_data, indent=2))
    logger.info("Provisioned OpenCode auth.json at %s", auth_file)


def ensure_claude_code_installed():
    """Check if claude CLI is available, install it globally via npm if missing."""
    if os.environ.get("SKIP_CLI_INSTALL", "").lower() in ("1", "true", "yes"):
        return
    if shutil.which("claude"):
        logger.info("claude CLI already available: %s", shutil.which("claude"))
        return
    logger.info("claude not found on PATH — installing @anthropic-ai/claude-code via npm...")
    import subprocess
    try:
        result = subprocess.run(
            ["npm", "install", "-g", "@anthropic-ai/claude-code"],
            capture_output=True, text=True, timeout=180
        )
        if result.returncode == 0:
            logger.info("claude CLI installed successfully")
        else:
            logger.error("Failed to install claude CLI: %s", result.stderr)
    except Exception as e:
        logger.error("Error installing claude CLI: %s", e)


def ensure_claude_code_auth():
    """
    Claude Code BYOK: no auth file needed — it reads ANTHROPIC_API_KEY from env
    at runtime when run with -p (non-interactive / print mode).
    This function just validates the key is present and warns if not.
    """
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if anthropic_key:
        logger.info("ANTHROPIC_API_KEY is set — Claude Code BYOK ready")
    else:
        logger.warning(
            "ANTHROPIC_API_KEY not set — Claude Code agent will fail unless "
            "the user supplies their own key via /api/user/keys"
        )


def ensure_kiro_installed():
    """Check if kiro-cli is available; install via curl if missing."""
    if os.environ.get("SKIP_CLI_INSTALL", "").lower() in ("1", "true", "yes"):
        return
    if shutil.which("kiro-cli"):
        logger.info("kiro-cli already available: %s", shutil.which("kiro-cli"))
        return
    logger.info("kiro-cli not found on PATH — installing via official install script...")
    import subprocess
    try:
        result = subprocess.run(
            ["bash", "-c", "curl -fsSL https://cli.kiro.dev/install | bash"],
            capture_output=True, text=True, timeout=180
        )
        if result.returncode == 0:
            logger.info("kiro-cli installed successfully")
        else:
            logger.error("Failed to install kiro-cli: %s", result.stderr)
    except Exception as e:
        logger.error("Error installing kiro-cli: %s", e)


def ensure_kiro_auth():
    """
    Kiro uses browser/device-code OAuth (AWS Builder ID, GitHub, Google, IAM Identity Center).
    There is no BYOK env-var approach — auth is stored in Kiro's local session store after
    a one-time interactive login: `kiro-cli login`

    This function checks whether a session already exists and warns if not.
    On a fresh VM, run `kiro-cli login` once to authenticate via device-code flow.
    """
    if not shutil.which("kiro-cli"):
        logger.warning("kiro-cli not on PATH — skipping auth check")
        return
    import subprocess
    try:
        # A quick version check exits 0 when auth is fine, non-zero when session is stale
        result = subprocess.run(
            ["kiro-cli", "--version"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            logger.info("kiro-cli auth check passed: %s", result.stdout.strip())
        else:
            logger.warning(
                "kiro-cli may not be authenticated. Run `kiro-cli login` on the VM "
                "to complete device-code auth (AWS Builder ID works without a browser)."
            )
    except Exception as e:
        logger.warning("kiro-cli auth check failed: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_opencode_installed()
    ensure_opencode_auth()
    ensure_claude_code_installed()
    ensure_claude_code_auth()
    ensure_kiro_installed()
    ensure_kiro_auth()
    await init_db(app)
    # Auto-seed database if empty
    try:
        count = await app.state.db.issues.count_documents({})
        if count == 0:
            from app.api.v1.issues import seed_data
            await seed_data(app.state.db)
            logger.info("Successfully auto-seeded initial issues")
    except Exception as e:
        logger.warning("Auto-seed error: %s", e)
    yield
    app.state.db_client.close()


def create_app() -> FastAPI:
    app = FastAPI(title="CodeTok API", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router)
    register_error_handlers(app)

    @app.get("/health")
    async def health_check():
        return {"status": "ok", "service": "snippet-backend"}

    # Check for exported frontend build
    frontend_dist = None
    for candidate in [
        Path("/app/frontend/dist"),
        Path(__file__).resolve().parent.parent.parent / "frontend" / "dist",
        Path(__file__).resolve().parent.parent / "static",
    ]:
        if candidate.exists() and (candidate / "index.html").exists():
            frontend_dist = candidate
            break

    if frontend_dist:
        logger.info("Mounting frontend static bundle from %s", frontend_dist)
        expo_dir = frontend_dist / "_expo"
        if expo_dir.exists():
            app.mount("/_expo", StaticFiles(directory=str(expo_dir)), name="expo_static")
        assets_dir = frontend_dist / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets_static")

        @app.get("/{full_path:path}")
        async def serve_spa_app(full_path: str):
            if full_path.startswith("api") or full_path in ["docs", "openapi.json", "redoc", "health"]:
                return {"error": "Not found"}
            if not full_path:
                return FileResponse(frontend_dist / "index.html")
            direct_file = frontend_dist / full_path
            if direct_file.is_file():
                return FileResponse(direct_file)
            html_file = frontend_dist / f"{full_path}.html"
            if html_file.is_file():
                return FileResponse(html_file)
            return FileResponse(frontend_dist / "index.html")
    else:
        @app.get("/")
        async def root():
            return {
                "status": "online",
                "service": "CodeTok Backend API",
                "version": "1.0.0",
                "docs_url": "/docs",
                "endpoints": {
                    "health": "/health",
                    "issues": "/api/issues",
                    "auth_me": "/api/auth/me",
                    "saved_issues": "/api/saved-issues",
                    "prs": "/api/prs"
                }
            }

    return app


app = create_app()
