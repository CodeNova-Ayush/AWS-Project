"""Issues routes — DB issues + GitHub PR/issue fetching."""

import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.core.db import get_db
from app.core.security import get_current_user, require_user
from app.repositories import issue_repo
from app.services import pr_service
from app.integrations import github_api

router = APIRouter(tags=["issues"])
logger = logging.getLogger(__name__)


# ──── Models ────


class CreateIssueRequest(BaseModel):
    repo: str
    title: str
    description: str
    type: str


# ──── DB issues ────


@router.get("/issues")
async def get_issues(db: AsyncIOMotorDatabase = Depends(get_db)):
    return await issue_repo.get_all_issues(db)


@router.get("/issues/mixed")
async def get_mixed_issues(
    request: Request, db: AsyncIOMotorDatabase = Depends(get_db)
):
    dummy_issues = await issue_repo.get_all_issues(db)
    github_issues = []
    user = await get_current_user(request, db)

    if user and user.get("github_access_token"):
        try:
            repos = await github_api.fetch_user_repos(user["github_access_token"])
            for repo in repos[:3]:
                owner = repo["owner"]["login"]
                repo_name = repo["name"]
                try:
                    prs = await github_api.fetch_repo_prs(
                        owner, repo_name, user["github_access_token"], filter_bot=True
                    )
                    for pr in prs[:2]:
                        issue = await github_api.convert_pr_to_issue(
                            pr, owner, repo_name, user["github_access_token"]
                        )
                        github_issues.append(issue)
                except Exception as exc:
                    logger.warning(
                        "Failed to fetch PRs from %s/%s: %s", owner, repo_name, exc
                    )
        except Exception as exc:
            logger.warning("Failed to fetch GitHub PRs: %s", exc)

    return dummy_issues + github_issues


