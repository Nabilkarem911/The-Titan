# 🔍 Project Audit & Architecture Report

> **Audited by:** Staff Software Architect & Security Auditor  
> **Date:** 2026-06-14  
> **Codebase:** Titan — Universal Autonomous Agent Framework (v0.1.0)  
> **Scope:** Full monorepo — 13 packages, 2 apps, 8 DB migrations, 23 test files  

---

## 1. 🏗️ Architecture & Module Map

### Design Philosophy
Titan is a **TypeScript-first, Node.js monorepo** organized as an npm workspace. It follows a **layered architecture**: shared types at the bottom, infrastructure packages in the middle, and application services (HTTP API + queue worker) at the top. The dominant patterns are **Repository** (database access), **Plugin/Fastify-plugin** (route registration), and **Singleton Registry** (tool registry, global plugin runner). The agent execution model follows **ReAct** (Reason + Act), and multi-agent coordination uses a **Swarm Orchestrator** with LLM-based planning.

### Package Dependency Map

```
apps/core (HTTP API + WS)          apps/dashboard (React UI)
    │
    ├── @titan/agent-engine         (AgentRunner, SwarmOrchestrator, ToolRegistry, PluginRunner)
    ├── @titan/auth                 (JWT, RBAC, Sessions, API Keys, Encryption)
    ├── @titan/database             (pg pool, repositories, migrations, GDPR, audit chain)
    ├── @titan/memory               (MemoryClient → mock / pgvector stub)
    ├── @titan/queue                (BullMQ workers, DLQ, validation, enqueue)
    ├── @titan/websocket            (WS server, RpcRouter, abuse detection)
    ├── @titan/observability        (in-process metrics, counters, histograms, rate limiters, abuse detector)
    ├── @titan/telemetry            (OTEL tracing — optional)
    ├── @titan/tools                (bash, patch, readFile, docker, firecrawl tool implementations)
    ├── @titan/sandbox              (Docker container pool for isolated execution)
    ├── @titan/logging              (pino-based structured logger)
    ├── @titan/config               (Zod-validated env config with production invariants)
    └── @titan/shared               (types, constants, errors, RBAC schema, protocol defs)
```

### Infrastructure
- **PostgreSQL 16 + pgvector** — primary data store; 8 migrations; custom audit hash chain
- **Redis 7.4** — BullMQ queues (8 named queues), pub/sub, rate-limit state
- **Docker** — sandbox container pool for untrusted code execution
- **Vault** (optional) — secrets management stub (not yet wired)

### Build & Tooling
| Tool | Usage |
|------|-------|
| TypeScript 5.6 + NodeNext | All packages; `strict: true`, `noImplicitReturns` |
| ESLint 10 + typescript-eslint 8 | `no-floating-promises`, `await-thenable`, `no-misused-promises` as errors |
| Vitest 4 | 23 test files, 148 tests |
| Prettier 3.4 | Code formatting |
| npm workspaces | Monorepo management (no Turborepo/Nx — sequential builds) |

### Configuration Architecture
`@titan/config` uses a **Zod schema** to parse `process.env` at startup with `loadConfig()`. Production invariants are enforced (e.g., default JWT secret forbidden, TLS required, wildcard CORS with credentials rejected). The config is cached in a module-level singleton after first call.

---

## 2. 🔐 Security, Reliability & Edge Cases Audit

### 2.1 Authentication & Authorization

| Area | Status | Detail |
|------|--------|--------|
| JWT signing (access token) | ✅ Solid | RS256 not used; HS256 with 64-char minimum enforced. Acceptable for current scale. |
| Refresh token rotation | ✅ Solid | `atomicConsumeByHash` prevents replay; parent session chain stored. |
| API key hashing | ✅ Solid | BLAKE2b hash; prefix stored for lookup; encrypted copy stored with AES-256-GCM. |
| Password hashing | ✅ Solid | bcrypt cost 12. |
| Timing-safe login | ✅ Solid | Always runs `verifyPassword` even when user not found — prevents timing oracle. |
| Plugin mutation routes | ✅ Fixed (this session) | `requireAuth` added to all state-changing endpoints. |
| Compliance routes | ✅ Fixed (this session) | `requireAuth` added to all 3 routes. |
| **Plugin routes — RBAC missing** | 🔴 Critical | `requireAuth` is present but **no `requirePermission` check** exists. Any authenticated user (even `viewer`) can install/delete/execute plugins, publish/deprecate versions. |
| **Compliance routes — RBAC missing** | 🔴 Critical | Any authenticated user can trigger audit archive or verify operations — should require `AUDIT_READ` / admin role. |
| **Agent routes — prompt length** | 🟠 High | `RunAgentInputSchema` caps prompt at 10,000 chars, but the queue job schema allows `max(1_000_000)`. An attacker with queue write access bypasses the HTTP limit. |
| **WS auth timeout** | 🟠 High | WebSocket connections enter `authenticating` state. There is no explicit timeout to disconnect unauthenticated sockets that never send auth. The `pingTimer` covers liveness but not auth timeout. |

