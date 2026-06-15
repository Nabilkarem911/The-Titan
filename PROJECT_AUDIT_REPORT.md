# 🔍 Project Audit & Architecture Report

**Project:** Titan — Universal Autonomous Agent Framework  
**Version:** 0.1.0  
**Audit Date:** 2025-01-15  
**Auditor:** MiMo Code Agent (Staff-level Architecture & Security Audit)  

---

## 1. 🏗️ Architecture & Module Map

### Overview

Titan is a **monorepo-based autonomous AI agent framework** built on Node.js/TypeScript. It follows a modular architecture with clear separation of concerns across 13 packages and 2 applications.

### Design Philosophy

- **Event-driven architecture** with Redis-backed queues (BullMQ)
- **Plugin-oriented design** for extensibility
- **Security-first approach** with defense-in-depth (auth, RBAC, rate limiting, abuse detection)
- **Observability-native** with custom metrics, OpenTelemetry integration, and audit hash chains

### Module Dependency Map

```
┌─────────────────────────────────────────────────────────────────┐
│                         APPLICATIONS                            │
│  ┌──────────────┐  ┌──────────────────────────────────────────┐ │
│  │  apps/core   │  │           apps/dashboard                 │ │
│  │  (Fastify    │  │  (React + Vite + Tailwind)               │ │
│  │   HTTP+WS)   │  │  SPA with auth, playground, monitoring   │ │
│  └──────┬───────┘  └──────────────────────────────────────────┘ │
└─────────┼───────────────────────────────────────────────────────┘
          │
┌─────────┼───────────────────────────────────────────────────────┐
│         ▼              CORE PACKAGES                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  auth    │  │ database │  │  queue   │  │ websocket│       │
│  │ JWT/RBAC │  │ pg pool  │  │ BullMQ   │  │ JSON-RPC │       │
│  │ API keys │  │ repos    │  │ workers  │  │ WS server│       │
│  │ crypto   │  │ migrate  │  │ DLQ      │  │ router   │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       │              │              │              │             │
│  ┌────┼──────────────┼──────────────┼──────────────┼─────┐     │
│  │    ▼              ▼              ▼              ▼     │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────┐ │     │
│  │  │agent-eng │  │ sandbox  │  │  tools   │  │memory│ │     │
│  │  │ ReAct    │  │ Docker   │  │ bash/file│  │ pgvec│ │     │
│  │  │ LLM prov │  │ pool     │  │ scrape   │  │ vectr│ │     │
│  │  │ swarm    │  │ security │  │ docker   │  │      │ │     │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────┘ │     │
│  │                                                       │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │     │
│  │  │logging   │  │telemetry │  │observblty│           │     │
│  │  │ pino     │  │ OTEL     │  │ metrics  │           │     │
│  │  │ context  │  │ traces   │  │ abuse    │           │     │
│  │  └──────────┘  └──────────┘  └──────────┘           │     │
│  │                                                       │     │
│  │  ┌──────────────────┐  ┌──────────────┐              │     │
│  │  │     shared       │  │    config    │              │     │
│  │  │ types/schemas    │  │ env/validatn │              │     │
│  │  │ errors/constants │  │ Zod enforced │              │     │
│  │  └──────────────────┘  └──────────────┘              │     │
│  └───────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### Infrastructure Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Runtime | Node.js 22+ | ES2022, ESM modules |
| HTTP Server | Fastify 5.8.5 | REST API + static files |
| WebSocket | ws 8.21.0 | JSON-RPC 2.0 real-time |
| Database | PostgreSQL 16 + pgvector | Relational data + vector embeddings |
| Cache/Queue | Redis 7.4 + BullMQ | Job queues, rate limiting, pub/sub |
| Container Runtime | Docker (dockerode) | Sandboxed code execution |
| Auth | JWT (HS256) + bcrypt + SHA-256 | Access/refresh tokens, API keys |
| Validation | Zod | Input/output schemas everywhere |
| Logging | Pino | Structured JSON logging |
| Metrics | Custom Prometheus renderer | In-process counters/gauges/histograms |
| Telemetry | OpenTelemetry (optional) | Distributed tracing |
| Dashboard | React 18 + Vite + Tailwind | Admin SPA |
| Testing | Vitest 4 | Unit + integration tests |
| Linting | ESLint 10 + TypeScript-ESLint | Strict type-aware rules |

### Build System

- **Workspace manager:** npm workspaces
- **TypeScript:** 5.6.3 with `strict: true`, `NodeNext` module resolution
- **Build order:** shared → config → logging → observability → database → memory → queue → agent-engine → sandbox → tools → auth → websocket → telemetry → core
- **No turborepo/nx** — sequential build via chained npm scripts

---

## 2. 🔐 Security, Reliability & Edge Cases Audit

### 2.1 Authentication & Authorization

| Issue | Severity | Location | Details |
|-------|----------|----------|---------|
| **JWT_SECRET dev default in production** | 🔴 CRITICAL | `config/src/index.ts:28` | The default JWT_SECRET is a hardcoded string. Production invariant check exists (line 207) but relies on `NODE_ENV=production`. If someone deploys without setting NODE_ENV, this check is bypassed. |
| **API_KEY_ENCRYPTION_KEY dev default** | 🟡 MEDIUM | `config/src/index.ts:38` | Same pattern — default value `deadbeef...` is checked in production invariant, but depends on NODE_ENV. |
| **HS256 algorithm** | 🟡 MEDIUM | `auth/src/jwt.ts:37` | Using HMAC-SHA256. Consider RS256/ES256 for asymmetric key support, especially if multiple services need to verify tokens. |
| **No token rotation on privilege change** | 🟡 MEDIUM | `auth/src/service.ts` | When a user's role changes, existing access tokens remain valid until expiry. Should implement a token version/epoch system. |
| **Password hashing cost 12** | 🟢 OK | `auth/src/crypto.ts:5` | bcrypt cost 12 is acceptable. Could consider 13 for future-proofing. |
| **Timing-safe comparison** | 🟢 OK | `auth/src/crypto.ts:34-39` | API key and refresh token verification uses `timingSafeEqual`. Good. |
| **Refresh token reuse detection** | 🟢 OK | `auth/src/service.ts:116-125` | Atomic consume + reuse detection implemented. Good anti-replay protection. |
| **Auth bypass via missing preHandler** | 🔴 CRITICAL | `routes/agents.ts:62-88` | The `GET /agents/:agentId/runs` endpoint at line 62 has `preHandler: requireAuth` but the route handler has a separate `if (!req.auth)` check. However, the `GET /agents/:agentId/runs/:runId` (line 91) and `GET /agents/:agentId/runs/:runId/steps` (line 119) endpoints DO NOT verify that the requesting user owns the agentId. Any authenticated user can read any other user's agent runs by guessing the runId. |
| **No authorization on agent runs** | 🔴 CRITICAL | `routes/agents.ts:91-116` | The `GET /agents/:agentId/runs/:runId` endpoint fetches a run by runId without verifying the run belongs to the requesting user or their workspace. A user can enumerate runIds to access other users' data. |
| **Metrics endpoint unauthenticated** | 🟡 MEDIUM | `routes/metrics.ts:7-10` | `/metrics` and `/metrics.json` endpoints have no authentication. While Prometheus metrics are typically open, `/metrics.json` exposes detailed operational data (DB pool stats, Redis memory, queue stats). |
| **Queue stats admin endpoint no auth** | 🔴 CRITICAL | `routes/metrics.ts:39-46` | `GET /api/v1/admin/queues/:name/stats` has no `requireAuth` middleware. Any unauthenticated user can query queue statistics. |
| **Plugin listing unauthenticated** | 🟡 MEDIUM | `routes/plugins.ts:28-36` | `GET /api/v1/plugins` and `GET /api/v1/plugins/:id` have no auth. Plugin names/descriptions are public, which is fine, but ratings may contain user data. |
| **Plugin rating without auth check** | 🟡 MEDIUM | `routes/plugins.ts:200-223` | `POST /api/v1/plugins/:id/rate` uses `req.auth` without preHandler auth, so `auth?.userId` could be undefined, allowing anonymous ratings. |

### 2.2 Input Validation & Injection

| Issue | Severity | Location | Details |
|-------|----------|----------|---------|
| **SQL injection safe** | 🟢 OK | `database/src/repositories.ts` | All queries use parameterized `$N` placeholders. No string interpolation in SQL. |
| **GDPR table names interpolated** | 🟡 MEDIUM | `database/src/gdpr.ts:28-34` | Table and column names are interpolated into SQL strings (`FROM ${table} WHERE ${column} = $1`). These come from a hardcoded array, so not exploitable, but it's a code smell. |
| **XSS in dashboard SPA** | 🟡 MEDIUM | `dashboard/src/pages/Playground.tsx` | Agent prompts and results are rendered directly in the DOM via React. React escapes by default, so this is safe. But the `result.runId` and `result.jobId` are rendered as `font-mono text-slate-200` without escaping concerns (React handles it). |
| **CORS misconfiguration risk** | 🟡 MEDIUM | `config/src/index.ts:200-205` | The invariant check catches `CORS_CREDENTIALS=true + CORS_ORIGIN=*`, but the `.env.example` has `CORS_ORIGIN=*` with `CORS_CREDENTIALS=true` as defaults. If someone copies `.env.example` to `.env` and forgets to change, the invariant will catch it. Good. |
| **WebSocket message validation** | 🟢 OK | `websocket/src/protocol.ts` | JSON-RPC 2.0 messages are parsed and validated through Zod schemas on registered handlers. |
| **Command injection in bash tool** | 🟡 MEDIUM | `tools/src/tools/bash.ts:57` | Uses `execFile('sh', ['-c', command])` which is safer than `exec(command)`, but the command string itself is passed to `sh -c` which will still interpret shell metacharacters. The `validateCommand` blocklist is good but bypassable (e.g., `bash -c 'rm -rf /'` vs `bash -c 'rm  -rf  /'` with extra spaces). |
| **Docker command splitting** | 🟡 MEDIUM | `tools/src/tools/docker.ts:46` | `command.split(' ')` is naive — doesn't handle quoted arguments with spaces. `Cmd: command.split(' ')` could produce incorrect argument splitting. |

### 2.3 Secrets & Sensitive Data

| Issue | Severity | Location | Details |
|-------|----------|----------|---------|
| **`.env` in repo** | 🔴 CRITICAL | `.env` (root) | The actual `.env` file is present in the repository with development credentials. While `.gitignore` lists `.env`, the file exists on disk. If accidentally committed, secrets are exposed. |
| **Dev credentials in `.env.example`** | 🟡 MEDIUM | `.env.example:21,28,35` | Contains readable development passwords and encryption keys. This is common for dev templates but the values are weak enough that they should never be used in any environment. |
| **LLM API key in env** | 🟡 MEDIUM | `.env:84` | The LLM API key is stored in `.env` — good, but if someone accidentally logs `cfg.LLM_API_KEY` anywhere, it would leak. No evidence of this in the codebase. |
| **Auth failure timing** | 🟢 OK | `auth/src/service.ts:74-76` | On user-not-found, the code still calls `verifyPassword` against a dummy hash to prevent timing attacks. Good practice. |

### 2.4 Race Conditions & Concurrency

| Issue | Severity | Location | Details |
|-------|----------|----------|---------|
| **Refresh token atomic consume** | 🟢 OK | `database/src/repositories.ts:277-288` | Uses `UPDATE ... WHERE ... RETURNING` to atomically claim a refresh token. Good. |
| **Sandbox pool acquire lock** | 🟢 OK | `sandbox/src/pool.ts:179-203` | Uses a promise-based mutex to serialize container acquisition. Prevents double-acquisition race. |
| **Login failure map memory leak** | 🟡 MEDIUM | `routes/auth.ts:57-78` | The `loginFailureByIp` Map is cleaned up every 60s, but only entries older than 5 minutes. An attacker from many IPs could grow this map. Consider a bounded LRU cache. |
| **Global state singletons** | 🟡 MEDIUM | Multiple files | Many packages use module-level singletons (`pool`, `primary` redis, `queues`, `limiters`). This is fine for single-process but prevents multi-instance testing without reset. |
| **WebSocket counter lock** | 🟢 OK | `websocket/src/server.ts:209-221` | Uses a promise-based mutex (`withCounterLock`) for connection counting. Prevents race conditions in user/IP connection limits. |

### 2.5 Error Handling

| Issue | Severity | Location | Details |
|-------|----------|----------|---------|
| **Generic error handler** | 🟢 OK | `server.ts:117-168` | Comprehensive error handler that maps ZodError, TitanError, FastifyError, and generic errors to structured RFC 7807-style responses. |
| **Unhandled rejections** | 🟢 OK | `index.ts:87-94` | Both `unhandledRejection` and `uncaughtException` trigger graceful shutdown. Good. |
| **Queue processor error handling** | 🟢 OK | `queue/src/worker.ts:76-94` | Workers have poison job detection, DLQ migration, and proper error logging. |
| **Silent catch blocks** | 🟡 MEDIUM | `queue/src/client.ts:77` | Empty `catch {}` in Redis memory monitor. While intentional (don't crash on monitoring failure), it should at least log. |

### 2.6 Infrastructure Security

| Issue | Severity | Location | Details |
|-------|----------|----------|---------|
| **Postgres HBA rejects public** | 🟢 OK | `docker/postgres/pg_hba.conf:19-20` | Public IP ranges are rejected. Only private ranges allowed. |
| **Redis bind localhost** | 🟢 OK | `docker/redis/redis.conf:10` | Binds to 127.0.0.1 in dev. Docker network handles inter-service communication. |
| **Redis dangerous commands disabled** | 🟢 OK | `docker/redis/redis.conf:51-56` | FLUSHALL, FLUSHDB, CONFIG, DEBUG, SHUTDOWN, KEYS all renamed/disabled. |
| **Sandbox drops ALL capabilities** | 🟢 OK | `sandbox/src/pool.ts:145-148` | Containers run with `CapDrop: ALL`, `no-new-privileges`, `ReadonlyRootfs`, and `Tmpfs /tmp`. Strong isolation. |
| **Sandbox network isolation** | 🟢 OK | `sandbox/src/pool.ts:131` | Default network mode is `none`. Only enabled when explicitly requested. |
| **Docker socket access** | 🔴 CRITICAL | `sandbox/src/pool.ts` | Sandbox containers don't mount `/var/run/docker.sock` (good), but the tool-level `docker.ts` tool directly interacts with Docker daemon, which could be abused to create privileged containers. |
| **Helmet CSP with unsafe-inline** | 🟡 MEDIUM | `server.ts:60-61` | CSP allows `'unsafe-inline'` for scripts and styles. This weakens XSS protection. Consider nonces or hashes. |

---

## 3. 🛑 Critical Bugs, Anti-Patterns & Technical Debt

### 3.1 Critical Bugs

| # | Bug | Location | Impact |
|---|-----|----------|--------|
| 1 | **Agent runs IDOR (Insecure Direct Object Reference)** | `routes/agents.ts:91-116` | Any authenticated user can read any other user's agent runs by iterating run UUIDs. Missing ownership check. |
| 2 | **Admin queue stats endpoint unprotected** | `routes/metrics.ts:39-46` | `/api/v1/admin/queues/:name/stats` has no auth. Anyone can enumerate queue internals. |
| 3 | **Plugin tool execution without rate limit** | `routes/plugins.ts:146-169` | `POST /api/v1/plugins/:id/execute` executes arbitrary tool calls with only `TOOL_EXECUTE` permission. No per-tool rate limit, no resource limits on execution. |
| 4 | **Swarm route blocks event loop** | `routes/swarm.ts:28-113` | The swarm endpoint does `await orchestrator.plan(task, planner)` and `await orchestrator.execute(task)` synchronously in the HTTP request handler. For complex multi-agent tasks, this could take minutes, blocking the Fastify response and consuming a connection slot. |
| 5 | **Docker exec tool has no sandbox** | `tools/src/tools/docker.ts:77-94` | The Docker `exec` action runs commands directly on any Docker container. Combined with no auth on tool execution in the plugin route, this is a container escape vector. |

### 3.2 Anti-Patterns

| # | Pattern | Location | Issue |
|---|---------|----------|-------|
| 1 | **`any` types in Docker code** | `tools/src/tools/docker.ts:7,8,38,43` | Heavy use of `any` types. The Docker client and container objects are completely untyped. |
| 2 | **Duplicate schema definitions** | `shared/src/schemas.ts` vs `tools/src/schemas.ts` | `ExecuteBashInputSchema`, `PatchFileInputSchema`, etc. are defined in both places with slightly different constraints. This creates confusion about which is canonical. |
| 3 | **Inconsistent auth middleware** | `routes/compliance.ts` vs `routes/agents.ts` | Some routes use `{ preHandler: requireAuth }`, others use `{ preHandler: [async (req) => { await requireAuth(req); }] }`. The wrapped version in compliance.ts creates a new function on every registration. |
| 4 | **Mock implementations in production** | `queue-bootstrap.ts:142-261` | Most queue processors are mocks that return fake data. The `execute_bash` tool, `memory-index`, `sandbox-exec`, etc. all return hardcoded mock responses. This is fine for development but dangerous if deployed to production. |
| 5 | **Memory client creates new pool** | `memory/src/pgvectorProvider.ts:19` | `PgVectorMemoryProvider` creates its own separate PostgreSQL pool (`new Pool(...)`) independent of the main `@titan/database` pool. This wastes connections and bypasses pool monitoring. |
| 6 | **No `MAX_PATH` / directory traversal in readFile** | `tools/src/tools/readFile.ts:14` | `validateCwd` only checks prefixes. A symlink attack could read arbitrary files if the workspace contains symlinks. |
| 7 | **ILIKE in pgvector search** | `memory/src/pgvectorProvider.ts:114` | Uses `ILIKE` for text search. This is O(n) full table scan. For production use, should use pgvector's vector similarity search or full-text search with GIN index. |
| 8 | **`process.exit()` in handlers** | `index.ts:24,28,34,39,82,93,94` | Direct `process.exit()` calls bypass cleanup. Should rely on the shutdown handler instead. |

### 3.3 Technical Debt

| # | Debt | Location | Effort |
|---|------|----------|--------|
| 1 | **No integration tests** | Root | Tests exist for individual modules but no end-to-end API tests that boot the server. | 
| 2 | **No database transaction in workspace creation** | `database/src/repositories.ts:118-133` | Workspace + member creation uses `withTransaction`, but the `members.add` in `workspaces.ts:107` for adding members is NOT transactional with the user existence check. |
| 3 | **Missing `@titan/observability` path in tsconfig.json** | `tsconfig.json:7` | The path `@titan/observability` is missing from `paths` (it's only in `tsconfig.base.json:29`). This could cause type resolution issues. |
| 4 | **Missing `@titan/memory` path in tsconfig.json** | `tsconfig.json:8` | Same issue — `@titan/memory` is only in `tsconfig.base.json:24`. |
| 5 | **Missing `@titan/tools` path in tsconfig.json** | `tsconfig.json` | Only in `tsconfig.base.json:32`. |
| 6 | **Health dashboard leaks internals** | `routes/health.ts:53-93` | `/health/dashboard` exposes DB pool stats, queue stats, audit integrity status. Should require admin auth. |
| 7 | **No CORS on WebSocket** | `websocket/src/server.ts:201-207` | Origin check is done but there's no credential validation. An attacker from an allowed origin can connect. |
| 8 | **Stale `dump.rdb` file in repo root** | Root | Redis dump file committed to repository. Should be gitignored. |
| 9 | **Numerous test scripts in root** | Root | `smoke-tests.ps1`, `test-redis.ps1`, `test-pg.ps1`, etc. are ad-hoc scripts. Should be consolidated into proper test infrastructure. |
| 10 | **No `pnpm-lock.yaml` or `package-lock.json` in `.gitignore`** | `.gitignore` | `package-lock.json` IS committed (which is correct for apps), but should verify this is intentional. |

---

## 4. 📈 Structural Health Score (0-100)

### Overall Score: **72/100**

### Breakdown

| Category | Score | Justification |
|----------|-------|---------------|
| **Code Quality** | 78/100 | Strong TypeScript strict mode, Zod validation everywhere, consistent error handling patterns, and well-structured modules. Docked for duplicate schemas, mock implementations, and inconsistent auth middleware patterns. |
| **Security** | 65/100 | Good foundations (JWT, bcrypt, RBAC, rate limiting, abuse detection, sandbox isolation). Significant gaps: IDOR on agent runs, unprotected admin endpoints, unsafe CSP inline scripts, and tool execution without proper authorization scoping. |
| **Scalability** | 74/100 | Queue-based async processing, connection pooling, Redis-backed rate limiting, and stateless HTTP design. However: in-memory rate limiters and abuse detection won't survive restarts or scale horizontally, swarm route blocks the event loop, and mock processors limit real-world throughput. |
| **Testability** | 68/100 | Good unit test coverage for auth, queue validation, and sandbox. Missing: integration tests, API endpoint tests, E2E tests, and load tests. Mock providers in tests are well-structured. |

---

## 5. 🗺️ Execution Roadmap & Action Checklist

### 🔴 P0 — Immediate (Must Fix Before Production)

- [ ] **Fix IDOR on agent runs** — Add ownership verification to `GET /agents/:agentId/runs/:runId` and `GET /agents/:agentId/runs/:runId/steps` (`routes/agents.ts:91-147`). Verify the run belongs to the authenticated user or their workspace.
- [ ] **Protect admin queue stats endpoint** — Add `requireAuth` + admin permission check to `GET /api/v1/admin/queues/:name/stats` (`routes/metrics.ts:39-46`).
- [ ] **Protect health dashboard endpoint** — Add admin authentication to `GET /health/dashboard` (`routes/health.ts:53-93`).
- [ ] **Remove `.env` from working directory** — Ensure `.env` is never committed. Add pre-commit hook to check.
- [ ] **Fix swarm route blocking** — Move swarm orchestration to a queue worker instead of executing synchronously in the HTTP handler (`routes/swarm.ts:28-113`).
- [ ] **Add proper auth to plugin execution** — `POST /api/v1/plugins/:id/execute` needs workspace-scoped authorization and tool-level rate limiting.
- [ ] **Enforce NODE_ENV in deployment** — Add Dockerfile ENV or deployment check that NODE_ENV=production is always set.

### 🟡 P1 — Short Term (1-2 Weeks)

- [ ] **Consolidate duplicate schemas** — Merge `tools/src/schemas.ts` and `shared/src/schemas.ts`. Keep one canonical source.
- [ ] **Add token versioning** — Implement a `tokenVersion` field on users so privilege changes invalidate existing tokens.
- [ ] **Replace in-memory rate limiters** — Use Redis-backed rate limiting for horizontal scaling (`@fastify/rate-limit` already supports Redis adapter).
- [ ] **Fix CSP unsafe-inline** — Switch to nonce-based CSP for scripts. Fastify + Helmet supports this.
- [ ] **Add path canonicalization** — In `tools/src/tools/readFile.ts` and `patch.ts`, resolve symlinks and verify the final path is still within allowed prefixes.
- [ ] **Add missing tsconfig paths** — Ensure `@titan/observability`, `@titan/memory`, and `@titan/tools` are in the root `tsconfig.json` paths.
- [ ] **Unify memory client pool** — Have `PgVectorMemoryProvider` use the shared database pool from `@titan/database` instead of creating its own.
- [ ] **Fix naive command splitting** — In `tools/src/tools/docker.ts:46`, replace `command.split(' ')` with a proper shell argument parser.
- [ ] **Remove `dump.rdb` from repo** — Add to `.gitignore` and delete from tracking.
- [ ] **Replace `process.exit()` calls** — In `index.ts`, use the shutdown handler instead of direct `process.exit()`.

### 🟢 P2 — Medium Term (2-4 Weeks)

- [ ] **Add integration test suite** — Boot Fastify + testcontainers (Postgres + Redis) and run API tests against all endpoints.
- [ ] **Add E2E tests** — Full flow: register → login → create workspace → trigger agent run → check results.
- [ ] **Implement real queue processors** — Replace mock handlers in `queue-bootstrap.ts` with real implementations (at least for `execute_bash`, `sandbox-exec`, `memory-index`).
- [ ] **Add OpenTelemetry trace context propagation** — Wire up the traceparent header from HTTP into queue jobs and WebSocket messages.
- [ ] **Add request timeout for long operations** — Implement AbortController for agent runs that exceed a configurable timeout.
- [ ] **Add API versioning strategy** — Current `/api/v1/` prefix is good, but document the versioning policy.
- [ ] **Implement connection pooling for LLM providers** — Add HTTP connection pooling for OpenAI/Anthropic API calls.
- [ ] **Add database migration rollback support** — Current migration runner only goes forward. Add a `down` migration mechanism.
- [ ] **Implement audit log retention auto-archive** — The scheduler exists, but add alerts when retention thresholds are breached.
- [ ] **Add CSP report endpoint** — Collect CSP violation reports for monitoring.

### 🔵 P3 — Long Term (1-2 Months)

- [ ] **Switch to RS256/ES256 for JWT** — Asymmetric keys allow multiple services to verify tokens without sharing secrets.
- [ ] **Implement RBAC evaluation caching** — Cache permission lookups in Redis to reduce database hits on every request.
- [ ] **Add GraphQL or gRPC API** — REST is fine for v1, but consider GraphQL for dashboard flexibility.
- [ ] **Implement webhook delivery with retries** — Current webhook processor is a mock. Build with idempotency keys and exponential backoff.
- [ ] **Add multi-tenancy isolation** — Ensure workspace-level data isolation is enforced at the database row level (currently relies on application logic).
- [ ] **Implement rate limiting dashboard** — Expose rate limit metrics and allow admins to adjust limits per-user/workspace.
- [ ] **Add SAML/OIDC SSO support** — Enterprise customers need SSO integration.
- [ ] **Implement agent versioning** — Allow multiple versions of agent configurations with A/B testing support.
- [ ] **Add CI/CD pipeline** — GitHub Actions with lint → typecheck → test → build → Docker build → deploy stages.
- [ ] **Add security scanning** — Integrate Snyk/Trivy for dependency scanning and container image scanning.

---

*Report generated by comprehensive source code analysis of all 13 packages, 2 applications, Docker configuration, and build infrastructure.*
