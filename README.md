<div align="center">

# TITAN

### Universal Autonomous Agent Framework

**Production-Ready AI Operating System — Built From Scratch**

[![Live](https://img.shields.io/badge/Live-titan.orcanox.xyz-blue?style=for-the-badge)](https://titan.orcanox.xyz)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](./LICENSE)

*No LangChain. No CrewAI. No AutoGen. Pure vanilla Node.js + TypeScript.*

---

</div>

## Overview

Titan is a **complete, open-source autonomous AI agent framework** — a full operating system for AI agents that think, plan, use tools, collaborate in swarms, and learn from memory. Every line of code is hand-crafted with zero dependency on agent frameworks.

> **Live Demo:** [titan.orcanox.xyz](https://titan.orcanox.xyz)

---

## Capabilities

| Category | Feature | Details |
|----------|---------|---------|
| **Agent Engine** | Multi-step ReAct Loop | Think → Act → Observe → Reflect → Repeat |
| **Agent Engine** | Multi-Agent Swarm | Task decomposition, parallel execution, synthesis |
| **Agent Engine** | Agent Profiles | Custom system prompts, tool restrictions, step limits |
| **Tools** | Shell Execution | `execute_bash` — sandboxed command execution |
| **Tools** | File Operations | `read_file`, `patch_file` — read and modify files |
| **Tools** | Web Scraping | `firecrawl_scrape` — extract content from any URL |
| **Tools** | Web Search | Brave Search API integration |
| **Tools** | Weather | OpenWeather API integration |
| **Tools** | Plugin System | Hot-loadable tool plugins with manifest files |
| **Memory** | Semantic Search | pgvector embeddings with cosine similarity |
| **Memory** | Local Embeddings | Self-hosted BGE-small-en-v1.5 (384-dim, zero cost) |
| **Memory** | Conversation History | Per-session message persistence |
| **Security** | JWT + Refresh Tokens | Automatic rotation, brute-force protection |
| **Security** | RBAC | 16 granular permissions across 4 roles |
| **Security** | API Keys | Scoped, revocable, with prefix identification |
| **Security** | HMAC Webhooks | Mandatory signature verification |
| **Security** | Audit Logging | Append-only with hash chain integrity |
| **Infrastructure** | 9 BullMQ Queues | Priority-based, persistent across restarts |
| **Infrastructure** | Prometheus Metrics | Agent runs, LLM latency, queue depth, sandbox stats |
| **Infrastructure** | WebSocket | JSON-RPC 2.0 with live run streaming |
| **Infrastructure** | Docker Sandbox | Resource-isolated container pool for tool execution |
| **Dashboard** | React UI | 27+ pages: agents, chat (voice), editor, terminal, files, git, swarm, memory, health, API docs, and more |
| **Dashboard** | Voice Interface | Speech-to-text input + text-to-speech for agent replies |
| **Dashboard** | System Health | Real-time DB pool, queue stats, audit integrity viewer |
| **Dashboard** | API Docs | Interactive endpoint explorer with 55+ documented routes |
| **Deployment** | Dokploy | One-click cloud deployment |
| **Deployment** | Docker Compose | Full stack with single command |
| **Deployment** | Telegram Bot | Agent interaction via Telegram with Arabic Companion profile |

---

## Architecture

```
                    ┌─────────────────────────────────────────────────┐
                    │                   CLIENTS                        │
                    │  Dashboard (React)  │  API  │  Telegram  │  WS  │
                    └────────────────────────┬────────────────────────┘
                                             │
                    ┌────────────────────────▼────────────────────────┐
                    │              TITAN CORE (Fastify)                │
                    │  Auth │ Routes │ Rate Limit │ Error Handler      │
                    └──┬──────────┬──────────┬──────────┬────────────┘
                       │          │          │          │
              ┌────────▼──┐  ┌───▼────┐  ┌──▼───┐  ┌──▼──────────┐
              │   Agent    │  │ Queue  │  │ Auth │  │  WebSocket   │
              │   Engine   │  │(BullMQ)│  │(JWT) │  │ (JSON-RPC)   │
              └────┬───────┘  └───┬────┘  └──────┘  └─────────────┘
                   │              │
         ┌─────────▼────┐   ┌────▼─────────┐
         │ Tool Registry │   │   Workers    │
         │ (Sandbox)     │   │ (9 queues)   │
         └───────────────┘   └──────────────┘
                   │
    ┌──────────────▼──────────────────────────────────┐
    │                  DATA LAYER                       │
    │  PostgreSQL (pgvector)  │  Redis  │  Embed API   │
    └──────────────────────────────────────────────────┘
```

---

## Repository Layout

```
titan/
├── apps/
│   ├── core/                  # Fastify HTTP + WebSocket gateway + workers
│   │   ├── Dockerfile         # Multi-stage production image
│   │   └── Dockerfile.worker  # Dedicated queue worker image
│   └── dashboard/             # React + Vite + Tailwind UI
├── packages/
│   ├── agent-engine/          # ReAct loop, AgentRunner, Swarm Orchestrator
│   ├── auth/                  # JWT, API keys, bcrypt, RBAC
│   ├── config/                # Env loading + Zod validation
│   ├── database/              # pg client + repositories + migrations
│   ├── logging/               # Pino structured JSON logger
│   ├── memory/                # pgvector provider + semantic search + embeddings
│   ├── observability/         # Prometheus-compatible metrics collector
│   ├── queue/                 # BullMQ queues + Redis connection management
│   ├── sandbox/               # Docker container pool with resource isolation
│   ├── shared/                # Types, constants, Zod schemas, error classes
│   ├── telemetry/             # OpenTelemetry (opt-in)
│   ├── tools/                 # Tool registry + implementations + plugins
│   └── websocket/             # JSON-RPC 2.0 server + router
├── services/
│   └── embed/                 # Self-hosted embedding service (BGE-small-en-v1.5)
│       ├── Dockerfile         # Python 3.11 + sentence-transformers
│       ├── main.py            # FastAPI with OpenAI-compatible /v1/embeddings
│       └── requirements.txt
├── docker/
│   ├── postgres/              # init.sql + postgresql.conf + pg_hba.conf
│   └── redis/                 # redis.conf (optimized for queues)
├── docker-compose.yml         # Full stack orchestration
├── tsconfig.base.json         # Shared TypeScript config
└── package.json               # npm workspaces root
```

---

## Deployment

### Option 1: Dokploy (Recommended for Production)

Titan runs on [Dokploy](https://dokploy.com) with separate services for maximum control.

#### Services to Create

| Service | Type | Build Config |
|---------|------|--------------|
| **titan-postgres** | Database (PostgreSQL) | Dokploy managed |
| **titan-redis** | Database (Redis) | Dokploy managed |
| **The-Titan** (core) | Application | Dockerfile: `apps/core/Dockerfile`, Context: `.`, Stage: `runner` |
| **embed** | Application | Dockerfile: `services/embed/Dockerfile`, Context: `services/embed` |

#### Environment Variables for The-Titan

```env
NODE_ENV=production
HTTP_HOST=0.0.0.0
HTTP_PORT=3000

# Database (use Dokploy Internal Host)
POSTGRES_HOST=<postgres-internal-host>
POSTGRES_PORT=5432
POSTGRES_DB=titan-postgres
POSTGRES_USER=titan
POSTGRES_PASSWORD=<strong-password>
POSTGRES_TLS=false

# Redis (use Dokploy Internal Host)
REDIS_HOST=<redis-internal-host>
REDIS_PORT=6379
REDIS_PASSWORD=<strong-password>
REDIS_TLS=false

# Security (REQUIRED — generate unique values)
JWT_SECRET=<64+-char-random-string>
JWT_REFRESH_SECRET=<64+-char-random-string>
API_KEY_ENCRYPTION_KEY=<64-hex-chars>
ENCRYPTION_KEY=<32-char-string>

# LLM Provider
LLM_PROVIDER_TYPE=openai-compatible
LLM_API_KEY=<your-llm-api-key>
LLM_MODEL=auto
LLM_BASE_URL=https://api.openai.com/v1

# Local Embedding Service
EMBEDDING_BASE_URL=http://<embed-internal-host>:8000/v1
EMBEDDING_DIMENSIONS=384
EMBEDDING_API_KEY=local

# Memory
MEMORY_PROVIDER=pgvector

# CORS & Security
CORS_ORIGIN=https://your-domain.com
CORS_CREDENTIALS=true
WS_ALLOWED_ORIGINS=https://your-domain.com
HTTP_CSP_ENABLED=true
PUBLIC_URL=https://your-domain.com

# Optional: Telegram Bot
TELEGRAM_BOT_TOKEN=<bot-token>
TELEGRAM_ALLOWED_CHAT_IDS=<chat-ids>

# Optional: Tool API Keys
GITHUB_TOKEN=<github-pat>
BRAVE_SEARCH_API_KEY=<brave-key>
OPENWEATHER_API_KEY=<openweather-key>
```

#### Deploy Steps

1. Create PostgreSQL and Redis databases in Dokploy
2. Create `embed` application (Dockerfile: `services/embed/Dockerfile`, Context: `services/embed`)
3. Deploy `embed` — wait for it to become healthy (first build ~5 min for model download)
4. Note the `embed` Internal Host from Dokploy
5. Create `The-Titan` application (Dockerfile: `apps/core/Dockerfile`, Context: `.`, Stage: `runner`)
6. Add all env variables (use Internal Hosts from steps 1 & 4)
7. Deploy The-Titan
8. Configure domain/SSL in Dokploy's Domains tab

---

### Option 2: Docker Compose (Self-Hosted)

Single command deploys the entire stack:

```bash
git clone https://github.com/Nabilkarem911/The-Titan.git
cd The-Titan

# Create .env file (see environment variables above)
nano .env

# Launch everything
docker compose up -d
```

This starts:
- **PostgreSQL 16** with pgvector extension
- **Redis 7.4** with optimized config
- **Titan Core** API server
- **Titan Worker** queue processor
- **Embed Service** local embedding model

Optional dev tools:
```bash
docker compose --profile tools up -d
# Adds: pgAdmin (port 5050) + Redis Insight (port 5540)
```

#### Verify

```bash
curl http://localhost:3000/health/live
# {"status":"ok"}

curl http://localhost:3000/health/ready
# {"status":"ok","checks":{...}}
```

---

### Option 3: Local Development

```bash
# Prerequisites: Node.js 22+, Docker, npm 11+

# 1. Install dependencies
npm install

# 2. Start infrastructure only
docker compose up -d postgres redis

# 3. Run database migrations
npm run db:migrate

# 4. Build all packages
npm run build

# 5. Start core in dev mode
npm run dev:core
```

Available at:
- **API:** http://localhost:3000
- **Dashboard:** http://localhost:3000
- **WebSocket:** ws://localhost:3000/ws
- **Metrics:** http://localhost:3000/metrics
- **Health:** http://localhost:3000/health/live

---

## API Reference

### Authentication

```bash
# Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"changeme123","name":"User"}'

# Login → returns { accessToken, refreshToken, user }
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"changeme123"}'

# Refresh token
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<refreshToken>"}'

# Get current user
curl http://localhost:3000/api/v1/auth/me \
  -H 'Authorization: Bearer <accessToken>'
```

### Agent Profiles

```bash
# Create agent profile
curl -X POST http://localhost:3000/api/v1/agent-profiles \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Code Assistant",
    "slug": "code-assistant",
    "systemPrompt": "You are an expert programmer...",
    "allowedTools": ["execute_bash", "read_file", "patch_file"],
    "maxSteps": 15,
    "isPublic": true
  }'

# List your profiles
curl http://localhost:3000/api/v1/agent-profiles \
  -H 'Authorization: Bearer <token>'

# List public profiles
curl http://localhost:3000/api/v1/agent-profiles/public \
  -H 'Authorization: Bearer <token>'
```

### Agent Runs

```bash
# Trigger a run
curl -X POST http://localhost:3000/api/v1/agents/<agentId>/run \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Write a hello world in Python","maxSteps":10}'

# List runs
curl http://localhost:3000/api/v1/agents/<agentId>/runs \
  -H 'Authorization: Bearer <token>'

# Get run with steps
curl http://localhost:3000/api/v1/agents/<agentId>/runs/<runId>/steps \
  -H 'Authorization: Bearer <token>'
```

### Chat (Streaming)

```bash
# Send chat message (SSE streaming response)
curl -N -X POST http://localhost:3000/api/v1/chat \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"agentId":"default-agent","prompt":"Hello, who are you?"}'

# Get chat history
curl http://localhost:3000/api/v1/chat/history?agentId=default-agent \
  -H 'Authorization: Bearer <token>'
```

### Multi-Agent Swarm

```bash
# Launch a swarm (async — returns task ID immediately)
curl -X POST http://localhost:3000/api/v1/swarm/run \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "description": "Build a weather dashboard",
    "prompt": "Create a real-time weather dashboard with charts",
    "agents": [
      {"id":"researcher-1","role":"researcher","name":"API Scout","description":"Find weather APIs","maxSteps":5,"priority":1},
      {"id":"coder-1","role":"coder","name":"Developer","description":"Write the code","maxSteps":15,"priority":2}
    ]
  }'

# Check swarm status
curl http://localhost:3000/api/v1/swarm/<taskId> \
  -H 'Authorization: Bearer <token>'
```

### Webhooks

```bash
# Create webhook
curl -X POST http://localhost:3000/api/v1/webhooks \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"name":"GitHub Push","url":"https://...","events":["push"],"agentId":"default-agent"}'

# Trigger webhook (HMAC signature REQUIRED)
curl -X POST http://localhost:3000/api/v1/webhooks/<id>/trigger \
  -H 'X-Titan-Signature: sha256=<hmac-hex>' \
  -H 'Content-Type: application/json' \
  -d '{"event":"push","repo":"my-repo"}'
```

### Tools

```bash
# Execute a tool directly
curl -X POST http://localhost:3000/api/v1/tools/execute \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"tool":"execute_bash","params":{"command":"echo hello world"}}'
```

### Compliance & Audit

```bash
# List audit logs (paginated, filterable)
curl http://localhost:3000/api/v1/compliance/audit/logs \
  -H 'Authorization: Bearer <token>'

# Verify audit hash chain integrity
curl http://localhost:3000/api/v1/compliance/audit/verify \
  -H 'Authorization: Bearer <token>'

# Get retention info
curl http://localhost:3000/api/v1/compliance/audit/retention \
  -H 'Authorization: Bearer <token>'

# Archive old logs
curl -X POST http://localhost:3000/api/v1/compliance/audit/archive \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"daysOld":365,"batchSize":1000}'
```

### API Keys

```bash
# Create scoped API key (plaintext returned ONCE)
curl -X POST http://localhost:3000/api/v1/api-keys \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"name":"ci-pipeline","scopes":["agent:read","agent:execute"]}'

# Use with X-API-Key header
curl http://localhost:3000/api/v1/agents/default-agent/runs \
  -H 'X-API-Key: tk_<prefix>_<secret>'
```

---

## WebSocket (JSON-RPC 2.0)

Real-time streaming of agent runs and system events:

```javascript
const ws = new WebSocket('wss://titan.orcanox.xyz/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    jsonrpc: '2.0', id: 1,
    method: 'auth',
    params: { token: '<accessToken>' }
  }));
};

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  // Receive live run updates, step completions, etc.
  console.log(msg);
};
```

### RPC Methods

| Method | Description |
|--------|-------------|
| `auth` | Authenticate with JWT or API key |
| `ping` | Health check (returns `pong`) |
| `server.info` | Service info + available methods |
| `queue.stats` | Real-time queue depth and counts |

---

## Queue System

Titan uses **9 BullMQ queues** backed by Redis for reliable async processing:

| Queue | Priority | Purpose |
|-------|----------|---------|
| `audit-write` | Critical (10) | Append-only audit log persistence |
| `agent-execute` | High (7) | Agent ReAct loop execution |
| `tool-execute` | High (7) | Tool invocations |
| `sandbox-exec` | High (7) | Docker container execution |
| `swarm-execute` | High (7) | Multi-agent swarm orchestration |
| `memory-index` | Medium (5) | Embedding generation + vector upsert |
| `memory-retrieve` | Medium (5) | Semantic search queries |
| `webhook-deliver` | Medium (5) | External callback delivery (10 retries) |
| `monitoring-check` | Low (2) | Health/metric collection |

All queues feature:
- Exponential backoff on failure
- Configurable retry attempts
- Automatic cleanup of completed/failed jobs
- Persistent across restarts (Redis-backed)

---

## Embedding Service

Titan includes a **self-hosted embedding service** — no external API costs:

| Property | Value |
|----------|-------|
| Model | `BAAI/bge-small-en-v1.5` |
| Dimensions | 384 |
| API | OpenAI-compatible (`/v1/embeddings`) |
| Runtime | FastAPI + sentence-transformers |
| Cost | **$0** (runs locally) |

The service provides:
- `GET /health` — health check
- `POST /embed` — simple embed endpoint
- `POST /v1/embeddings` — OpenAI-compatible (drop-in replacement)

Model is downloaded at Docker build time, not runtime — cold starts are instant.

---

## Security

| Feature | Implementation |
|---------|---------------|
| **Authentication** | JWT access + refresh token rotation |
| **Authorization** | 16 permissions, 4 roles (owner, admin, member, viewer) |
| **API Keys** | Scoped, revocable, SHA-256 hashed storage |
| **Brute Force** | Login attempt tracking with lockout |
| **Rate Limiting** | Per-endpoint configurable limits |
| **Webhook Security** | Mandatory HMAC-SHA256 signature verification |
| **Chat Isolation** | Session ownership validation |
| **Audit Trail** | Hash-chained append-only logs |
| **CORS** | Configurable origin allowlist |
| **CSP** | Content Security Policy headers |
| **Input Validation** | Zod schemas on every endpoint |
| **Error Handling** | RFC 7807 Problem Details (no stack leaks) |

### Permission System

```
owner  → ALL permissions (16/16)
admin  → All except audit:write and workspace:delete
member → Read + write + execute (no admin operations)
viewer → Read-only access
```

---

## Use Cases

### 1. Coding Assistant

Ask the agent to write, debug, or refactor code. It can execute commands, read files, and iterate until the solution works.

```bash
# "Build me a REST API with Express.js for product management"
# Agent will: think → write code → test it → fix errors → deliver final result
```

### 2. Full Website/App Generation

The agent can build complete projects — frontend, backend, database schema — using its tools:

```bash
curl -X POST https://titan.orcanox.xyz/api/v1/agents/default-agent/run \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Build a complete todo app with React frontend and Express backend with PostgreSQL","maxSteps":20}'
```

**How to get the output:**
- **Dashboard:** Go to Runs → click the run → view each step's output (code blocks, file contents)
- **API:** `GET /api/v1/agents/<agentId>/runs/<runId>/steps` returns all generated content
- **Chat:** The streaming response includes all code and files inline

> **Note:** Files can be managed directly via the Files page in the dashboard or through the `/api/v1/files` endpoints.

### 3. Research & Analysis

```bash
# "Research the top 5 cloud hosting providers, compare pricing, and recommend one for a Node.js app"
# Agent uses: Brave Search → Firecrawl Scrape → Analysis → Structured report
```

### 4. DevOps Automation via Webhooks

```bash
# GitHub push → Titan automatically runs code review
# Error alert → Titan investigates logs and suggests fix
# New issue → Titan researches and drafts a solution
```

### 5. Multi-Agent Swarm for Complex Tasks

For large projects, launch a team of specialized agents:

```bash
# "Build a weather dashboard" →
#   Agent 1 (Researcher): finds weather APIs
#   Agent 2 (Designer): plans the UI
#   Agent 3 (Developer): writes the code
#   Agent 4 (Reviewer): checks quality
# → Final synthesized result
```

### 6. Telegram Bot

Send any message to the configured Telegram bot — the agent processes it and replies directly.

### 7. Knowledge Base / Semantic Memory

Store documents, project docs, or any text. Later, ask questions and the agent searches semantically (understands meaning, not just keywords).

---

## User Management

### Creating Users

Users self-register via the API or dashboard:

```bash
# Register a new user
curl -X POST https://titan.orcanox.xyz/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"teammate@example.com","password":"SecurePass123","name":"Ahmed"}'
```

After registration, the user can log in at your dashboard URL.

### Roles & Isolation

| Role | Can Do | Sees Others' Data? |
|------|--------|-------------------|
| **owner** | Everything (all 16 permissions) | Yes |
| **admin** | Manage users, agents, view all runs | Yes |
| **member** | Create agents, run tasks, chat | **No** — only their own runs |
| **viewer** | Read-only access | **No** — only their own data |

**Key isolation rules:**
- Each user's **chat sessions** are private (ownership check enforced)
- Each user's **agent runs** are private (IDOR protection)
- **Agent profiles** can be private or public (creator controls visibility)
- **Audit logs** require special `AUDIT_READ` / `AUDIT_WRITE` permissions

### Inviting Someone to Use the Dashboard

1. Share your Titan URL (e.g., `https://titan.orcanox.xyz`)
2. They register with their email
3. They log in → see the dashboard with their own workspace
4. They can create agents, chat, run tasks — all isolated from your data

### Admin Controls

As owner, you can:
- View all users via admin endpoints
- Assign roles
- Revoke API keys
- View audit logs of all actions

---

## Dashboard

The built-in React dashboard is a full-featured control center with **27+ pages** across 5 sections:

### Workspace
| Page | Description |
|------|-------------|
| **Dashboard** | Project overview, quick stats, recent activity |
| **Projects** | Workspace project management |
| **Chat** | Real-time streaming conversations with agents, voice input (mic icon), text-to-speech |
| **Agents** | Browse and manage agent profiles |
| **Playground** | Quick agent run trigger with parameter tuning |
| **Files** | File manager — browse, upload, download, delete files and folders |
| **Editor** | Monaco code editor with syntax highlighting |
| **Terminal** | xterm.js terminal with WebSocket shell execution |
| **Git Push** | Git operations directly from the dashboard |
| **Teams** | Workspace members management (invite, roles, remove) |
| **Templates** | Agent profile templates — create, edit, share |
| **Swarm** | Launch and monitor multi-agent tasks |
| **Memory** | Chat history sessions viewer |
| **Getting Started** | Onboarding guide for new users |

### Operations
| Page | Description |
|------|-------------|
| **Run History** | Step-by-step execution timeline with live WebSocket updates |
| **Queues** | Real-time BullMQ queue statistics |
| **Metrics** | Database pool, Redis, LLM latency, sandbox stats |
| **Cron Jobs** | Scheduled task management |
| **Logs** | Live log stream via WebSocket |
| **Webhooks** | Webhook management with delivery logs |
| **Audit Logs** | Tamper-evident audit trail viewer |

### System
| Page | Description |
|------|-------------|
| **Settings** | Profile, LLM keys, theme, dark mode |
| **API Keys** | Create and revoke scoped API keys |
| **Plugins** | Plugin marketplace — install and manage community tools |
| **API Docs** | Interactive API endpoint explorer (55+ endpoints) |

### Admin
| Page | Description |
|------|-------------|
| **System Health** | Real-time DB pool, queue stats, audit integrity, archival status |

### Features
- **Dark Mode** — Toggle between light/dark themes
- **Global Search** — `Ctrl+K` quick navigation across all pages
- **Notifications Bell** — Real-time WebSocket notifications for agent runs
- **Voice Interface** — Speech-to-text input + text-to-speech read-aloud in Chat
- **Responsive Design** — Works on desktop and mobile

Access at your deployment URL after login.

---

## Roadmap

Planned features for upcoming releases:

| Feature | Priority | Status | Description |
|---------|----------|--------|-------------|
| **File Manager** | High | **Done** | Upload/download files to/from agents, browse generated outputs |
| **Advanced Dashboard** | High | **Done** | Full project management UI with file tree, terminal, editor, and git |
| **Workspace Teams** | Medium | **Done** | Invite members to shared workspaces with granular permissions |
| **Plugin Marketplace** | Medium | **Done** | Install community tools with one click |
| **Scheduled Runs** | Medium | **Done** | Cron-based agent execution (e.g., daily reports) |
| **Agent Templates** | Low | **Done** | Pre-built agent profiles for common tasks |
| **Voice Interface** | Low | **Done** | Speech-to-text input + text-to-speech read-aloud in Chat |
| **System Health** | High | **Done** | Real-time DB pool, queue stats, audit integrity viewer |
| **API Documentation** | Medium | **Done** | Interactive endpoint explorer with 55+ documented routes |
| **Onboarding** | Medium | **Done** | Getting Started welcome page for new users |
| **Memory Page** | Medium | **Done** | Chat history sessions viewer |
| **Mobile App** | Low | Pending | iOS/Android companion app |

---

## Development

```bash
# Type-check all packages
npm run typecheck

# Build everything
npm run build

# Run tests (169 tests)
npm test

# Build specific package
npm run build:shared
npm run build:core

# Dev mode with hot reload
npm run dev:core
```

### Project Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build all packages in dependency order |
| `npm test` | Run full test suite (Vitest) — 169 tests |
| `npm run dev:core` | Start core with hot reload |
| `npm run dev:dashboard` | Start dashboard dev server (Vite) |
| `npm run db:migrate` | Run database migrations |
| `npm run build:dashboard` | Build React dashboard for production |
| `npm run build:database` | Build database package |

> **Production Note:** When deployed over HTTPS, WebSockets automatically use `wss://`. The dashboard detects `window.location.protocol` and switches between `ws://` (dev) and `wss://` (production).

---

## Architecture Decisions

- **No LangChain / CrewAI / AutoGen** — agent logic implemented from scratch for full control
- **Vanilla Node.js + TypeScript** — zero framework abstractions, maximum transparency
- **Stateless services** — all state in PostgreSQL/Redis; horizontal scaling ready
- **API-first** — every capability is HTTP/WS addressable
- **Queue-first async** — no blocking calls in HTTP handlers; swarm runs are enqueued
- **Provider-agnostic LLM** — any OpenAI-compatible endpoint (OpenAI, Groq, Together, Ollama, vLLM)
- **Local-first embeddings** — self-hosted model, zero cost, zero rate limits
- **Docker sandbox isolation** — tools execute in ephemeral Alpine containers
- **Append-only audit** — DB-level enforcement via trigger, hash chain integrity
- **Multi-agent orchestration** — plan → execute → synthesize with dependency-aware parallelism
- **Personality-first system prompts** — agent tone and formatting instructions prioritized over technical ReAct boilerplate
- **Auto-detect WebSocket protocol** — `wss://` for HTTPS, `ws://` for HTTP, zero config needed
- **Context block enrichment** — formatting reminders injected on every interaction for consistent output quality

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22, TypeScript 5 (strict) |
| HTTP | Fastify 5 |
| WebSocket | ws + JSON-RPC 2.0 |
| Database | PostgreSQL 16 + pgvector |
| Cache/Queue | Redis 7.4 + BullMQ |
| Frontend | React 18 + Vite + Tailwind CSS + shadcn/ui patterns |
| Editor | Monaco Editor (@monaco-editor/react) |
| Terminal | xterm.js with WebSocket shell |
| Icons | Lucide React |
| Embeddings | Python 3.11 + FastAPI + sentence-transformers |
| Validation | Zod |
| Logging | Pino (structured JSON) |
| Metrics | Prometheus-compatible |
| Testing | Vitest |
| Container | Docker multi-stage builds |
| Deployment | Dokploy / Docker Compose |

---

## License

MIT — See [LICENSE](./LICENSE)

---

<div align="center">

**Built with determination by [Nabil Karem](https://github.com/Nabilkarem911)**

*Titan — Because AI agents deserve a real operating system.*

</div>
