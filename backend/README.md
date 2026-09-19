# CodeTok Backend

FastAPI backend for the CodeTok PR-review feed.

## Setup

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements_temp.txt
cp .env.example .env          # fill in your values
```

## Start

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Run Tests

```bash
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000 pytest tests/ -v
```

## Project Layout

```
backend/
├── app/
│   ├── main.py              # App factory + lifespan
│   ├── core/                # Config, DB DI, security, error handlers
│   ├── domain/              # Pydantic models
│   ├── repositories/        # MongoDB collection helpers
│   ├── services/            # Business logic
│   ├── integrations/        # GitHub API + App clients
│   └── api/v1/              # FastAPI route modules
├── agent_manager.py         # Background agent subprocess runner
├── main.py                  # Entry-point stub (imports app.main.app)
└── .env                     # Local environment variables (not in git)
```
