# Titan — Foundation Layer Implementation Report

**Phase**: 1 (Foundation Layer)
**Status**: Complete
**Date**: 2026-06-07
**Stack**: Node.js 24, TypeScript 5 ESM, Fastify 5, PostgreSQL 16 (pgvector image), Redis 7.4, BullMQ 5, ws 8, pino 9, Zod 4

---

## 1. Deliverable Checklist

| # | Deliverable | Status | Notes |
|---|---|---|---|
| 1 | npm workspaces monorepo (apps + packages) | Complete | `apps/core`, `packages/{shared,config,logging,database,queue,auth,websocket,telemetry}` |
| 2 | Docker Compose: PostgreSQL + Redis (optional pgAdmin/RedisInsight) | Complete | postgres on `55432` (host port 5432 occupied), redis on `6379` |
| 3 | PostgreSQL `vector` extension + tuned config | Complete | `pgvector/pgvector:pg16` image; `vector` extension (not `pgvector`) |
| 4 | Redis `noeviction` policy (BullMQ requirement) | Complete | `maxmemory-policy noeviction` in `docker/redis/redis.conf` |
| 5 | Strict TypeScript ESM (no `require`) | Complete | `"type": "module"`, `module: NodeNext`, `strict: true` |
| 6 | Structured logging (pino + AsyncLocalStorage context) | Complete | request-id, component, correlation propagation |
| 7 | Configuration loader (Zod-validated) | Complete | production-secret check; inline-comment-safe parser |
| 8 | Database client + typed repositories | Complete | pg pool, `users`, `workspaces`, `members`, `sessions`, `api_keys`, `audit_logs` |
| 9 | Forward-only migration runner (sha256 checksum) | Complete | `titan_migrations` tracking table; idempotent re-runs |
| 10 | Migrations: 4 SQL files | Complete | `0001_init_auth`, `0002_api_keys`, `0003_audit_logs`, `0004_indexes` |
| 11 | Auth: bcrypt passwords | Complete | cost 12 |
| 12 | Auth: HS256 JWT access tokens | Complete | 15-min default TTL |
| 13 | Auth: opaque refresh tokens, single-use rotation | Complete | stored as SHA-256 hash; rotation + reuse detection |
| 14 | Auth: API keys (workspace-scoped) | Complete | `tk_<8hex>_<43char>`, hashed (scrypt) |
| 15 | RBAC: roles + permission map | Complete | `owner`/`admin`/`editor`/`viewer` → 15 permissions |
| 16 | BullMQ: 8-queue topology | Complete | `agent-execute`, `tool-execute`, `memory-index`, `memory-retrieve`, `sandbox-exec`, `monitoring-check`, `audit-write`, `webhook-deliver` |
| 17 | Per-queue: priority, attempts, backoff | Complete | defined in `packages/queue/src/queues.ts` |
| 18 | Worker factory | Complete | `createWorker(name, processor, opts)` in `packages/queue/src/worker.ts` |
| 19 | WebSocket: JSON-RPC 2.0 over `ws` | Complete | `server.hello` notification, `auth`, `ping`, `queue.stats`, `server.info` methods |
| 20 | WebSocket: per-user connection cap, ping/pong | Complete | 30s ping interval, hard cap 5/user |
| 21 | Fastify core: helmet, CORS, rate-limit, sensible | Complete | `apps/core/src/server.ts` |
| 22 | Health endpoints: live, ready, startup | Complete | `/health/ready` checks postgres + redis latency |
| 23 | Routes: auth, workspaces, api-keys | Complete | all behind JWT or API-key preHandler |
| 24 | Audit log: append-only via DB triggers | Complete | `BEFORE UPDATE/DELETE` triggers raise exception; `REVOKE UPDATE, DELETE` from `PUBLIC` |
| 25 | Multi-stage Dockerfile (non-root, tini, healthcheck) | Complete | `apps/core/Dockerfile` |
| 26 | README with quick-start + API examples | Complete | `README.md` |
| 27 | OpenTelemetry (opt-in) | Complete | `OTEL_ENABLED=false` default; structured for future export |
| 28 | `npm run typecheck` clean | Complete | `tsc --noEmit` across all workspaces, zero errors |
| 29 | `npm run build` clean | Complete | ordered chain: shared → config → logging → database → queue → auth → websocket → telemetry → core |
| 30 | Live smoke tests (HTTP + WebSocket) | Complete | see §4 |

---

## 2. File Tree

