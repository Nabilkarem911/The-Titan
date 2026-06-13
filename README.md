# Titan Foundation

Universal Autonomous Agent Framework - **Phase 1: Foundation Layer**

This monorepo provides a production-ready foundation for building, deploying, and operating autonomous AI agents. No LangChain. No framework wrappers. Only vanilla Node.js.

## Status

**Phase 1 — Foundation** (complete)

- Docker stack: PostgreSQL 16 (with pgvector) + Redis 7.4
- Queue topology: 8 BullMQ queues with priority, retry, and backoff
- Auth: JWT (RS-style) + API keys (workspace-scoped) + RBAC
- WebSocket: JSON-RPC 2.0 protocol with auth, ping/pong, methods registry
- Config: env-driven with Zod validation; secrets via Vault or .env
- Logging: structured (pino) with async-context propagation
- Telemetry: OpenTelemetry opt-in (loads only when enabled)
- Database: typed repositories + forward-only migration runner

## Repository Layout

```
.
├── apps/
│   └── core/                # Fastify HTTP + WebSocket gateway
├── packages/
│   ├── auth/                # JWT, API keys, password hashing, RBAC
│   ├── config/              # Env loading + validation
│   ├── database/            # pg client + repositories + migrations
│   ├── logging/             # Pino logger + async-context
│   ├── queue/               # BullMQ + ioredis wrapper
│   ├── shared/              # Types, constants, Zod schemas, errors
│   ├── telemetry/           # OpenTelemetry (opt-in)
│   └── websocket/           # JSON-RPC 2.0 server + router
├── docker/
│   ├── postgres/            # init.sql + postgresql.conf
│   └── redis/               # redis.conf
├── docker-compose.yml       # Postgres + Redis (plus optional pgAdmin, RedisInsight)
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
- WebSocket: ws://localhost:3000/ws
- Health: http://localhost:3000/health/live
- Readiness: http://localhost:3000/health/ready

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

- **No LangChain / CrewAI / AutoGen** — agent logic implemented from scratch in Phase 2
- **Vanilla Node.js** — no framework abstractions
- **Stateless services** — all state in PostgreSQL or Redis
- **API-first** — every service is HTTP/WS addressable
- **Queue-first async** — no blocking calls in HTTP handlers
- **Audit log is append-only** — DB-level enforcement via trigger

## License

TBD
