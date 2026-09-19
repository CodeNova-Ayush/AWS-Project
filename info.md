Snippet

Product Requirements Document

Product: Snippet
Category: Developer Tools / GitHub Productivity
Platform: Mobile-first Web App / PWA
Core idea: Review, understand, approve, and manage GitHub development activity directly from your phone.

---

1. Product Vision

Developers shouldn't need to open their laptop just because someone opened a pull request.

Snippet turns a phone into a lightweight control center for software repositories.

A developer connects their GitHub account and selects repositories they want to monitor. Snippet then provides a mobile-optimized feed containing:

- Pull requests
- Commits
- Pushes
- Issues
- Merge activity
- CI/CD status
- Review requests

Instead of reproducing the entire GitHub interface on a smaller screen, Snippet focuses on one workflow:

Understand what changed → determine whether it is safe → take action.

A user should be able to receive a notification about a pull request, open Snippet, understand the change, inspect the actual code diff, review relevant context and merge or request changes within roughly a minute.

---

2. Problem

GitHub workflows are primarily designed around desktop development.

Consider a typical situation:

A developer is away from their laptop.

Another developer opens:

"PR #247 — Fix authentication refresh token bug"

The reviewer receives a notification.

They may only need to:

1. Understand what changed.
2. Inspect 20–30 lines of code.
3. Check whether CI passed.
4. Approve the PR.
5. Merge it.

Yet doing this comfortably from a phone is cumbersome, particularly when several files, discussions and checks are involved.

This creates unnecessary delays in development teams.

Snippet provides a purpose-built mobile interface for these decisions.

---

3. Target Users

Primary

Software engineers

Engineering leads

CTOs

Startup founders

Open-source maintainers

Technical product builders

Secondary

Engineering managers who need visibility into repository activity without constantly opening GitHub.

---

4. Core User Journey

Step 1 — Sign in

User selects:

Continue with GitHub

Snippet authenticates using GitHub OAuth or a GitHub App.

---

Step 2 — Connect repositories

Snippet displays repositories accessible by the user.

Example:

Repositories

✓ company/backend
✓ company/mobile-app
✓ company/dashboard

+ Add Repository

The user selects which repositories Snippet should monitor.

---

5. Home — Development Inbox

Instead of showing repositories first, Snippet presents an activity inbox.

Example:

SNIPPET

Needs Your Attention

🔵 PR #247
Fix authentication refresh bug
by Rahul
+42 -13
3 files
CI ✓

Review


🟠 Issue #182
Checkout failing on Safari

View Issue


🟢 PR #245
Dashboard caching improvements

Approved by 2 reviewers
Ready to merge

Merge

This creates an inbox-style experience for software development.

---

6. Pull Request Review

This is the most important feature in Snippet.

When the user opens a PR, they see:

PR #247

Fix authentication refresh bug

Rahul → main

+42 additions
-13 deletions
3 files changed

Below that:

Summary

Snippet can generate a short AI explanation.

Example:

What changed?

• Updated refresh-token validation.
• Added expiration handling.
• Added two authentication tests.
• Removed deprecated token logic.

This allows someone to understand the PR before reading the implementation.

---

7. Mobile Code Diff Viewer

The user can inspect the actual Git diff.

Example:

auth/token.ts

- if (!token) {
-    return null;
- }

+ if (!token || token.expired) {
+    throw new AuthError(
+       "Invalid refresh token"
+    );
+ }

The viewer should support:

- Syntax highlighting
- Added/removed line highlighting
- File switching
- Line numbers
- Collapsible files
- Side-by-side desktop view
- Unified mobile view
- Expand surrounding code
- Copy code
- Open original file

Mobile usability is a major differentiator.

---

8. File Navigation

PRs containing many files should remain easy to inspect.

Example:

Files changed (7)

✓ auth/token.ts
✓ auth/session.ts
○ api/login.ts
○ api/logout.ts
○ tests/auth.test.ts
○ middleware/auth.ts
○ utils/token.ts

Snippet remembers which files the reviewer has inspected.

This creates a simple review-progress indicator.

Example:

"Reviewed 4 / 7 files"

---

9. AI PR Explanation

Snippet can provide an AI-generated explanation of the changes.

Button:

Explain this PR

Possible response:

This PR modifies how expired refresh tokens
are handled.

Previously:

Expired tokens could reach the session
refresh function.

Now:

Tokens are validated before the refresh
operation.

Potential impact:

Authentication sessions may terminate earlier
for users carrying invalid refresh tokens.

The AI should reference actual changed files rather than provide generic summaries.

---

10. AI Risk Detection

