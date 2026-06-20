# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Titan

Universal Autonomous Agent Framework — a production AI system built from scratch (no LangChain/CrewAI). Monorepo with a Fastify API, BullMQ job queues, WebSocket server, React dashboard, and 40+ agent tools.

## Commands

```bash
# Install (from root — --legacy-peer-deps required)
npm install --legacy-peer-deps

# Build everything (correct dependency order)
npm run build

# Build specific targets
npm run build:core          # Backend API
npm run build:dashboard     # React dashboard (Vite)

# Development
npm run dev:core            # tsx watch on localhost:3000
npm run dev:dashboard       # Vite dev server on localhost:5173

# Quality
npm run typecheck           # tsc --noEmit across all packages
npm run lint                # ESLint
npm run lint:fix
npm run test                # Vitest
npm run test:watch
npm run check               # lint + typecheck + test

# Infrastructure
npm run docker:up           # Start PostgreSQL + Redis + embed service
npm run docker:down
npm run db:migrate          # Run SQL migrations

# Docker production build (from monorepo root)
docker build -f apps/core/Dockerfile -t titan-core .
```

## Architecture

### Package dependency graph (build order matters)

```
shared → config → logging → observability → telemetry
                → database → auth
                → memory
                → queue
                → sandbox → tools
                → agent-engine
                → websocket
                         → apps/core (consumes all)
                         → apps/dashboard (standalone React)
```

### Backend route prefixes

Not all routes live under `/api/v1`. This matters for the dashboard:

| Prefix | Routes |
|--------|--------|
| `/api/v1/` | auth, agents, files, cron, webhooks, chat, git, plugins, search, analytics, etc. |
| `/health/` | live, ready, startup, dashboard (NO `/api/v1` prefix) |
| `/metrics`, `/metrics.json` | Prometheus metrics (NO `/api/v1` prefix) |
| `/ws` | WebSocket endpoint |
| `/telegram/webhook` | Telegram bot webhook |

### Auth flow

Two auth methods, resolved in `apps/core/src/plugins/auth.ts`:
- **JWT Bearer** — `Authorization: Bearer <token>` → validates signature, loads user context
- **API Key** — `X-API-Key: <key>` → decrypts with `API_KEY_ENCRYPTION_KEY`, looks up in DB

Login returns `{ user, tokens: { accessToken, refreshToken } }` — note the nested `tokens` object.

### Queue system (BullMQ + Redis)

9 queues: `agent-execute`, `tool-execute`, `memory-index`, `memory-retrieve`, `sandbox-exec`, `monitoring-check`, `audit-write`, `webhook-deliver`, `swarm-execute`. Queue names defined in `packages/shared/src/constants.ts`.

### Database

PostgreSQL with pgvector. Migrations are versioned SQL files in `packages/database/src/migrations/` with SHA-256 checksums. Repository pattern for data access.

### Dashboard

React 18 + Vite + Tailwind. Key CSS classes defined in `apps/dashboard/src/index.css`: `card`, `btn-primary`, `btn-secondary`, `btn-danger`, `input`, `badge-*`. Uses `dark` class for theme switching.

The dashboard's `API_BASE` defaults to `/api/v1` via `VITE_API_BASE_URL` env var. Static assets served by Fastify from `apps/dashboard/dist/`.

### Server onRequest hook

`apps/core/src/server.ts` has a global abuse-detection hook that runs on every request. Static assets (`/assets/*`, `.js`, `.css`, `.ico`, fonts) are skipped. If you add new non-API routes, add them to the skip list or they'll get blocked after failed requests.

## Environment

Required in `.env` (see `.env.example` for full list):
- `JWT_SECRET` (≥64 chars), `API_KEY_ENCRYPTION_KEY` (32-byte hex)
- `POSTGRES_HOST/PORT/DB/USER/PASSWORD`, `REDIS_HOST/PORT`
- `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL`

## GitHub

- Provider: `gh`
- Organization: `Nabilkarem911`
- Repository: `The-Titan`