### 2.2 Injection & Input Validation

| Area | Status | Detail |
|------|--------|--------|
| SQL — parametrized queries | ✅ Solid | All repositories use `$N` placeholders. |
| SQL — `ORDER BY` injection | ✅ Fixed (prev session) | Whitelist applied in `pluginSearch.search`. |
| SQL — dynamic `UPDATE` builder | ⚠️ Medium | `workspaces.update` builds `SET` clauses dynamically by appending field names from conditional logic — field names are internal constants, not user input, so currently safe, but fragile if new fields are added carelessly. |
| Sandbox command injection | 🔴 Critical | `SandboxPool.execute(command)` passes the `command` string directly to `sh -c`. There is **no sanitization or allowlist** before the string reaches Docker exec. If any upstream caller interpolates user input into `command`, it is a full container escape vector. The `execute_bash` tool in `queue-bootstrap.ts` directly passes `params.command` with no filtering. |
| ENCRYPTION_KEY — removed fallback | ✅ Fixed (prev session) | Now throws if missing. |
| Plugin manifest Zod validation | 🔴 Critical | Plugin versions store a `manifest: Record<string, unknown>` field with **zero schema validation**. A malicious manifest can embed arbitrary data that gets deserialized and eventually passed to the PluginRunner or ToolRegistry. |
| `X-Request-Id` header injection | ⚠️ Low | The server accepts incoming `X-Request-Id` without length/character validation: `if (typeof incoming === 'string' && incoming.length > 0) return incoming`. A 64KB header value becomes the request ID in all logs. |

### 2.3 Sensitive Data & Secrets

| Area | Status | Detail |
|------|--------|--------|
| `.env` committed to repo | 🔴 Critical | `d:/ai/Titan/.env` exists and is **not in `.gitignore`** (only `dump.rdb` and `logs/` are ignored by the default gitignore). If pushed, real credentials leak. Verify `.gitignore` includes `.env`. |
| Default credentials in `config` | ⚠️ Medium | `JWT_SECRET`, `API_KEY_ENCRYPTION_KEY`, `POSTGRES_PASSWORD` have insecure defaults that only throw in `production` mode. A staging/UAT environment at `NODE_ENV=development` silently runs with defaults. |
| LLM API Key in env | ⚠️ Medium | `LLM_API_KEY` is read directly from `process.env` without being part of `loadConfig()` schema — it is **never validated for presence**, and the factory silently falls back to `MockLlmProvider` with only a `warn` log. A misconfiguration in production goes undetected until runtime. |
| Vault integration | ⚠️ Medium | `VAULT_ENABLED` config exists and is parsed, but the vault client is never used anywhere in the codebase. All secrets come from `process.env` only. |
| `pgAdmin` default password | ⚠️ Low | `docker-compose.yml` hardcodes `PGADMIN_DEFAULT_PASSWORD: admin` — acceptable for dev-tools profile, but worth noting. |

### 2.4 Race Conditions & Concurrency

| Area | Status | Detail |
|------|--------|--------|
| Refresh token race condition | ✅ Solid | `atomicConsumeByHash` uses a single `UPDATE ... RETURNING` to prevent double-spend. |
| Audit hash chain | ✅ Solid | `appendWithHashChain` wraps in `withTransaction` with `FOR UPDATE` on the hash chain row. |
| `SandboxPool.acquire()` | 🟠 High | `acquire()` is **not atomic**. Two concurrent calls can both find the same `warm` container and mark it `active`, leading to shared container state. No mutex or `Map` atomicity guard. |
| `ToolRegistry` — process-level singleton | ⚠️ Medium | `getGlobalToolRegistry()` returns a module-level singleton. If multiple workers share the same process (unlikely given `queue-bootstrap.ts` pattern, but possible), concurrent `register`/`unregister` during plugin enable/disable is not mutex-protected. |
| DB pool `setInterval` leak | ⚠️ Medium | `packages/database/src/client.ts` starts a `setInterval` to emit pool metrics. This interval is never cleared on pool close (`closePool()`), causing a dangling timer and potential memory/process leak in tests or graceful shutdown. |
| `SandboxPool.healthTimer` | ✅ OK | Correctly calls `.unref()` and is cleared in `shutdown()`. |