Snippet can analyze the diff before the user merges it.

Example:

AI Review

Risk: MEDIUM

Potential issue

auth/token.ts:87

The new validation throws an exception,
but this caller does not appear to catch
AuthError.

This could result in a 500 response.

[View Code]

Categories could include:

- Possible bugs
- Security concerns
- Missing error handling
- Breaking API changes
- Database migration risks
- Missing tests
- Performance issues

AI findings are advisory and should never automatically approve or merge code.

---

11. Ask About the PR

Users can ask questions about the change.

Example:

Ask Snippet

"Could this change break existing sessions?"

Snippet uses:

- PR diff
- Relevant repository files
- PR description
- Existing comments
- Commit information

to provide a contextual answer.

Other example questions:

Why was this function changed?

Does this introduce a breaking API change?

Are there tests for this behavior?

Where else is this function called?

Explain this code simply.

---

12. PR Actions

A persistent action bar appears at the bottom.

Comment     Approve     Merge

Supported actions:

Approve

Submit GitHub PR approval.

Request Changes

Add review feedback.

Comment

Post a normal PR comment.

Merge

Merge the PR through GitHub.

Supported merge strategies:

- Merge commit
- Squash and merge
- Rebase and merge

The interface must show required branch protections before allowing the action.

---

13. One-Tap Merge

When all requirements are satisfied:

✓ CI Passed
✓ Required Reviews
✓ No Merge Conflicts
✓ Branch Up To Date

Ready to merge

The user taps:

Merge PR

Snippet asks for confirmation and performs the merge through GitHub.

---

14. CI/CD Status

Snippet displays GitHub Actions and other available check results.

Example:

Checks

✓ Unit Tests
✓ TypeScript
✓ ESLint
✓ Build
✓ Deployment Preview

5 / 5 passed

Failed checks become immediately visible.

✕ Unit Tests

2 tests failed

auth.test.ts
refreshToken()

The user can inspect the failure without leaving Snippet.

---

15. Repository Activity Feed

Every repository has an activity timeline.

Example:

TODAY

10:42
Rahul opened PR #247

10:31
Sarah pushed 3 commits

09:52
CI failed on PR #246

09:34
Issue #181 created

09:12
PR #244 merged

Events can include:

- Pushes
- Commits
- Pull requests
- Reviews
- Merges
- Issues
- Releases
- Workflow runs

---

16. Issues

Snippet also provides lightweight GitHub Issue management.

Users can:

- Read issues
- Comment
- Assign users
- Add labels
- Close issues
- Reopen issues

Example:

Issue #182

Checkout failing on Safari

Priority: High
Bug

Assigned
Rahul

---

17. Notifications

GitHub webhooks trigger Snippet notifications.

Examples:

New PR needs your review

company/backend
PR #247
Fix authentication refresh bug

or

CI failed

PR #247

2 tests failed

or

PR ready to merge

All checks passed.
2 approvals received.

Tapping the notification opens the relevant screen directly.

---

18. Smart Notification Filtering

Developers receive large amounts of repository activity.

Snippet should prioritize only actionable events.

Critical

CI failure

Merge conflict

Security warning

Requested review

Important

New PR

PR approved

Issue assigned

Informational

Commit pushed

Branch created

Issue updated

Users can customize these notification categories.

---

19. Repository Dashboard

Example:

company/backend

OPEN PRs          7
OPEN ISSUES      23
FAILED BUILDS     1
YOUR REVIEWS      3

Below:

Needs Attention

PR #247
Review requested

PR #251
CI failed

PR #253
Merge conflict

The dashboard prioritizes action rather than repository statistics.

---

20. Search

Global search can find:

- Repository
- Pull request
- Issue
- Branch
- Commit
- File

Example:

Search

"authentication"

Results:

PR #247
Refresh token fix

Issue #182
Authentication failure

auth/token.ts

---

21. Architecture

A practical hackathon architecture:

                 GitHub
                    │
             GitHub App / OAuth
                    │
                    ▼
              Snippet API
                    │
        ┌───────────┼────────────┐
        │           │            │
     Webhooks    Database      AI Layer
        │           │            │
        ▼           ▼            ▼
     Events      Metadata    PR Analysis
        │
        ▼
 Notification Service
        │
        ▼
        Phone

---

22. GitHub Integration

Recommended approach:

GitHub App

rather than requesting excessively broad OAuth permissions.

The GitHub App subscribes to repository events.

Relevant GitHub functionality includes:

- Repositories
- Pull Requests
- Pull Request Reviews
- Issues
- Commits
- Checks
- Actions
- Branches
- Repository Contents
- Webhooks

