# ==========================================
# Stage 1: Build Frontend (Expo Web)
# ==========================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package manifests
COPY frontend/package.json frontend/yarn.lock* frontend/package-lock.json* ./

# Install frontend dependencies
RUN if [ -f package-lock.json ]; then npm ci --legacy-peer-deps; \
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    else npm install; fi

# Copy frontend source code
COPY frontend/ ./

# Build production static web bundle into /app/frontend/dist
ENV CI=true
ENV NODE_ENV=production
RUN npx expo export --platform web

# ==========================================
# Stage 2: Production Python Backend + UI
# ==========================================
FROM python:3.11-slim AS runner

WORKDIR /app

# Install system dependencies and Node.js for CLI background agent support
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    build-essential \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install backend Python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r backend/requirements.txt

# Copy backend application source
COPY backend/ ./backend/

# Copy built frontend static bundle from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Default port configuration (dynamically overridden by AWS App Runner $PORT)
ENV PORT=8000
ENV PYTHONUNBUFFERED=1
EXPOSE 8000

WORKDIR /app/backend

# Launch backend (binds to 0.0.0.0:$PORT and serves API + static UI)
CMD ["python", "main.py"]