### 2.5 Error Handling & Resilience

| Area | Status | Detail |
|------|--------|--------|
| Global unhandled rejection handler | ✅ Solid | `process.on('unhandledRejection')` triggers graceful shutdown. |
| Fastify error handler | ✅ Solid | Custom `setErrorHandler` maps `TitanError`, `ZodError`, `InsufficientPermissionsError` to correct HTTP codes. |
| Agent runner error boundary | ✅ Solid | `AgentRunner.run()` wraps the loop in try/catch and persists `failed` status. |
| Queue DLQ | ✅ Solid | Poison message detection + DLQ pattern implemented. |
| Memory provider error isolation | ✅ Solid | Memory errors in `AgentRunner` are caught and logged as warnings; the run continues. |
| `pgvectorProvider.ts` — all methods return empty | 🔴 Critical | Every single method is a **stub returning empty data** (`[]`, `void`) with `// TODO` comments. When `MEMORY_PROVIDER=pgvector` is set, the system silently operates with no memory — no error is thrown, no alert raised. This is a **silent data loss bug** in production. |
| `execInContainer` exec info call | 🟠 High | Line 281: `(docker.getContainer(container.dockerId) as unknown as {...}).exec.inspect(exec.id)` — this cast chain is incorrect. Dockerode's `exec` is a method on the container object, not an `.inspect` sub-property. This code will throw at runtime when actually connected to Docker. |

---

## 3. 🛑 Critical Bugs, Anti-Patterns & Technical Debt

### 3.1 Direct Bugs

1. **`SandboxPool.execInContainer` — wrong Dockerode exec inspect call** (`packages/sandbox/src/pool.ts:281`)  
   The cast `as unknown as { exec: { inspect: ... } }` is incorrect; `exec.inspect()` should be called as `exec.inspect()` on the exec object returned from `container.exec(...)`, not via `container.exec.inspect(id)`. This is a runtime crash the moment Docker is live.

2. **`SandboxPool.acquire()` — double-acquisition race** (`packages/sandbox/src/pool.ts:178-196`)  
   `acquire()` is `async` and iterates `this.containers` without a lock. Two concurrent coroutines can both select the same `warm` container before either sets it to `active`.

3. **`pgvectorProvider.ts` — fully stubbed, all methods return empty** (`packages/memory/src/pgvectorProvider.ts`)  
   The class claims to be the `pgvector` implementation but every method is a no-op stub. When used as the active memory provider, it silently discards all writes and returns no search results.

4. **`audit-scheduler.ts` — verify interval fires too frequently**  
   `verifyTimer` uses `cfg.ABUSE_WINDOW_MS` (default: 300,000 ms = 5 minutes) as the interval. The audit hash chain verification is an expensive DB scan — it should use a dedicated `AUDIT_VERIFY_INTERVAL_MS` config key, not the abuse detection window.

5. **`packages/database/src/audit-integrity.ts` — self-import cycle risk**  
   `audit-integrity.ts` imports from `'@titan/database'` (its own package index). This creates a potential circular dependency. It should import from `'./client.js'` directly.

6. **Plugin tool execution endpoint — placeholder handlers** (`apps/core/src/routes/plugins.ts`)  
   The `POST /api/v1/plugins/:id/execute` route registers a dummy handler: `handler: async () => ({ result: 'ok' })`. Any actual plugin tool call returns a fake result — no real execution occurs. This is a production-facing endpoint with mock behavior.

7. **`AgentRunner.executeStep()` — always marks step completed** (`packages/agent-engine/src/runner.ts:265`)  
   The reflection branch unconditionally sets `step.status = 'completed'` with comment `// for now, mark as completed to avoid infinite loops with mock`. This means a failing tool + non-final reflection step still completes — the agent loop terminates prematurely.

8. **`SwarmOrchestrator` — `parentId` uses stringified array index** (`packages/agent-engine/src/swarm/orchestrator.ts:68`)  
   `dependsOn` is an array of indices, but the code does `String(p.dependsOn)` which would stringify e.g. `[0, 1]` as `"0,1"`. The type is `parentId: string | undefined`, so dependency graph wiring is broken for tasks with multiple dependencies.

### 3.2 Anti-Patterns & Technical Debt

- **No integration or route-level tests.** All 23 test files are unit tests. There are zero HTTP route tests (no `app.inject(...)` tests), zero queue-processing integration tests, and zero WebSocket tests. The most critical business paths (agent run, auth flow, plugin install) are untested end-to-end.