Example webhook events:

pull_request
pull_request_review
push
issues
issue_comment
workflow_run
check_run

---

23. Backend

Possible hackathon stack:

Frontend

Next.js / React

Tailwind CSS

PWA support

Monaco Editor or a lightweight mobile diff renderer

Backend

Next.js API routes / Node.js

Database

PostgreSQL / Supabase

Authentication

GitHub OAuth / GitHub App

GitHub

GitHub REST API

GitHub GraphQL API

GitHub Webhooks

AI

LLM API

Used for:

- PR summarization
- Diff explanation
- Risk detection
- Code questions

---

24. Database Model

Core entities:

users
github_installations
repositories
pull_requests
issues
notifications
reviews
ai_reviews

Most source-of-truth development data should remain on GitHub.

Snippet primarily stores:

- GitHub identifiers
- User preferences
- Notification state
- AI analysis
- Cached metadata

This avoids unnecessarily duplicating repository contents.

---

25. Security

Because Snippet may access private repositories, security is critical.

Requirements:

- Minimal GitHub permissions
- Encrypted GitHub tokens
- HTTPS everywhere
- Secure webhook signature verification
- No permanent storage of repository source unless required
- Repository-level permission controls
- Token revocation
- Audit logs for merge/approval actions

Sensitive actions such as merging should require explicit confirmation.

---

26. Hackathon MVP

Do NOT attempt to recreate GitHub.

Build one exceptional workflow.

MVP

1. GitHub login
2. Connect repository
3. Fetch open PRs
4. Mobile PR list
5. PR detail screen
6. Changed files
7. Beautiful mobile diff viewer
8. AI PR summary
9. AI risk analysis
10. Approve PR
11. Merge PR
12. GitHub webhook notifications

That alone demonstrates the complete product idea.

---

27. Demo Scenario

The hackathon demo should tell a story.

Laptop

Developer A modifies code.

They create:

"PR #42 — Fix checkout authentication bug"

Phone

Developer B immediately receives:

Snippet

PR #42 needs your review

Open notification.

Snippet displays:

AI Summary

Fixes an authentication race condition
during checkout.

4 files changed
+82 -31

Reviewer taps:

View Changes

The real Git diff appears.

Then:

AI Review

1 potential issue found.

Reviewer inspects it.

CI finishes:

✓ All checks passed

Reviewer taps:

Approve

then:

Merge

GitHub updates instantly.

Final screen:

✓ PR #42 merged into main

The entire review happens without opening a laptop.

---

28. Key Differentiator

The positioning should NOT be:

«"GitHub but on mobile."»

GitHub already has mobile applications.

Instead:

«"Your engineering approval queue, in your pocket."»

Snippet removes everything unnecessary for quick engineering decisions.

The product focuses on:

Notification → Context → Diff → AI Review → Decision

rather than recreating an entire development platform.

---

29. Future Feature — Voice Review

A user could say:

"Explain the latest authentication PR."

Snippet responds with a concise explanation.

Then:

"Are there any major risks?"

Snippet analyzes the change.

Then:

"Show me the risky section."

The relevant diff opens.

This creates an AI-native mobile development workflow.

---

30. Future Feature — Preview Before Merge

For frontend projects, Snippet could connect to deployment preview systems.

A PR screen could show:

Code       Preview

Selecting Preview launches the temporary deployment.

The reviewer can therefore:

1. Read the PR.
2. Inspect code.
3. See the application running.
4. Approve.
5. Merge.

All from their phone.

---

31. Future Feature — AI Review Agent

Snippet could automatically analyze every new PR.

When a PR is created:

GitHub Webhook
      ↓
Snippet
      ↓
Diff Extraction
      ↓
AI Review Agent
      ↓
Risk Report
      ↓
Phone Notification

Example:

PR #427

AI Review Complete

Risk: Medium

2 possible bugs
1 security concern
3 code-quality suggestions

The human remains responsible for approval and merging.

---

32. Long-Term Vision

Snippet evolves from a mobile GitHub companion into a mobile engineering command center.

Future integrations could include:

GitHub

GitLab

Linear

Jira

Slack

Vercel

Sentry

AWS

Cloudflare

Datadog

The application could eventually answer questions such as:

"What's blocking today's release?"

"Which PRs need me?"

"Did production deployment succeed?"

"Why did CI fail?"

"What changed since yesterday?"

The goal is to let engineering leaders understand and control their development pipeline from anywhere.

---

33. Product Principle

Snippet is not intended to replace an IDE.

It handles the moments where opening an IDE shouldn't be necessary.

Review anywhere. Understand instantly. Ship from your pocket.