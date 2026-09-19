# Backend Review and Refactor Plan

## Scope
This review focuses on backend structure, production readiness, and extensibility for adding features, routes, APIs, and models safely.

## Executive Summary
- The backend is currently a monolithic FastAPI module centered in `server.py` with mixed concerns (routing, business logic, data access, integrations, background processing, and seed data).
- The code works as a prototype but is not production-grade for safe extension.
- Main risks are structural coupling, unsafe operational patterns, weak configuration boundaries, and insufficient test isolation.
- Recommended approach is a phased modular-monolith refactor with strict boundaries, typed config, repository/service layers, and queue-based workers.

## Current State Findings

### 1. Architecture and Modularity
- `server.py` is very large (~1.2k LOC) and contains all major concerns.
- Route handlers directly perform DB queries, external API calls, transformation logic, and auth checks.
- No clear domain/service/repository boundaries.
- Duplicate patterns exist across endpoints (PR action parsing, GitHub API headers, error handling).

### 2. Configuration and Runtime Lifecycle
- Environment loading and config reads happen at import-time.
- DB client is created globally rather than via lifecycle-managed dependency injection.
- Configuration is stringly-typed and scattered across files.

### 3. Security and Compliance Risks
- Sensitive tokens may be logged in OAuth flows.
- CORS is configured as wildcard with credentials.
- GitHub OAuth tokens are persisted in plaintext.
- Agent execution uses shell commands with risky flags and minimal command hardening.

### 4. Background Jobs and Reliability
- Long-running agent work runs in FastAPI `BackgroundTasks`, which is not durable for production job orchestration.
- No robust retry/idempotency policy.
- Process management and trace logging are tightly coupled to request-layer persistence.

### 5. Data and Schema Management
- No explicit schema migration/versioning process.
- Inconsistent datetime handling and data typing.
- Missing formal index strategy for performance and uniqueness guarantees.

### 6. Testing and Quality Gates
- Tests are largely endpoint-level with external environment coupling.
- Limited isolation/mocking of GitHub and LLM integrations.
- No clear CI quality gates for lint/type/coverage/security.

### 7. Repository Hygiene and Developer Experience
- Packaging/dependency strategy is inconsistent (`pyproject.toml` and large `requirements.txt` overlap without a clear source of truth).
- `README.md` is empty.
- Missing baseline repo hygiene items (`.gitignore`, runbooks, env template, make/tasks).

## Target Architecture
Adopt a modular monolith:

- `app/main.py` (application factory and startup lifecycle only)
- `app/api/v1/*` (routers/controllers only)
- `app/services/*` (business use-cases)
- `app/repositories/*` (DB access abstractions and implementations)
- `app/integrations/*` (GitHub/LLM external clients/adapters)
- `app/domain/*` (entities/value objects)
- `app/core/*` (config, security, logging, dependency wiring, error handlers)
- `app/workers/*` (job processors)

Design rules:
- Controllers are thin.
- Services own orchestration.
- Repositories own persistence.
- Integrations are adapter-based and mockable.
- Cross-cutting concerns are centralized.

## Refactor Implementation Plan (No Code Changes in This Document)

### Phase 0: Stabilize and Prepare
- Define target folder structure and ADR for architecture boundaries.
- Add `.gitignore`, `README.md`, `.env.example`, and local setup docs.
- Choose one dependency management path and standardize.
- Add baseline lint/type/test tooling and CI scaffold.

### Phase 1: App Factory and Typed Config Foundation
- Introduce typed settings with strict env validation.
- Implement app factory and lifespan-managed resource initialization.
- Move global clients (Mongo, HTTP clients) into DI providers.
- Add centralized logging config and global exception mapping.

### Phase 2: Route Decomposition Without Behavior Change
- Split routers into domain-focused modules:
  - `auth`
  - `issues`
  - `prs`
  - `saved/applied`
  - `chat`
  - `agent jobs`
- Keep endpoint contracts stable while extracting logic from route handlers.
- Replace repeated parsing/validation logic with reusable helpers.

### Phase 3: Service and Repository Extraction
- Introduce service layer for each domain.
- Introduce repository interfaces + Mongo implementations.
- Move raw Mongo calls out of API layer.
- Centralize cache access behind a cache service abstraction.

### Phase 4: Integration Hardening
- Move GitHub code into `app/integrations/github` with:
  - shared client
  - timeout/retry/backoff
  - rate-limit awareness
  - token lifecycle handling
- Move LLM usage into an adapter with fallback/error policy.
- Remove vendor details from route/service logic.

### Phase 5: Worker/Job System Productionization
- Replace in-process `BackgroundTasks` with durable queue-based workers.
- Model job lifecycle states explicitly with retry and idempotency.
- Isolate subprocess execution with strict security controls and timeouts.
- Add operational limits (max runtime, log truncation, workspace cleanup guarantees).

### Phase 6: Data Model Hardening
- Define explicit schema contracts for stored entities.
- Implement index management strategy:
  - unique and compound indexes where needed
  - TTL for session expiry
  - query-performance indexes for jobs/traces/saved items/cache keys
- Standardize datetime storage and serialization.

### Phase 7: Security Hardening
- Tighten CORS allowlist.
- Introduce token protection strategy (encryption-at-rest where applicable).
- Add CSRF strategy for cookie-auth endpoints.
- Add rate limiting and abuse protections on auth/chat/agent endpoints.
- Add log redaction for secrets and PII.

### Phase 8: Test Strategy Upgrade
- Reorganize tests into unit, integration, and contract suites.
- Mock external integrations by default.
- Add repository tests against ephemeral test DB.
- Add worker/job lifecycle tests.
- Enforce coverage and quality gates in CI.

### Phase 9: Observability and Operations
- Add health/readiness endpoints.
- Add metrics, tracing, and structured logs.
- Create deployment runbooks and rollback procedures.
- Add staged rollout and post-deploy validation checks.

## High-Priority Changes Required
- Break up `server.py` into layered modules.
- Eliminate import-time side effects and globals.
- Introduce typed configuration and dependency injection.
- Replace request-coupled background tasks with durable workers.
- Harden shell execution and secret handling.
- Introduce repository/service abstractions.
- Add schema/index governance.
- Rebuild tests for isolation and reliability.
- Add CI enforcement for lint/type/test/security.

## Suggested Milestones
- Milestone 1: Foundation (Phases 0-1)
- Milestone 2: API decomposition (Phase 2)
- Milestone 3: Domain layering (Phase 3)
- Milestone 4: Integrations + workers (Phases 4-5)
- Milestone 5: Security + data hardening (Phases 6-7)
- Milestone 6: Test/ops maturity (Phases 8-9)

## Definition of Done
- New route/model creation requires only local module changes (no monolith edits).
- External systems are accessed only via typed adapters.
- Background jobs are durable and observable.
- Security and operational controls are enforced by default.
- CI blocks regressions through lint/type/test/security gates.