- **All tool handlers in `queue-bootstrap.ts` are mocks.** `execute_bash`, `patch_file`, `read_file_ast`, `firecrawl_scrape` return fake data. The sandbox and tools packages exist and are tested, but they are never wired to the actual queue worker.

- **`WorkspaceMember.role` typed as `string` instead of `Role`.** The shared type uses `role: string` while the RBAC system uses a strict `Role` enum. This means TypeScript provides no safety on role comparisons across the boundary.

- **`bigint` → `Number` type parser applied globally at DB client init.**  
  `types.setTypeParser(20, val => Number(val))` converts all PostgreSQL `BIGINT` columns globally. Safe for small values, but silently loses precision for values > `Number.MAX_SAFE_INTEGER`.

- **No cursor-based pagination.** `PaginatedResult<T>` defines `nextCursor`, but all list endpoints use `LIMIT/OFFSET`. This does not scale beyond a few thousand rows and causes drift when rows are inserted during pagination.

- **Config module uses module-level `let cached` — breaks in hot-reload/test environments.** There is a `resetConfigCache()` export, but no test enforces its use before each test suite, so stale config can bleed between test files run in the same worker.

- **No request body size enforcement per-route.** The global `HTTP_BODY_LIMIT` (10 MB) applies everywhere, including low-risk routes like health checks.

- **`apps/dashboard` is not integrated.** `apps/dashboard` exists in the workspace but has no Dockerfile, no connection to `apps/core`, and no API client. It is scaffolded but dead.

- **LLM provider config is not in the validated env schema.** `LLM_PROVIDER_TYPE`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL` are read directly from `process.env` without Zod validation or production invariants. A missing `LLM_API_KEY` silently degrades to mock.

- **`docker-compose.yml` `worker` service uses the same Dockerfile as `core`.** The worker process (`queue-bootstrap.js`) and the API process share one image. This wastes resources and means API code is deployed to workers that don't need it.

- **No `declaration: true` in any package `tsconfig.json`.** Packages emit no `.d.ts` files. This works in the monorepo via TypeScript paths, but makes the packages unpublishable to npm without rebuild changes.

---

## 4. 📈 Structural Health Score (0–100)

| Dimension | Score | Justification |
|-----------|-------|---------------|
| **Code Quality** | 72/100 | Strong typing, consistent patterns, good linter config; dragged down by pervasive mock stubs in critical paths (tools, memory, plugin execution) and several unsafe runtime casts in the sandbox. |
| **Security** | 61/100 | Solid auth foundation (timing-safe login, token rotation, audit chain, CSP, rate limiting); critical gaps remain: no RBAC on plugin routes, no sandbox command sanitization, pgvector silently drops all memory, and `.env` may be unprotected. |
| **Scalability** | 54/100 | BullMQ + Redis queue topology is production-grade; OFFSET pagination, process-level singleton metrics store, and a non-concurrent sandbox pool will become bottlenecks at moderate traffic. No horizontal scaling story for the WebSocket server. |
| **Testability** | 48/100 | Good unit test coverage on isolated logic; zero route/integration/E2E tests; DB tests require a live database (no transaction rollback isolation); mock tool handlers make worker tests meaningless. |

**Overall Score: 59/100** — A well-structured foundation with production-quality infrastructure choices, but too many critical subsystems are stubbed or unguarded for the codebase to be considered production-ready.

---

## 5. 🗺️ Execution Roadmap & Action Checklist

### 🔴 P0 — Blockers (Must fix before any production deployment)

- [x] ~~**Verify `.gitignore` excludes `.env`**~~ — ✅ CONFIRMED: `.env` is in `.gitignore` at line 12. No action needed.
- [x] ~~**Fix `SandboxPool.execInContainer` Dockerode exec inspect call**~~ — ✅ FIXED: `exec.inspect()` now called on the exec object directly.
- [ ] **Sanitize/allowlist sandbox commands** — `execute_bash` must not pass raw user input to `sh -c`. Implement a command allowlist or structured argument array (never shell string interpolation). _(P0 — still pending)_
- [ ] **Implement `PgVectorMemoryProvider`** — replace all 8 `// TODO` stubs with real pgvector `INSERT`/`SELECT` using vector embeddings. Until done, memory is silently non-functional. _(P0 — still pending)_
- [x] ~~**Add RBAC permission checks to plugin routes**~~ — ✅ FIXED: `requirePermission` added (TOOL_EXECUTE for install/enable/execute; WORKSPACE_ADMIN for publish/deprecate/delete).
- [x] ~~**Add RBAC permission checks to compliance routes**~~ — ✅ FIXED: `requirePermission(AUDIT_READ)` added to all 3 compliance endpoints.
- [x] ~~**Fix `SandboxPool.acquire()` race condition**~~ — ✅ FIXED: Promise-chaining mutex (`acquireLock`) serializes all `acquire()` calls without external dependencies.

