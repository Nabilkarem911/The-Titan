# Titan

Universal Autonomous Agent Framework — **Production-Ready AI Operating System**

This monorepo provides a complete, open-source autonomous AI agent framework. No LangChain. No CrewAI. No AutoGen. Only vanilla Node.js + TypeScript.

> **Live Demo:** [titan.orcanox.xyz](https://titan.orcanox.xyz)

## Status

**Production Deployed & Operational** — Titan is live and executing real agent runs with real tools.

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Foundation (DB, Queue, Auth, Gateway) | ✅ |
| 2 | Agent Engine (ReAct loop, multi-step, rules) | ✅ |
| 3 | Tool Arsenal — real implementations (bash, patch, read, scrape) | ✅ |
| 4 | Agent REST API | ✅ |
| 5 | Dashboard (React + Tailwind + auto-refresh) | ✅ |
| 6 | Execution Sandbox (Docker container pool) | ✅ |
| 7 | Memory / RAG Integration | ✅ |
| 8 | LLM Providers (OpenAI, Claude, any OpenAI-compatible) | ✅ |
| — | Multi-Agent Swarm | ✅ |
| — | Infrastructure Monitoring (Prometheus metrics) | ✅ |

### What Works Right Now

- **Real multi-step ReAct loop** — agent thinks → calls tools → observes → reflects → continues until `FINAL ANSWER`
- **Real tool execution** — `execute_bash` runs actual shell commands on the server, `firecrawl_scrape` fetches live web pages
- **Live Dashboard** — run history with step-by-step timeline, auto-refreshes every 2 seconds while a run is active
- **Full audit trail** — every step (thought, action, observation, reflection, tokens, latency) persisted in PostgreSQL
- **BullMQ workers** — 8 concurrent queues, jobs survive restarts via Redis

## Repository Layout

```
.
├── apps/
│   ├── core/                # Fastify HTTP + WebSocket gateway
│   └── dashboard/           # React + Vite + Tailwind UI
├── packages/
│   ├── agent-engine/        # ReAct loop, AgentRunner, LLM providers
│   ├── auth/                # JWT, API keys, password hashing, RBAC
│   ├── config/              # Env loading + Zod validation
│   ├── database/            # pg client + repositories + migrations
│   ├── logging/             # Pino logger + async-context
│   ├── memory/              # Provider interface + pgvector + semantic search
│   ├── observability/       # Prometheus-compatible metrics
│   ├── queue/               # BullMQ + ioredis wrapper
│   ├── sandbox/             # Docker container pool with resource isolation
│   ├── shared/              # Types, constants, Zod schemas, errors
│   ├── telemetry/           # OpenTelemetry (opt-in)
│   ├── tools/               # Tool registry + implementations
│   └── websocket/           # JSON-RPC 2.0 server + router
├── docker/
│   ├── postgres/            # init.sql + postgresql.conf
│   └── redis/               # redis.conf
├── docker-compose.yml       # Full stack (Postgres + Redis + Core + Worker)
├── Dockerfile               # Multi-stage production image
├── tsconfig.base.json       # Shared TS config
└── package.json             # npm workspaces root
```

## Quick Start

### Prerequisites

- Node.js >= 22
- Docker + Docker Compose
- npm 11+

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env: set JWT_SECRET to a real 64+ char string, change DB password
```

### 3. Start infrastructure

```bash
docker compose up -d postgres redis
```

Optional tools (pgAdmin, RedisInsight):

```bash
docker compose --profile tools up -d
```

### 4. Run database migrations

```bash
npm run db:migrate
```

### 5. Start the core service

```bash
npm run dev:core
```

The service will be available at:
- HTTP: http://localhost:3000
- Dashboard: http://localhost:3000 (proxied from localhost:3000)
- WebSocket: ws://localhost:3000/ws
- Health: http://localhost:3000/health/live
- Readiness: http://localhost:3000/health/ready
- Prometheus Metrics: http://localhost:3000/metrics
- JSON Metrics: http://localhost:3000/metrics.json

## API

### Authentication

```bash
# Register
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"changeme123","name":"User"}'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"changeme123"}'

# Use access token
curl http://localhost:3000/auth/me \
  -H 'Authorization: Bearer <accessToken>'
```

### Workspaces

```bash
# Create
curl -X POST http://localhost:3000/workspaces \
  -H 'Authorization: Bearer <accessToken>' \
  -H 'Content-Type: application/json' \
  -d '{"name":"My Workspace","slug":"my-ws","description":"..."}'

# List
curl http://localhost:3000/workspaces \
  -H 'Authorization: Bearer <accessToken>'
```

### API Keys

```bash
# Create (plaintext returned ONCE)
curl -X POST http://localhost:3000/api-keys \
  -H 'Authorization: Bearer <accessToken>' \
  -H 'Content-Type: application/json' \
  -d '{"name":"ci-cd","scopes":["agent:read","agent:execute"]}'