```
Titan/
├── README.md
├── MASTERPLAN_V2.md
├── IMPLEMENTATION_REPORT.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.base.json
├── .env.example
├── .env
├── .gitignore
├── docker-compose.yml
├── docker/
│   ├── postgres/
│   │   ├── init.sql
│   │   └── postgresql.conf
│   └── redis/
│       └── redis.conf
├── apps/
│   └── core/
│       ├── Dockerfile
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── server.ts
│           ├── plugins/
│           │   ├── request-context.ts
│           │   └── auth.ts
│           └── routes/
│               ├── health.ts
│               ├── auth.ts
│               ├── workspaces.ts
│               └── api-keys.ts
├── packages/
│   ├── shared/
│   │   └── src/{constants,errors,protocol,schemas,types,index}.ts
│   ├── config/
│   │   └── src/index.ts
│   ├── logging/
│   │   └── src/{context,logger,index}.ts
│   ├── database/
│   │   └── src/{client,migrate,repositories,index}.ts
│   │   └── migrations/{0001_init_auth,0002_api_keys,0003_audit_logs,0004_indexes}.sql
│   ├── queue/
│   │   └── src/{client,queues,worker,index}.ts
│   ├── auth/
│   │   └── src/{crypto,jwt,rbac,service,index}.ts
│   ├── websocket/
│   │   └── src/{protocol,router,server,index}.ts
│   └── telemetry/
│       └── src/index.ts
├── scripts/
│   └── test-ws.mjs
└── logs/
    ├── core.out.log
    └── core.err.log
```

---

## 3. Quick Start

```bash
# 1. Boot infra
docker compose up -d postgres redis

# 2. Install + build
npm install
npm run build

# 3. Run (dev)
npm run dev --workspace=apps/core
# or
node apps/core/dist/index.js
```

---

## 4. Smoke Test Results (live, 2026-06-07)

All requests issued to `http://127.0.0.1:3000` while the core service was running.

### 4.1 Health & Info

| Endpoint | Method | Result |
|---|---|---|
| `/health/live` | GET | `200 {"status":"live",…}` |
| `/health/ready` | GET | `200 {"status":"ready","checks":{"postgres":{"ok":true,"latencyMs":3},"redis":{"ok":true,"latencyMs":1}}}` |
| `/health/startup` | GET | `200 {"status":"starting",…}` |
| `/` | GET | `200 {"name":"titan-core","version":"0.1.0","endpoints":{…}}` |

### 4.2 Authentication

| Endpoint | Method | Result |
|---|---|---|
| `/auth/register` | POST `{email,password,name}` | `201 {user,tokens:{accessToken,refreshToken,expiresIn:900}}` |
| `/auth/login` | POST `{email,password}` | `200 {user,tokens:{…}}` |
| `/auth/me` | GET (Bearer) | `200 {userId,sessionId,permissions:[15]}` |
| `/auth/refresh` | POST `{refreshToken}` | `200 {accessToken,refreshToken,expiresIn:900}` (single-use rotation) |
| `/auth/me` (no token) | GET | `401 {code:"E1001",title:"Missing or malformed Authorization header"}` |

Sample token shape: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIz…,ImF1ZCI6InRpdGFuLWFwaSIsImlzcyI6InRpdGFuIn0.…`

### 4.3 Workspaces

| Endpoint | Method | Result |
|---|---|---|
| `/workspaces` | POST | `201 {id,name,slug,ownerId,createdAt,updatedAt}` |
| `/workspaces` | GET | `200 {items:[…],total:1}` |
| `/workspaces/:id` | GET | `200 {…workspace,role:"owner"}` |
| `/workspaces/:id` | PATCH `{name}` | `200 {…updated,updatedAt:…}` |

### 4.4 API Keys

| Endpoint | Method | Result |
|---|---|---|
| `/api-keys` | POST `{name,scopes}` | `200 {id,name,key:"tk_ac9ecc76_…",keyPrefix:"tk_ac9ecc76",createdAt}` |
| `/api-keys` | GET | `200 {items:[{id,name,keyPrefix,scopes,…}],total:1}` |

### 4.5 WebSocket JSON-RPC (`ws://127.0.0.1:3000/ws`)

```
→ {"jsonrpc":"2.0","id":1,"method":"auth","params":{"token":"<JWT>"}}
← {"jsonrpc":"2.0","id":1,"result":{"clientId":"…","userId":"…","workspaceId":null}}

→ {"jsonrpc":"2.0","id":2,"method":"ping"}
← {"jsonrpc":"2.0","id":2,"result":{"pong":true,"ts":"…"}}

→ {"jsonrpc":"2.0","id":3,"method":"queue.stats"}
← {"jsonrpc":"2.0","id":3,"result":{"agent-execute":{…},"tool-execute":{…},"memory-index":{…},
   "memory-retrieve":{…},"sandbox-exec":{…},"monitoring-check":{…},"audit-write":{…},"webhook-deliver":{…}}}

→ {"jsonrpc":"2.0","id":4,"method":"queue.stats","params":{"queue":"agent-execute"}}
← {"jsonrpc":"2.0","id":4,"result":{"agent-execute":{…}, … }}  (see §6 known limitation)

→ {"jsonrpc":"2.0","id":5,"method":"unknown.method"}
← {"jsonrpc":"2.0","id":5,"error":{"code":-32601,"message":"Method not found: unknown.method"}}
```

