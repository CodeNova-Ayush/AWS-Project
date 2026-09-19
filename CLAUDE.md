# CodeTok - CLAUDE.md

## Project Overview

CodeTok is a TikTok-style code review application that displays pull requests in a swipeable feed format. Users can review PRs, see code diffs with syntax highlighting, and take actions (approve, reject, merge) directly from the feed.

**Tech Stack:**
- **Frontend:** React Native (Expo) - TypeScript
- **Backend:** FastAPI (Python) - Async
- **Database:** MongoDB
- **Authentication:** GitHub OAuth
- **GitHub Integration:** GitHub App + OAuth tokens

---

## Architecture

### Frontend (`/frontend`)
- **Framework:** Expo (React Native Web + Mobile)
- **Routing:** Expo Router (file-based routing)
- **State:** React hooks (useState, useEffect)
- **Styling:** StyleSheet with custom theme constants
- **Key Pages:**
  - `app/index.tsx` - Login screen with GitHub OAuth
  - `app/auth-callback.tsx` - OAuth callback handler
  - `app/feed.tsx` - Main PR feed with swipeable cards
  - `app/chat.tsx` - AI chat for issue discussion

### Backend (`/backend`)
- **Framework:** FastAPI with async/await
- **Database:** Motor (async MongoDB driver)
- **GitHub Integration:**
  - `github_app.py` - GitHub App JWT authentication
  - `github_api.py` - GitHub API helpers (repos, PRs, conversion)
  - `server.py` - Main API routes
- **AI Integration:** Emergent LLM for chat functionality

---

## Key Features

### 1. GitHub OAuth Authentication
- **Flow:** Frontend → GitHub OAuth → Callback → Session creation
- **Endpoints:**
  - `GET /api/auth/github/login` - Returns OAuth URL
  - `GET /api/auth/github/callback?code=XXX` - Exchanges code for token
- **Session:** 7-day cookie-based sessions stored in MongoDB

### 2. Dual PR Sources
- **Personal Repos (OAuth):** User's personal repositories via OAuth token
- **Organization Repos (GitHub App):** Organization repositories via GitHub App installation
- **Tabs:** "Organisation" vs "My Repos" in the feed

### 3. PR Fetching & Display
- **Filtering:** Shows only bot-created PRs (configurable via `filter_bot` parameter)
- **Conversion:** GitHub PRs → CodeIssue format with diffs, syntax highlighting, trajectory
- **Limits:** 10 repos max, 5 PRs per repo (to avoid rate limits)

### 4. PR Actions
- **Approve:** Creates approval review on GitHub
- **Reject:** Creates "Request Changes" review
- **Merge:** Merges the PR on GitHub
- **Endpoints:**
  - `POST /api/prs/{issue_id}/approve`
  - `POST /api/prs/{issue_id}/reject`
  - `POST /api/prs/{issue_id}/merge`

### 5. Bot PR Detection
GitHub PRs are filtered for bot-created ones using:
- PR author type === "Bot"
- PR labels contain "bot" or "automated"
- Can be disabled by setting `filter_bot=False`

---

## Environment Variables

### Backend (`.env`)

```env
# MongoDB
MONGO_URL=mongodb://localhost:27017
DB_NAME=codetok

# AI API Keys
EMERGENT_LLM_KEY=your_anthropic_key
ANTHROPIC_API_KEY=your_anthropic_key

# GitHub OAuth (for user authentication)
GITHUB_OAUTH_CLIENT_ID=Ov23li...
GITHUB_OAUTH_CLIENT_SECRET=your_secret
GITHUB_REDIRECT_URI=http://localhost:8081/auth-callback

# GitHub App (for organization access)
GITHUB_APP_ID=your_app_id
GITHUB_APP_PRIVATE_KEY_PATH=github-app-private-key.pem
GITHUB_APP_INSTALLATION_ID=your_installation_id
```