@router.get("/issues/personal")
async def get_personal_issues(
    request: Request,
    force: bool = Query(False),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user = await get_current_user(request, db)
    user_id = user["user_id"] if user else "user_demo_local"
    token = (user.get("github_access_token") if user else "") or getattr(settings, "github_token", "")
    try:
        return await pr_service.fetch_personal_issues(
            db, token, user_id, force=force
        )
    except Exception as exc:
        logger.warning("fetch_personal_issues fallback: %s", exc)
        return await pr_service.fetch_personal_prs(db, token, user_id, force=force)


@router.get("/issues/org")
async def get_org_issues(
    request: Request,
    force: bool = Query(False),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        return await pr_service.fetch_org_issues(db, force=force)
    except (httpx.HTTPStatusError, ValueError) as exc:
        logger.warning("GitHub App fetch_org_issues unavailable: %s. Falling back to personal/seeded issues.", exc)
        user = await get_current_user(request, db)
        if user and user.get("github_access_token"):
            try:
                personal_issues = await pr_service.fetch_personal_issues(
                    db, user["github_access_token"], user["user_id"], force=force
                )
                if personal_issues:
                    return personal_issues
            except Exception as e:
                logger.warning("Failed to fallback to personal issues: %s", e)
        return await issue_repo.get_all_issues(db)


@router.get("/issues/{issue_id}")
async def get_issue(issue_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    issue = await issue_repo.get_issue_by_id(db, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue


@router.post("/issues/create")
async def create_issue(
    body: CreateIssueRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user = await require_user(request, db)
    token = user.get("github_access_token")
    if not token:
        raise HTTPException(
            status_code=401,
            detail="GitHub account not connected. Please connect via /api/auth/github/login",
        )

    if "/" not in body.repo:
        raise HTTPException(status_code=400, detail="Repo must be in owner/repo format")

    owner, repo_name = body.repo.split("/", 1)

    # Optional label creation
    labels = []
    if body.type:
        labels.append(body.type.lower())

    try:
        issue = await github_api.create_issue(
            owner=owner,
            repo=repo_name,
            token=token,
            title=body.title,
            body=body.description,
            labels=labels,
        )
        # Convert GitHub issue format to CodeIssue format if needed, but returning GitHub issue is fine for our UI flow
        return {
            "success": True,
            "issue_url": issue.get("html_url"),
            "issue_number": issue.get("number"),
            "issue_id": f"gh_issue_{owner}_{repo_name}_{issue.get('number')}",
            "issue": issue,
        }
    except httpx.HTTPStatusError as exc:
        logger.error("GitHub API error: %s", exc)
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Failed to create issue on GitHub: {exc}",
        )
    except Exception as exc:
        logger.error("Failed to create issue on GitHub: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to create issue on GitHub")


# ──── GitHub PR fetching ────


@router.get("/prs/personal")
async def get_personal_prs(
    request: Request,
    force: bool = Query(False),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user = await get_current_user(request, db)
    if not user:
        return await issue_repo.get_all_issues(db)

    user_id = user["user_id"]
    token = user.get("github_access_token", "")
    try:
        return await pr_service.fetch_personal_prs(
            db, token, user_id, force=force
        )
    except Exception as exc:
        logger.error("Error fetching personal PRs for %s: %s", user.get("github_username"), exc)
        return []


@router.get("/prs/org")
async def get_org_prs(
    request: Request,
    force: bool = Query(False),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    user = await get_current_user(request, db)
    if not user:
        return await issue_repo.get_all_issues(db)

    user_id = user["user_id"]
    token = user.get("github_access_token", "")
    try:
        return await pr_service.fetch_org_prs(
            db, token=token, user_id=user_id, force=force
        )
    except Exception as exc:
        logger.warning("Error fetching org PRs for %s: %s", user.get("github_username"), exc)
        return []


# ──── Seed data ────


@router.post("/seed")
async def seed_data(db: AsyncIOMotorDatabase = Depends(get_db)):
    count = await db.issues.count_documents({})
    if count > 0:
        return {"message": "Data already seeded", "count": count}

    now = datetime.now(timezone.utc).isoformat()
    issues = [
        {
            "issue_id": "issue_001",
            "project": "replay-web",
            "branch": "fix/menubar-interval-leak",
            "type": "bug",
            "type_label": "Bug Fix",
            "title": "Memory leak — setInterval never cleared",
            "description": "The Menubar component creates a new interval on every mount but never clears it. After navigating away and back a few times, dozens of intervals stack up and hammer the render loop.",
            "language": "javascript",
            "diff_lines": [
                {"type": "context", "content": "useEffect(() => {"},
                {"type": "del", "content": "  setInterval(() => {"},
                {"type": "del", "content": "    setTime(Date.now());"},
                {"type": "del", "content": "  }, 1000);"},
                {"type": "add", "content": "  const id = setInterval(() => {"},
                {"type": "add", "content": "    setTime(Date.now());"},
                {"type": "add", "content": "  }, 1000);"},
                {"type": "add", "content": "  return () => clearInterval(id);"},
                {"type": "context", "content": "}, []);"},
            ],
            "trajectory_steps": [
                {"text": "Profiled component mount/unmount cycle"},
                {"text": "Found 47 active intervals after 5 navigations"},
                {"text": "Traced to missing cleanup in useEffect"},
                {"text": "Added clearInterval return callback"},
            ],
            "created_at": now,
        },
        {
            "issue_id": "issue_002",
            "project": "Echo",
            "branch": "fix/session-race-condition",
            "type": "bug",
            "type_label": "Bug Fix",
            "title": "Race condition in session connect",
            "description": "Double-tapping Connect creates a second SSHSession before the first finishes handshake. The first session's buffered output is lost and the UI shows a blank terminal.",
            "language": "swift",
            "diff_lines": [
                {"type": "context", "content": "func connect(to host: Host) {"},
                {"type": "del", "content": "  let session = SSHSession(host: host)"},
                {"type": "del", "content": "  session.connect()"},
                {"type": "del", "content": "  self.activeSession = session"},
                {
                    "type": "add",
                    "content": "  guard activeSession == nil else { return }",
                },
                {"type": "add", "content": "  let session = SSHSession(host: host)"},
                {"type": "add", "content": "  self.activeSession = session"},
                {"type": "add", "content": "  session.connect { [weak self] result in"},
                {"type": "add", "content": "    if case .failure = result {"},
                {"type": "add", "content": "      self?.activeSession = nil"},
                {"type": "add", "content": "    }"},
                {"type": "add", "content": "  }"},
                {"type": "context", "content": "}"},
            ],
            "trajectory_steps": [
                {"text": "Reproduced blank terminal on rapid taps"},
                {"text": "Logged SSHSession lifecycle events"},
                {"text": "Identified missing guard clause"},
                {"text": "Added connection state management"},
            ],
            "created_at": now,
        },
        {
            "issue_id": "issue_003",
            "project": "replay-web",
            "branch": "fix/order-lookup-error",
            "type": "bug",
            "type_label": "Bug Fix",
            "title": "Silent 500 with no response body",
            "description": "The catch block returns a 500 with no body. The frontend gets an empty response, shows a blank error toast, and the user has no idea what went wrong.",
            "language": "javascript",
            "diff_lines": [
                {"type": "context", "content": "export default async (req, res) => {"},
                {"type": "context", "content": "  try {"},
                {
                    "type": "context",
                    "content": "    const order = await db.orders.findOne(req.query.id);",
                },
                {"type": "context", "content": "    return res.json(order);"},
                {"type": "context", "content": "  } catch (err) {"},
                {"type": "del", "content": "    return res.status(500);"},
                {"type": "add", "content": "    return res.status(500).json({"},
                {"type": "add", "content": '      error: "Order lookup failed",'},
                {"type": "add", "content": "      message: err.message"},
                {"type": "add", "content": "    });"},
                {"type": "context", "content": "  }"},
                {"type": "context", "content": "};"},
            ],
            "trajectory_steps": [
                {"text": "Scanned API routes: pages/api/**/*.js"},
                {"text": "Read file: order-lookup.js:35-36"},
                {
                    "text": "Flagged missing body: res.status(500) returns empty response"
                },
                {"text": "Added structured JSON error response"},
            ],
            "created_at": now,
        },
        {
            "issue_id": "issue_004",
            "project": "Echo",
            "branch": "perf/circular-output-buffer",
            "type": "performance",
            "type_label": "Performance",
            "title": "Output buffer O(n) trim causes UI jank",
            "description": "Profiled the terminal view during a large file cat. The removeFirst call in SSHSession.swift:108 accounts for 73% of main-thread time during heavy output, causing dropped frames.",
            "language": "swift",
            "diff_lines": [
                {"type": "context", "content": "// SSHSession.swift - Output handling"},
                {"type": "del", "content": "var outputBuffer: [UInt8] = []"},
                {"type": "del", "content": ""},
                {"type": "del", "content": "func appendOutput(_ data: Data) {"},
                {"type": "del", "content": "  outputBuffer.append(contentsOf: data)"},
                {"type": "del", "content": "  if outputBuffer.count > maxSize {"},
                {"type": "del", "content": "    outputBuffer.removeFirst(trimAmount)"},
                {"type": "del", "content": "  }"},
                {"type": "del", "content": "}"},
                {
                    "type": "add",
                    "content": "var outputBuffer = CircularBuffer<UInt8>(capacity: maxSize)",
                },
                {"type": "add", "content": ""},
                {"type": "add", "content": "func appendOutput(_ data: Data) {"},
                {"type": "add", "content": "  outputBuffer.append(contentsOf: data)"},
                {
                    "type": "add",
                    "content": "  // O(1) trim — circular buffer auto-evicts",
                },
                {"type": "add", "content": "}"},
            ],
            "trajectory_steps": [
                {"text": "Profiled with Instruments during 10MB cat"},
                {"text": "73% main-thread time in Array.removeFirst"},
                {"text": "Identified O(n) complexity in buffer trim"},
                {"text": "Replaced with O(1) circular ring buffer"},
            ],
            "created_at": now,
        },
        {
            "issue_id": "issue_005",
            "project": "replay-web",
            "branch": "fix/checkout-promise-chain",
            "type": "bug",
            "type_label": "Bug Fix",
            "title": "Stripe checkout promise chain broken",
            "description": ".then(setProcessing(false)) immediately invokes setProcessing instead of passing a callback. Processing state clears before the redirect even starts, and errors are silently swallowed.",
            "language": "javascript",
            "diff_lines": [
                {"type": "context", "content": "const handleCheckout = async () => {"},
                {"type": "context", "content": "  setProcessing(true);"},
                {
                    "type": "del",
                    "content": "  stripe.redirectToCheckout({ sessionId })",
                },
                {"type": "del", "content": "    .then(setProcessing(false));"},
                {"type": "add", "content": "  try {"},
                {
                    "type": "add",
                    "content": "    await stripe.redirectToCheckout({ sessionId });",
                },
                {"type": "add", "content": "  } catch (err) {"},
                {"type": "add", "content": "    setError(err.message);"},
                {"type": "add", "content": "  } finally {"},
                {"type": "add", "content": "    setProcessing(false);"},
                {"type": "add", "content": "  }"},
                {"type": "context", "content": "};"},
            ],
            "trajectory_steps": [
                {"text": "Traced checkout flow from button click"},
                {"text": "Found .then() receives function result, not reference"},
                {"text": "Identified silent error swallowing"},
                {"text": "Refactored to async/await with try-catch-finally"},
            ],
            "created_at": now,
        },
        {
            "issue_id": "issue_006",
            "project": "replay-web",
            "branch": "fix/stripe-webhook-db-error",
            "type": "suggestion",
            "type_label": "Suggestion",
            "title": "Webhook swallows DB write failures",
            "description": "Discovered during a payment flow audit. If FaunaDB is down for even a few seconds, purchase records vanish with no trace — Stripe won't retry a 200.",
            "language": "javascript",
            "diff_lines": [
                {"type": "context", "content": "// Stripe webhook handler"},
                {
                    "type": "context",
                    "content": "app.post('/webhook', async (req, res) => {",
                },
                {"type": "context", "content": "  const event = req.body;"},
                {"type": "del", "content": "  await faunaClient.query("},
                {"type": "del", "content": "    q.Create(q.Collection('purchases'), {"},
                {"type": "del", "content": "      data: event.data.object"},
                {"type": "del", "content": "    })"},
                {"type": "del", "content": "  );"},
                {"type": "del", "content": "  res.json({ received: true });"},
                {"type": "add", "content": "  try {"},
                {"type": "add", "content": "    await faunaClient.query("},
                {
                    "type": "add",
                    "content": "      q.Create(q.Collection('purchases'), {",
                },
                {"type": "add", "content": "        data: event.data.object"},
                {"type": "add", "content": "      })"},
                {"type": "add", "content": "    );"},
                {"type": "add", "content": "    res.json({ received: true });"},
                {"type": "add", "content": "  } catch (err) {"},
                {
                    "type": "add",
                    "content": "    console.error('DB write failed:', err);",
                },
                {
                    "type": "add",
                    "content": "    res.status(500).json({ error: 'DB write failed' });",
                },
                {"type": "add", "content": "  }"},
                {"type": "context", "content": "});"},
            ],
            "trajectory_steps": [
                {"text": "Audited payment flow end-to-end"},
                {"text": "Simulated FaunaDB downtime"},
                {"text": "Webhook returned 200 despite DB failure"},
                {"text": "Recommended try-catch with 500 for Stripe retry"},
            ],
            "created_at": now,
        },
    ]

    await db.issues.insert_many(issues)
    return {"message": "Seeded successfully", "count": len(issues)}