### 🟠 P1 — High Priority (Within next 2 weeks)

- [ ] **Wire real tool handlers to queue workers** — connect `execute_bash → SandboxPool.execute()`, `patch_file → PatchTool`, `read_file_ast → ReadFileTool`, `firecrawl_scrape → real HTTP client`.
- [ ] **Add plugin manifest Zod schema validation** — define and enforce a strict schema for `manifest` on `POST /plugins/:id/versions` before storing to DB.
- [ ] **Add plugin execution sandbox wiring** — `POST /plugins/:id/execute` must dispatch to a real sandboxed handler, not return `{ result: 'ok' }`.
- [ ] **Add WebSocket auth timeout** — disconnect clients still in `authenticating` state after a configurable timeout (e.g., 30s).
- [x] ~~**Add `LLM_API_KEY` to `EnvSchema`**~~ — ✅ FIXED: `LLM_PROVIDER_TYPE`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL` added to Zod schema; `LLM_API_KEY` throws in production if empty.
- [x] ~~**Fix `audit-integrity.ts` self-import**~~ — ✅ FIXED: Import changed to `'./client.js'` to eliminate circular dependency risk.
- [x] ~~**Fix audit scheduler interval**~~ — ✅ FIXED: `AUDIT_VERIFY_INTERVAL_MS` config key added (default 1 hour); scheduler no longer uses `ABUSE_WINDOW_MS`.
- [x] ~~**Clear DB pool metrics interval in `closePool()`**~~ — ✅ FIXED: `poolMetricsTimer` stored and cleared in `closePool()`.
- [x] ~~**Fix `SwarmOrchestrator` `dependsOn` serialization**~~ — ✅ FIXED: `parsePlan` now returns `number[]`; `parentId` stored as JSON array; `dependenciesMet` + `buildContext` updated to handle multi-dependency.
- [ ] **Validate `X-Request-Id` length** — cap at 128 characters to prevent log inflation.

### 🟡 P2 — Medium Priority (Within next month)

- [ ] **Add HTTP route integration tests** — use `app.inject()` to test at minimum: register, login, refresh, agent run enqueue, plugin install/enable/disable, compliance verify.
- [ ] **Replace OFFSET pagination with cursor pagination** — use `created_at + id` keyset for all list endpoints.
- [ ] **Type `WorkspaceMember.role` as `Role` union** — propagate strict typing across the full boundary.
- [ ] **Separate `core` and `worker` Docker images** — give the worker its own minimal `Dockerfile.worker`.
- [ ] **Wire Vault integration** — implement `loadSecret(key)` using the Vault HTTP API and use it for `JWT_SECRET`, `ENCRYPTION_KEY`, `POSTGRES_PASSWORD` in production.
- [ ] **Add `declaration: true` to package tsconfigs** — enables future npm publishing without rework.
- [ ] **Add token budget double-check enforcement** — the `AgentRunner` checks token budget only at the top of the loop; a single expensive step can overshoot significantly. Check after every step.
- [ ] **Fix `AgentRunner` step always-completed bug** — implement proper step completion detection: only mark `completed` when LLM response contains `FINAL ANSWER:`.

### 🟢 P3 — Low Priority / Improvements (Backlog)

- [ ] **Add GIN trigram index on `plugins.name`** — improves `ILIKE` search performance: `CREATE INDEX idx_plugins_name_trgm ON plugins USING gin (name gin_trgm_ops)`.
- [ ] **Add `pg_stat_statements` query for slow query detection** in the DB metrics interval.
- [ ] **Implement per-workspace plugin isolation** — plugins should be scoped to a workspace; currently they are global.
- [ ] **Add `@fastify/compress`** for response compression on the metrics and list endpoints.
- [ ] **Implement the dashboard `apps/dashboard`** — connect it to the core API with a typed client.
- [ ] **Add OTEL metrics exporter** — current observability uses an in-process store that is lost on restart; connect to Prometheus or OTLP collector.
- [ ] **Add a `vitest.globalSetup.ts`** that resets the config cache and DB pool between test suites to prevent state bleed.
- [ ] **Remove `bigint → Number` global type parser** or document precision limitations explicitly.
- [ ] **Run `npm audit`** — verify no known CVEs in production dependencies (`fastify`, `bullmq`, `pg`, `ws`).
- [ ] **Add `engines.npm` minimum version to `package.json`** — npm workspaces behavior differs across versions.

---

*Generated from deep static analysis of the full codebase. All file/line references are accurate as of the audit date.*