### Frontend (`.env`)

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
```

---

## API Endpoints

### Authentication
- `GET /api/auth/github/login` - Get GitHub OAuth URL
- `GET /api/auth/github/callback?code=XXX` - OAuth callback (sets session cookie)
- `GET /api/auth/me` - Get current user (requires session)
- `POST /api/auth/logout` - Logout (clears session)

### Issues (Legacy - Dummy Data)
- `GET /api/issues` - Get all dummy issues from database
- `GET /api/issues/{issue_id}` - Get specific issue

### PRs (GitHub Integration)
- `GET /api/prs/personal` - Fetch PRs from user's personal repos (requires auth)
- `GET /api/prs/org` - Fetch PRs from org repos via GitHub App (public)
- `GET /api/issues/mixed` - Mix dummy issues with real PRs
- `POST /api/prs/{issue_id}/approve` - Approve PR on GitHub
- `POST /api/prs/{issue_id}/reject` - Request changes on PR
- `POST /api/prs/{issue_id}/merge` - Merge PR on GitHub

### User Actions
- `GET /api/user/saved-ids` - Get user's saved issue IDs
- `POST /api/user/save/{issue_id}` - Save an issue
- `DELETE /api/user/save/{issue_id}` - Unsave an issue

### Chat
- `GET /api/chat/{issue_id}/messages` - Get chat history for issue
- `POST /api/chat/{issue_id}/send` - Send message to AI chat

---

## GitHub Integration Details

### GitHub OAuth (Personal Repos)
**Purpose:** Access user's personal repositories and create PRs/reviews on their behalf

**Setup:**
1. Create OAuth App: https://github.com/settings/developers
2. Set callback URL: `http://localhost:8081/auth-callback`
3. Request scopes: `repo`, `user`
4. Store client ID and secret in `.env`

**Token Storage:** Stored in MongoDB `users` collection as `github_access_token`

### GitHub App (Organization Repos)
**Purpose:** Access organization repositories without requiring user OAuth

**Setup:**
1. Create GitHub App: https://github.com/settings/apps
2. Generate private key (download .pem file)
3. Install app on organization
4. Get installation ID from installation URL
5. Store app ID, private key path, and installation ID in `.env`

**Authentication Flow:**
1. Generate JWT using app ID + private key (`github_app.py`)
2. Exchange JWT for installation token
3. Use installation token to access org repos

**Files:**
- `github-app-private-key.pem` - Private key (in backend directory, not in git)
- `github_app.py` - JWT generation and token exchange
- `github_api.py` - API calls using installation token

---

## Development Workflow

### Starting the App

**Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend
npm start
# Opens on http://localhost:8081
```

### Creating a Test PR
```bash
git checkout -b test-pr-branch
echo "test" >> README.md
git add . && git commit -m "Test PR"
git push origin test-pr-branch
gh pr create --title "Test PR" --body "Testing" --base main --head test-pr-branch
```

### Monitoring Logs
```bash
# Backend logs (if running in background)
tail -f /private/tmp/claude-501/-Users-parthmahajan-Desktop-full-stack-codeTok/tasks/TASK_ID.output

# Watch for PR fetching
tail -f BACKEND_LOG | grep -E "(Found|Converting|Successfully|Failed)"
```

---

## Common Issues & Solutions

### Issue: "GitHub OAuth not configured"
**Cause:** `GITHUB_OAUTH_CLIENT_ID` or `GITHUB_REDIRECT_URI` not set in `.env`
**Solution:** Check `.env` file has correct values, restart backend

### Issue: "GITHUB_APP_ID environment variable not set"
**Cause:** `github_app.py` not loading `.env` file
**Solution:** Ensure `load_dotenv()` is called in `github_app.py` (line 15)

### Issue: Frontend shows 0 PRs
**Possible causes:**
1. No open PRs in repos → Create a test PR
2. Bot filter is enabled and PRs aren't from bots → Set `filter_bot=False` in `server.py`
3. Authentication issue → Check browser DevTools console for 401 errors
4. Rate limit → Wait a few minutes, GitHub has 5000 req/hour limit

**Debug:**
```bash
# Check what backend is returning
curl -s http://localhost:8000/api/prs/org | jq 'length'

