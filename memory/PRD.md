# CodeTok — Product Requirements Document

## Overview
CodeTok is a TikTok-style code review platform that lets developers swipe through AI-discovered bugs, performance issues, and code suggestions. Each issue is presented as a full-screen card with syntax-highlighted code diffs, AI investigation trajectories, and integrated AI chat powered by Claude Sonnet 4.5.

## Tech Stack
- **Frontend**: React Native / Expo SDK 54 with Expo Router
- **Backend**: FastAPI (Python) with MongoDB
- **AI**: Claude Sonnet 4.5 via Emergent LLM key (emergentintegrations)
- **Auth**: Emergent-managed Google OAuth

## Core Features

### 1. TikTok-Style Vertical Swipe Feed
- Full-screen cards with FlatList + pagingEnabled
- Snap-to-card scrolling behavior
- 6 pre-seeded code issues (bug fixes, performance, suggestions)

### 2. Code Diff Viewer
- Native Text-based rendering (no WebView)
- Red/green syntax highlighting for added/removed lines
- Terminal-style header with language label
- Line numbers and diff prefixes (+/-)

### 3. Save / Apply / Share Actions
- TikTok-style floating action sidebar (right side)
- Save/bookmark issues (persisted in MongoDB)
- Apply fixes with haptic feedback
- Native share sheet integration

### 4. AI Chat (Claude Sonnet 4.5)
- Per-issue AI chat bottom sheet
- Context-aware: knows the code diff, project, description
- Persistent chat history stored in MongoDB
- Powered by Emergent LLM universal key

### 5. Agent Trajectory
- Visual timeline showing AI investigation steps
- Purple-themed step indicators with connectors

### 6. Google Social Login
- Emergent-managed Google OAuth
- Session-based auth with httpOnly cookies
- Guest browsing supported (auth required for save/chat/apply)

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/issues | No | List all issues |
| GET | /api/issues/{id} | No | Get single issue |
| POST | /api/auth/session | No | Exchange session_id for token |
| GET | /api/auth/me | Yes | Get current user |
| POST | /api/auth/logout | Yes | Logout |
| POST | /api/issues/{id}/save | Yes | Save issue |
| DELETE | /api/issues/{id}/save | Yes | Unsave issue |
| GET | /api/saved-issues | Yes | List saved issues |
| GET | /api/user/saved-ids | Yes | Get saved issue IDs |
| POST | /api/issues/{id}/apply | Yes | Apply fix |
| POST | /api/issues/{id}/share | No | Get share URL |
| GET | /api/issues/{id}/chat | Yes | Get chat history |
| POST | /api/issues/{id}/chat | Yes | Send chat message |
| POST | /api/seed | No | Seed sample data |

## Design System
- **Theme**: "Neon Obsidian" dark mode (#050505 bg, #D0FD3E lime accents)
- **Typography**: System + Courier New for code
- **Spacing**: 8pt grid (4, 8, 12, 16, 24, 32, 48)
- **Border Radius**: 4, 8, 12, 16, 9999
- **Colors**: Error red, Success green, Warning amber, Info blue, Secondary purple

## Future Enhancements
- GitHub repo integration for real code issues
- Team collaboration features
- Custom issue creation/submission
- **Monetization**: Premium AI analysis with deeper code explanations, team seats for enterprise code review