# Use API key
curl http://localhost:3000/workspaces \
  -H 'X-API-Key: tk_<...>'
```

### Agent Runs

```bash
# Trigger an agent run
curl -X POST http://localhost:3000/api/v1/agents/default-agent/run \
  -H 'Authorization: Bearer <accessToken>' \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Write a hello world in Python","maxSteps":10}'

# List runs
curl http://localhost:3000/api/v1/agents/default-agent/runs \
  -H 'Authorization: Bearer <accessToken>'

# Get run details
curl http://localhost:3000/api/v1/agents/default-agent/runs/<runId> \
  -H 'Authorization: Bearer <accessToken>'
```

### Tools

```bash
# Execute a tool directly
curl -X POST http://localhost:3000/api/v1/tools/execute \
  -H 'Authorization: Bearer <accessToken>' \
  -H 'Content-Type: application/json' \
  -d '{"tool":"execute_bash","params":{"command":"echo hello"}}'
```

### Multi-Agent Swarm

```bash
# Launch a swarm of collaborating agents
curl -X POST http://localhost:3000/api/v1/swarm/run \
  -H 'Authorization: Bearer <accessToken>' \
  -H 'Content-Type: application/json' \
  -d '{
    "description": "Build a weather app",
    "prompt": "Create a weather forecasting web app",
    "agents": [
      {"id":"researcher-1","role":"researcher","name":"Researcher","description":"Research APIs","maxSteps":5,"priority":1},
      {"id":"coder-1","role":"coder","name":"Coder","description":"Write code","maxSteps":10,"priority":2}
    ]
  }'
```

## WebSocket (JSON-RPC 2.0)

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  // Step 1: authenticate
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'auth',
    params: { token: '<accessToken>' }
  }));
};

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id === 1) {
    // Authenticated — invoke a method
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'ping',
      params: {}
    }));
  } else if (msg.id === 2) {
    console.log('Pong:', msg.result);
  }
};
```

### Available RPC methods (Phase 1)

- `auth` — authenticate with JWT or API key
- `ping` — health check
- `server.info` — service info + method list
- `queue.stats` — queue depth and counts

## Queue Topology

| Queue | Priority | Use |
|-------|----------|-----|
| `agent:execute` | High | Agent ReAct loop steps |
| `tool:execute` | High | Tool invocations |
| `memory:index` | Medium | Embedding + vector upsert |
| `memory:retrieve` | Medium | Semantic search |
| `sandbox:exec` | High | Container execution |
| `monitoring:check` | Low | Health/metric collection |
| `audit:write` | Critical | Audit log persistence |
| `webhook:deliver` | Medium | External callbacks |

## Configuration

All configuration is environment-driven. See `.env.example` for the full list. Required values in production:

- `JWT_SECRET` — must be at least 64 characters, never the default
- `POSTGRES_PASSWORD` — strong random value
- `API_KEY_ENCRYPTION_KEY` — 64 hex chars (32 bytes)

Secrets can also be sourced from HashiCorp Vault by enabling `VAULT_ENABLED=true`.

## Development

```bash
# Type-check all workspaces
npm run typecheck

# Build all workspaces
npm run build

# Run a single workspace
npm run dev --workspace=apps/core
```

## Architecture Decisions

- **No LangChain / CrewAI / AutoGen** — agent logic implemented from scratch
- **Vanilla Node.js + TypeScript** — no framework abstractions
- **Stateless services** — all state in PostgreSQL or Redis; horizontal scaling ready
- **API-first** — every service is HTTP/WS addressable
- **Queue-first async** — no blocking calls in HTTP handlers
- **Provider-agnostic LLM** — OpenAI-compatible base URL + any provider (Groq, Together, Claude, Ollama)
- **Docker sandbox isolation** — bash/tools execute in pre-warmed Alpine containers
- **RAG Memory** — semantic search via pgvector, injected into agent context
- **Multi-Agent Swarm** — task decomposition with dependency-aware parallel execution
- **Audit log is append-only** — DB-level enforcement via trigger
- **Prometheus metrics** — agent runs, LLM latency, sandbox usage, queue depth

## Environment Variables (Key)

```bash
# LLM Provider (any OpenAI-compatible or Anthropic)
LLM_PROVIDER_TYPE=openai-compatible  # or 'anthropic'
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o
LLM_BASE_URL=https://api.openai.com/v1

# Optional: Sandbox for tool execution
SANDBOX_ENABLED=true
SANDBOX_IMAGE=alpine:latest
SANDBOX_MIN_POOL=2
SANDBOX_MAX_POOL=8
```

## License

MIT — See [LICENSE](./LICENSE)