# Check with auth (need session cookie)
curl -s http://localhost:8000/api/prs/personal -H "Cookie: session_token=XXX"
```

### Issue: "incorrect_client_credentials" from GitHub
**Cause:** Wrong OAuth client secret in `.env`
**Solution:** Regenerate client secret on GitHub, update `.env`, restart backend

### Issue: Session not persisting
**Cause:** Cookies not being set/sent correctly
**Solution:**
- Check `credentials: 'include'` in all frontend API calls
- Verify cookie settings: `httponly=True, secure=True, samesite="none"`
- For local dev, browsers might block cross-origin cookies

---

## Database Schema

### Collections

**`users`:**
```javascript
{
  user_id: "user_abc123",
  email: "user@example.com",
  name: "John Doe",
  picture: "https://avatars.githubusercontent.com/...",
  github_username: "johndoe",
  github_access_token: "gho_...", // Encrypted in production
  created_at: "2025-01-01T00:00:00Z"
}
```

**`user_sessions`:**
```javascript
{
  user_id: "user_abc123",
  session_token: "session_xyz789",
  expires_at: "2025-01-08T00:00:00Z",
  created_at: "2025-01-01T00:00:00Z"
}
```

**`issues` (dummy data):**
```javascript
{
  issue_id: "issue_123",
  project: "my-app",
  branch: "fix/auth-bug",
  type: "bug",
  title: "Fix authentication timeout",
  description: "...",
  language: "typescript",
  diff_lines: [...],
  trajectory_steps: [...],
  created_at: "2025-01-01T00:00:00Z"
}
```

**`user_saved_issues`:**
```javascript
{
  user_id: "user_abc123",
  issue_id: "issue_123",
  saved_at: "2025-01-01T00:00:00Z"
}
```

**`chats`:**
```javascript
{
  issue_id: "issue_123",
  user_id: "user_abc123",
  messages: [
    { role: "user", content: "What caused this bug?" },
    { role: "assistant", content: "The session timeout..." }
  ],
  created_at: "2025-01-01T00:00:00Z"
}
```

---

## Code Structure

### Frontend Key Files
- `app/index.tsx` - Login with GitHub OAuth
- `app/auth-callback.tsx` - OAuth callback handler
- `app/feed.tsx` - Main feed (swipeable PR cards, tab switching)
- `src/components/IssueCard.tsx` - Individual PR card with diff viewer
- `src/components/ActionSidebar.tsx` - Approve/Reject/Merge buttons
- `src/services/api.ts` - All API calls to backend
- `src/constants/types.ts` - TypeScript interfaces

### Backend Key Files
- `server.py` - Main FastAPI app, all routes
- `github_app.py` - GitHub App JWT auth
- `github_api.py` - GitHub API helpers
- `github-app-private-key.pem` - Private key (NOT in git)

---

## Security Notes

### Production Considerations
1. **Encrypt GitHub tokens** in database using Fernet or similar
2. **Use environment-specific redirect URIs** (staging vs production)
3. **Enable rate limiting** on API endpoints
4. **Validate session tokens** on every request
5. **Rotate GitHub App private keys** periodically
6. **Use HTTPS** for all redirects and cookies
7. **Add CORS whitelist** instead of allowing all origins

### Current Security Measures
- ✅ httponly cookies (prevent XSS)
- ✅ Session expiration (7 days)
- ✅ OAuth state parameter (prevent CSRF)
- ✅ Scoped GitHub permissions (minimal access)
- ⚠️ Tokens stored in plaintext (TODO: encrypt)
- ⚠️ CORS allows all origins (TODO: whitelist)

---

## Rate Limits

### GitHub API Limits
- **Authenticated requests:** 5000 per hour
- **Unauthenticated:** 60 per hour
- **Current mitigation:** Limit to 10 repos, 5 PRs per repo

### Optimization Strategies
- Cache installation tokens (valid for 1 hour)
- Batch API requests where possible
- Use conditional requests with ETags
- Monitor rate limit headers in responses

---

## Future Enhancements

### Planned Features
- [ ] Real-time PR updates via webhooks
- [ ] PR comment threading in the feed
- [ ] Code review annotations
- [ ] Team collaboration features
- [ ] PR analytics dashboard
- [ ] Mobile app (iOS/Android)

### Technical Improvements
- [ ] Add Redis for caching
- [ ] Implement WebSocket for real-time updates
- [ ] Add comprehensive error logging (Sentry)
- [ ] Write integration tests
- [ ] Add CI/CD pipeline
- [ ] Dockerize the application

---

## Contact & Resources

**Developer:** Parth Mahajan (CTO, Flowbee.ai)
**Year:** 2025

**Useful Links:**
- GitHub OAuth Docs: https://docs.github.com/en/apps/oauth-apps
- GitHub App Docs: https://docs.github.com/en/apps/creating-github-apps
- FastAPI Docs: https://fastapi.tiangolo.com
- Expo Docs: https://docs.expo.dev

---

**Last Updated:** 2026-02-20