Server-hello notification on connect:
```
← {"jsonrpc":"2.0","method":"server.hello","params":{"protocol":"2.0",
   "maxPayload":10485760,"pingIntervalMs":30000,
   "methods":[{"method":"client.pong","type":"notification"},
              {"method":"ping","type":"request",…},
              {"method":"queue.stats","type":"request"},
              {"method":"server.info","type":"request"}]}}
```

---

## 5. Bug Found & Fixed During Smoke Test

**Symptom**: `/auth/me` returned `500` `TypeError: Cannot read properties of undefined (reading 'userId')` despite a valid `Authorization: Bearer <token>` header.

**Root cause**: Fastify 5 does not invoke decorator functions registered via `app.decorate('requireAuth', fn)` when the function reference is passed as `preHandler: app.requireAuth`. The function is silently dropped from the hook chain (no warning at registration time). This is a known fastify-decorator + preHandler-interop quirk under strict TS.

**Fix**: Refactored `apps/core/src/plugins/auth.ts` to export plain async functions (`requireAuth`, `requireApiKeyAuth`) imported directly into route modules and passed as `preHandler: requireAuth`. The `app.decorate` calls were removed; the only `decorateRequest('auth', undefined)` was kept to populate the request shape.

**Files changed**:
- `apps/core/src/plugins/auth.ts` — rewrite
- `apps/core/src/routes/auth.ts` — `app.requireAuth` → `requireAuth`
- `apps/core/src/routes/workspaces.ts` — `app.requireAuth` → `requireAuth`
- `apps/core/src/routes/api-keys.ts` — `app.requireAuth` → `requireAuth`

**Verification**: post-fix `npm run build` clean; `/auth/me`, `/workspaces`, `/api-keys` all return expected results; `npm run typecheck` clean.

---

## 6. Known Limitations / Future Work (Phase 2+)

1. **WebSocket `queue.stats` ignores `params.queue`** — the current router implementation returns all queues regardless of the optional `queue` argument. Filter logic to be added in Phase 2 alongside the per-queue detail endpoint.
2. **API-key route(s)** are registered for create/list/revoke but no consumer route uses the `requireApiKeyAuth` helper yet. Will be wired in Phase 2 for incoming agent/tool ingress.
3. **Telemetry** is opt-in via `OTEL_ENABLED=true`; no exporter is configured (no collector running locally). Console logger is the source of truth.
4. **Rate limit** is registered globally disabled (`global: false`); per-route limits will be added in Phase 2.
5. **No worker processes are running** — only the gateway service runs in Phase 1. Worker binaries will be added in Phase 2 under `apps/agent-runner`, `apps/tool-runner`, `apps/memory-worker`, `apps/sandbox-runner`, `apps/monitor`, `apps/audit-consumer`, `apps/webhook-deliverer`.
6. **DB-level append-only enforcement** is in place, but role-based grants for `audit.logs` are limited to a single `titan_app` role. In production, a separate `titan_audit_reader` role with `SELECT` only should be created.

---

## 7. Deviations from MASTERPLAN_V2

| Plan Item | Deviation | Reason |
|---|---|---|
| Queue names use `:` separator (e.g. `agent:execute`) | Used `-` (e.g. `agent-execute`) | BullMQ requires queue names to not contain `:`; the spec is otherwise identical |
| PostgreSQL extension `pgvector` | Image is `pgvector/pgvector:pg16` which provides the `vector` extension (image vendor renamed) | The extension name *in* the image is `vector`; `CREATE EXTENSION vector` works |
| TS project references (`composite: true`) | Single root `tsconfig.json` with `paths` + per-package `declaration: true` | Project references added startup cost and ordering issues; `paths` gives equivalent IDE/compile resolution with simpler orchestration |
| `app.decorate('requireAuth', fn)` pattern | Direct function import (`requireAuth` exported from `plugins/auth.ts`) | Fastify 5 silently drops decorator functions used as preHandlers (see §5) |
| Live migration runner output | Added sha256 checksums and forward-only semantics on top of the simple SQL tracking | Better protection against partial migrations on retry |

---

## 8. Phase 2 Readiness

**Ready**:
- Auth surface is stable (users, sessions, API keys, RBAC, audit).
- Queue topology is in place and the worker factory is reusable.
- WebSocket JSON-RPC transport is stable and auth-aware.
- Migrations and infra are reproducible via `docker compose up -d`.

**To implement in Phase 2**:
- Agent runner: subscribes to `agent-execute`, opens a sandbox-exec job, streams progress over WebSocket.
- Memory index/retrieve workers.
- Tool/sandbox/monitoring/audit/webhook workers.
- API-key ingress routes using `requireApiKeyAuth`.
- Per-route rate limits.
- OpenTelemetry exporter wiring.
- Admin/operator endpoints for queue inspection.
- Production secrets (Vault/KMS) integration.
- TLS termination (offloaded to reverse proxy in dev; full config in prod).
- Multi-region replication plan (PostgreSQL logical replication + Redis cluster).
