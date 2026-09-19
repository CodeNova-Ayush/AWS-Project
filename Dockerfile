# ==============================================================================
# SNIPPET — Complete Full-Stack Production Container
# Multi-stage build: Expo Web Frontend + FastAPI AI Backend
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Expo Web Frontend
# ------------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package manifests
COPY frontend/package.json frontend/yarn.lock* frontend/package-lock.json* ./

# Install dependencies (ensure clean legacy peer dependencies handling)
RUN npm install --legacy-peer-deps --no-audit --prefer-offline || npm install --legacy-peer-deps

# Copy frontend source code
COPY frontend/ ./

# Build production static web bundle into /app/frontend/dist
ENV CI=true
ENV NODE_ENV=production
RUN npx expo export --platform web

# ------------------------------------------------------------------------------
# Stage 2: Production Python Backend + Runtime
# ------------------------------------------------------------------------------
FROM python:3.11-slim AS runner

WORKDIR /app

# Install system dependencies and Node.js (for sub-agents & CLI operations)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    build-essential \
    pkg-config \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install backend Python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r backend/requirements.txt

# Copy backend application source
COPY backend/ ./backend/

# Copy compiled frontend static bundle from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Default configuration (dynamically overridden by $PORT or docker run -e PORT=...)
ENV PORT=8000
ENV PYTHONUNBUFFERED=1
EXPOSE 8000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

WORKDIR /app/backend

# Launch backend (listens on 0.0.0.0:$PORT and serves API routes + static UI)
CMD ["python", "main.py"]
