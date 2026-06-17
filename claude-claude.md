# Titan Project — Full Audit Report

**Date:** 2026-06-17
**Audited by:** 5 Specialized AI Agents
**Scope:** Full monorepo (apps/core, apps/dashboard, packages/*)

---

## Executive Summary

| Agent | Critical | High | Medium | Low | Good Practices |
|-------|----------|------|--------|-----|----------------|
| Security | 4 | 7 | 6 | 4 | 5 |
| Architecture | 5 | 10 | 9 | — | — |
| Code Quality | 6 | 7 | 7 | — | — |
| DevOps | 9 | 15 | 5 | — | 3 |
| Frontend | 4 critical + 4 high | 4 medium | 3 low | — | — |
| **Total** | **~28** | **~43** | **~30** | **~7** | **8** |

---

# PART 1 — SECURITY AUDIT

## [CRITICAL] XOR Encryption for User API Keys
**File:** `apps/core/src/routes/user-keys.ts:25-43`

```typescript
function encrypt(value: string): string {
  const key = getEncryptionKey();
  let result = '';
  for (let i = 0; i < value.length; i++) {
    result += String.fromCharCode(value.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return Buffer.from(result, 'binary').toString('base64');
}
```

XOR is **not encryption**. If an attacker knows one plaintext-ciphertext pair, they recover the key and decrypt everything. The fallback key is a hardcoded string: `'titan-default-key-change-me-now!'`. Real AES-256-GCM already exists in `packages/auth/src/encryption.ts` but is not used here.

Additionally, endpoint `GET /api/v1/user/keys/:keyId/value` returns the decrypted key over HTTP — any token leak exposes all user keys.

**Fix:** Replace XOR with the existing AES-256-GCM from `packages/auth/src/encryption.ts`.

---

## [CRITICAL] Telegram Webhook — No Secret Verification
**File:** `apps/core/src/routes/telegram.ts:128-131`

```typescript
app.post('/telegram/webhook', {
  config: { rawBody: true },
}, async (req, reply) => {
  const update = req.body as TelegramUpdate;
```

No verification of `X-Telegram-Bot-Api-Secret-Token` or source IP. Anyone who knows the webhook URL can send fake messages and trigger the agent.

**Fix:** Register the webhook with a `secret_token` and validate it on every request.

---

## [CRITICAL] Forced SSH Prompt Injection via Telegram
**File:** `apps/core/src/routes/telegram.ts:213-215`

```typescript
isServerRequest
  ? `\n\n FORCED ACTION -- The user is asking you to access a server. You MUST use execute_bash tool to run ssh/sshpass commands...`
  : '',
```

Combined with the unverified webhook above, any attacker can force the LLM to execute arbitrary SSH commands. Credentials get logged in agent history.

**Fix:** Remove `FORCED ACTION` prompt. Let the LLM decide tool usage naturally.

---

## [CRITICAL] Command Injection in ZIP Compression
**File:** `apps/core/src/routes/files.ts:170-178`

```typescript
execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${targetDir}\\*' ..."`)
execSync(`cd "${targetDir}" && zip -r "${tmpZip}" .`)
```

`targetDir` and `tmpZip` are built from `userId` without shell escaping. If userId contains shell metacharacters, arbitrary command execution is possible.

**Fix:** Use `node:child_process.execFile` with array arguments, or use a JS zip library (archiver/yazl).

---

## [HIGH] Arbitrary File Read via Chat Endpoint
**File:** `apps/core/src/routes/chat.ts:39-51`

```typescript
for (const filePath of input.files) {
  const content = await readFile(filePath, 'utf-8');
```

User-supplied file paths are read directly from the filesystem without validating they're inside the user's workspace. Can read `/etc/passwd`, `.env`, SSH keys, etc.

**Fix:** Validate all file paths against `getWorkspaceRoot(userId)` using `validatePath`.

---

## [HIGH] No File Type Validation on Upload
**File:** `apps/core/src/routes/files.ts:102-109`

No MIME type check, no extension allowlist, no magic bytes validation. Executables, web shells, or malicious files can be uploaded.

---

## [HIGH] Filename Used Directly Without Sanitization
**File:** `apps/core/src/routes/files.ts:103-104`

```typescript
const filePath = join(targetPath, part.filename);
```

`part.filename` comes from the request. Names like `../../etc/cron.d/shell` may bypass `join()` protection.

---

## [HIGH] `/metrics` Endpoint Open Without Authentication
**File:** `apps/core/src/routes/metrics.ts:8-11`

Exposes internal metrics (connection counts, DB stats, error rates) to anyone.

---

## [HIGH] Weak Session Ownership Check
**File:** `apps/core/src/routes/chat.ts:269`

```typescript
if (!sessionId.includes(userId)) { throw ... }
```

`includes` is too weak — userId `"abc"` passes for sessionId `"xyzabc123"`.

**Fix:** Use exact prefix match: `sessionId.startsWith(\`session:${userId}:\`)`.

---

## [HIGH] Swarm Tasks Visible to All Users
**File:** `apps/core/src/routes/swarm.ts:73-89`

Any authenticated user can see all swarm tasks for all users.

---

## [HIGH] Bot Token Leaked in URLs
**File:** `apps/core/src/routes/telegram.ts:59,97,104`

Bot token appears in Telegram API URLs that may be logged or shared.

---

## [HIGH] sshpass + openssh-client in Production Image
**File:** `apps/core/Dockerfile:40-41`

Installs `sshpass` from unstable `edge/community` repo. Combined with `execute_bash` tool, enables lateral movement.

**Fix:** Remove from production image. Move SSH capabilities to a dedicated sandbox container.

---

## [HIGH] Terminal WebSocket Leaks All Environment Variables
**File:** `apps/core/src/routes/terminal.ts:67-76`

```typescript
env: { ...process.env }  // includes JWT_SECRET, POSTGRES_PASSWORD, LLM_API_KEY
```

**Fix:** Whitelist safe env vars only (PATH, HOME, TERM, LANG).

---

## [HIGH] Git Route — No Input Validation + cwd Injection
**File:** `apps/core/src/routes/git.ts:12`

```typescript
const input = req.body as GitPushInput;  // no Zod validation
const workspaceRoot = input.cwd === '/' ? getWorkspaceRoot(userId) : input.cwd;
```

Custom `cwd` allows git operations in any directory.

---

## [MEDIUM] HS256 Instead of Asymmetric Algorithm for JWT
**File:** `packages/auth/src/jwt.ts:34`

Same key for signing and verification. RS256/ES256 recommended.

---

## [MEDIUM] Sandbox Fallback to Host Execution
**File:** `packages/tools/src/tools/bash.ts:47-49`

When Docker is unavailable, commands execute directly on host, bypassing all sandbox protection.

---

## [MEDIUM] databaseQuery Blocklist Bypassable
**File:** `packages/tools/src/tools/databaseQuery.ts:6-7`

Keyword blocklist can be bypassed via CTEs, comments, or custom functions.

---

## [MEDIUM] No Rate Limiting on Several Endpoints
Files: `files.ts`, `terminal.ts`, `git.ts`, `agents.ts` streaming endpoint.

---

## [MEDIUM] Permissions Always Empty for JWT Auth
**File:** `packages/auth/src/service.ts:180`

`permissions: []` returned for all JWT-authenticated requests.

---

## [LOW] localStorage Token Storage (XSS Risk)
**File:** `apps/dashboard/src/hooks/useAuth.ts:13-14`

httpOnly cookies would be safer.

---

## [GOOD] Security Practices Found
- Timing-safe comparison for API keys (`packages/auth/src/crypto.ts:36`)
- Refresh token reuse detection (`packages/auth/src/service.ts:116`)
- User enumeration protection at login (`packages/auth/src/service.ts:75`)
- Excellent WebSocket security (auth, rate limiting, backpressure, origin check)
- Excellent sandbox container config (CapDrop ALL, ReadonlyRootfs, PidsLimit)
- PostgreSQL pg_hba.conf uses scram-sha-256 with strict reject rules
- All SQL queries use parameterized queries — no SQL injection found

---

# PART 2 — ARCHITECTURE REVIEW

## [CRITICAL] Path Traversal in chat.ts (Duplicate of Security Finding)
Already covered above.

## [CRITICAL] execute_bash + write_file Without Permission Boundaries
**File:** `apps/core/src/queue-bootstrap.ts:24-38`

Tools registered globally, available to any agent via LLM. No allowlist for paths or commands. Sandbox exists but not enabled by default.

## [CRITICAL] Duplicate Schema Definitions with Conflicting Values
**Files:** `packages/shared/src/schemas.ts:66-117` vs `packages/tools/src/schemas.ts:1-78`

- shared: `command: z.string().min(1).max(10000)` with `createBackup`
- tools: `command: z.string().min(1).max(4000)` without `createBackup`

Queue validation accepts different data than tools validation — potential bypass.

## [CRITICAL] Inconsistent Internal Dependency Versioning
Some packages use `"*"`, others use `"0.1.0"`. Should standardize on `"workspace:*"`.

## [IMPORTANT] AgentRunner Creation Duplicated in 3-4 Places
**Files:** `routes/chat.ts`, `routes/agents.ts`, `routes/telegram.ts`, `queue-bootstrap.ts`

Same pattern: create provider, define executeTool, persistRun, onStep. ~500+ duplicated lines.

**Fix:** Extract `createConfiguredAgentRunner(deps)` factory function.

## [IMPORTANT] Duplicate Tool Registry Systems
- `packages/tools/src/registry.ts` — static Map
- `packages/agent-engine/src/tool-registry.ts` — dynamic class with caching

**Fix:** Unify into one.

## [IMPORTANT] Routes Registered Without Prefix Grouping
**File:** `apps/core/src/server.ts:194-211`

No route grouping means no shared middleware for `/api/v1/*`, no versioning strategy.

## [IMPORTANT] LLM Provider Created Per Request
**Files:** `routes/agents.ts:177`, `routes/chat.ts:123`, `queue-bootstrap.ts:917`

`createProviderFromEnv()` called on every request. Should be a singleton.

## [IMPORTANT] Sequential Build Without Monorepo Tool
**File:** `package.json:27`

14-step sequential build chain. No parallel builds, no automatic dependency detection.

**Fix:** Adopt turborepo or nx.

## [IMPORTANT] Anthropic Provider Missing Retry Logic
**File:** `packages/agent-engine/src/providers/anthropic.ts`

OpenAI provider has exponential backoff retry; Anthropic throws on first failure.

## [IMPORTANT] Root package.json Contains Mixed Dependencies
**File:** `package.json:65-73`

Frontend deps (`@monaco-editor/react`, `xterm`) mixed with backend deps (`fastify`, `ws`, `dockerode`). Each should be in its own package.

## [IMPORTANT] observability Package Missing Declared Dependencies
**File:** `packages/observability/package.json`

Imports `@titan/logging` but doesn't declare it. Works by npm hoisting accident.

## [SUGGESTION] Manual Migration System Without Rollback
**File:** `packages/database/src/migrate.ts`

Forward-only migrations. No `down()` or rollback capability.

## [SUGGESTION] SwarmOrchestrator Stores Dependencies as JSON in parentId
**File:** `packages/agent-engine/src/swarm/orchestrator.ts:68`

Anti-pattern. Should add `dependsOn: number[]` field instead.

## [SUGGESTION] Memory Package Has No Real Provider Implementation
**File:** `packages/memory/src/index.ts`

Interfaces defined but no actual provider (pgvector, chromadb, etc.).

## [SUGGESTION] Dashboard Doesn't Depend on @titan/shared
No shared types between frontend and backend.

## [SUGGESTION] Custom Prometheus Metrics Instead of prom-client
**File:** `packages/observability/src/metrics.ts`

Missing default metrics (CPU, memory, GC), incomplete histogram support.

## [SUGGESTION] Very Limited Test Coverage
Most packages have `"test": "echo 'no tests yet'"`. Only ~10.5% of source files have tests.

---

# PART 3 — CODE QUALITY

## [HIGH IMPACT] XOR Encryption + Hardcoded Default Key
Already covered in Security section. `apps/core/src/routes/user-keys.ts:25-43`.

## [HIGH IMPACT] Command Injection via execSync
Already covered. `apps/core/src/routes/files.ts:170-178`.

## [HIGH IMPACT] Missing Zod Validation in Critical Routes
| Route | Line | Issue |
|-------|------|-------|
| `routes/agents.ts` | 135 | `req.body as { prompt: string; ... }` |
| `routes/files.ts` | 79 | `req.body as { path: string }` |
| `routes/git.ts` | 11 | `req.body as GitPushInput` |
| `routes/user-keys.ts` | 71 | `req.body as { name; provider; value }` |

**Fix:** Add Zod schemas like `chat.ts` and `swarm.ts` already do.

## [HIGH IMPACT] SandboxPool Created Per Job
**File:** `apps/core/src/queue-bootstrap.ts:1035-1055`

Each job creates a new SandboxPool (Docker containers), then destroys it. Expensive and may leak resources.

## [HIGH IMPACT] getWorkspaceRoot Duplicated 3 Times
**Files:** `routes/files.ts:10`, `routes/terminal.ts:18`, `routes/git.ts:29`

Identical function. `terminal.ts` and `git.ts` also use `require()` in ESM modules.

## [HIGH IMPACT] queue-bootstrap.ts — 1235 Lines with 51 Unsafe Casts
**File:** `apps/core/src/queue-bootstrap.ts`

51 `params as { ... }` casts without validation. Line 897 uses explicit `any`.

## [MEDIUM IMPACT] `any` Types in server.ts Error Handlers
**File:** `apps/core/src/server.ts:128-172`

5 functions use `reply: any` instead of `FastifyReply`.

## [MEDIUM IMPACT] ~10.5% Test Coverage
17 test files for ~161 source files. No tests for: auth, queue, websocket, database client, config, logging, main routes.

## [MEDIUM IMPACT] Telegram Fire-and-Forget Without Error Tracking
**File:** `apps/core/src/routes/telegram.ts:325-342`

Agent runs in background after `reply.code(200)`. If the catch handler itself fails, unhandled rejection occurs.

## [MEDIUM IMPACT] WebSocket Terminal Creates New WSS Per Connection
**File:** `apps/core/src/routes/terminal.ts:47-53`

Each connection creates a new `WebSocketServer` that is never closed. Memory leak.

## [MEDIUM IMPACT] Terminal Sessions Map Never Cleaned on Network Failure
**File:** `apps/core/src/routes/terminal.ts:17`

If WebSocket dies without close event, sessions and child processes remain forever.

## [MEDIUM IMPACT] Single Import Line with 42 Functions
**File:** `apps/core/src/queue-bootstrap.ts:13`

Should use namespaced imports or split the file.

## [LOW IMPACT] require() in ESM Modules
**Files:** `routes/terminal.ts:19`, `routes/git.ts:30`

## [LOW IMPACT] Dead Code in health.ts
**File:** `apps/core/src/routes/health.ts:106-107`

```typescript
void verifyTlsOnStartup;
void verifyAuthOnStartup;
```

## [LOW IMPACT] ESLint Doesn't Cover .tsx Files
**File:** `eslint.config.js` — only covers `*.ts`, not `*.tsx`.

## [LOW IMPACT] SandboxPool.docker Typed as `unknown`
**File:** `packages/sandbox/src/pool.ts:12`

Causes unsafe casts everywhere it's used.

## [LOW IMPACT] Missing tsconfig Paths
`@titan/observability`, `@titan/memory`, `@titan/tools` missing from `tsconfig.json` paths.

## [LOW IMPACT] Inconsistent File Naming
Mix of camelCase (`readFile.ts`) and kebab-case (`queue-bootstrap.ts`).

---

# PART 4 — DEVOPS REVIEW

## [CRITICAL] sshpass in Production Image
Already covered. `apps/core/Dockerfile:40-41`.

## [CRITICAL] No Resource Limits in Docker Compose
**File:** `docker-compose.yml`

No `deploy.resources.limits` for any service. One container can consume all memory and crash the system.

**Fix:**
```yaml
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '1.0'
```

## [CRITICAL] No Logging Driver with Size Limits
**File:** `docker-compose.yml`

Without `max-size` and `max-file`, log files grow unbounded and fill the disk.

**Fix:**
```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"
```

## [CRITICAL] Hardcoded Password in init.sql (Tracked in Git)
**File:** `docker/postgres/init.sql:19,21`

```sql
-- titan_dev_password_change_in_production
```

## [CRITICAL] Redis bind 127.0.0.1 Blocks Docker Network Connections
**File:** `docker/redis/redis.conf:10`

Redis bound to localhost only. Other containers connect via Docker network (not localhost), so **Redis may reject connections from core/worker**.

**Fix:** Change to `bind 0.0.0.0` (protected by Docker network + password).

## [CRITICAL] CI Secret Check is Broken
**File:** `.github/workflows/ci.yml:35-38`

`git log --all --full-history -- .env` always returns exit code 0. The check always triggers false positive.

## [CRITICAL] CI Pattern Check Disabled
**File:** `.github/workflows/ci.yml:40`

`grep -riE 'password|secret|token' ... || true` always succeeds due to `|| true`.

**Fix:** Use `truffleHog` or `gitleaks`.

## [CRITICAL] Hardcoded Absolute Path in spawn.cjs
**File:** `apps/core/spawn.cjs:5`

```javascript
const cwd = 'D:\\ai\\Titan';
```

**Fix:** Use `path.resolve(__dirname, '../..')`.

## [CRITICAL] spawn.cjs Runs server.js Instead of index.js
**File:** `apps/core/spawn.cjs:9`

Dockerfile and package.json use `index.js`. spawn.cjs uses `server.js`, bypassing migrations and graceful shutdown setup.

## [IMPROVEMENT] Redis rename-command SHUTDOWN Prevents Clean Stop
**File:** `docker/redis/redis.conf:55`

## [IMPROVEMENT] Worker Without Proper Healthcheck
**File:** `docker-compose.yml:166-189`

`pgrep -x node` only checks process existence, not actual health.

## [IMPROVEMENT] .env.example Has CORS_ORIGIN=*
**File:** `.env.example:77`

Dangerous default if copied to production.

## [IMPROVEMENT] .env.example Missing Variables Present in .env
`HTTP_TRUST_PROXY`, `HTTP_CSP_ENABLED`, `WS_ALLOWED_ORIGINS` not in example.

## [IMPROVEMENT] .gitignore Doesn't Cover .env.staging / .env.test

## [IMPROVEMENT] No CI Step for Docker Image Build

## [IMPROVEMENT] No docker-compose.prod.yml

## [IMPROVEMENT] spawn.cjs — No Process Monitoring or Auto-Restart
**Fix:** Use PM2 or systemd.

## [IMPROVEMENT] Log Files Overwritten on Restart (flag 'w' not 'a')
**File:** `apps/core/spawn.cjs:6-7`

## [IMPROVEMENT] No Log Rotation at Any Level

## [IMPROVEMENT] PostgreSQL shared_preload_libraries Empty
Should add `pg_stat_statements`.

## [IMPROVEMENT] No Monitoring Stack in Docker Compose
OTEL_ENABLED=false. No Prometheus/Grafana/Jaeger containers.

## [GOOD] Excellent Graceful Shutdown
**File:** `apps/core/src/index.ts:76-106` — ordered shutdown of WS, HTTP, Queues, Redis, PG, Logger.

## [GOOD] Comprehensive Health Checks
**File:** `apps/core/src/routes/health.ts` — `/health/live`, `/health/ready`, `/health/startup`.

## [GOOD] Multi-Stage Docker Builds with Non-Root User

---

# PART 5 — FRONTEND REVIEW (Dashboard)

## [CRITICAL] No Code Splitting / Lazy Loading
**File:** `apps/dashboard/src/App.tsx:1-28`

All 27 pages imported eagerly. Monaco Editor (~3MB) and xterm.js (~500KB) loaded upfront even if user never visits Editor/Terminal.

**Fix:** Use `React.lazy()` + `<Suspense>` for heavy pages.

## [CRITICAL] useAuth is Not a Context — Desynchronized State
**File:** `apps/dashboard/src/hooks/useAuth.ts`

Each component calling `useAuth()` gets an independent state copy. Login works only because `window.location.href = '/'` reloads the page.

**Fix:** Convert to `AuthContext` + `AuthProvider` wrapping the app.

## [CRITICAL] Zero ARIA Attributes — No Accessibility
0 uses of `aria-*` or `role=` in the entire app. Screen readers cannot interact with it.

## [CRITICAL] API_BASE/getToken Duplicated in 18+ Files
Each page re-implements `API_BASE` and `getToken` instead of importing from `api/client.ts`. Most pages miss token refresh and 401 handling.

## [HIGH] Token Passed in WebSocket URL Query Parameter
**Files:** `NotificationContext.tsx:82`, `Terminal.tsx:97`, `Logs.tsx:47`

```typescript
const ws = new WebSocket(`${WS_BASE}?token=${encodeURIComponent(token)}`);
```

Token visible in server logs, browser history, and network tools.

**Fix:** Send token as first message after connection.

## [HIGH] No 404 Page
**File:** `apps/dashboard/src/App.tsx`

Visiting `/xyz` shows empty Layout with no error message.

## [HIGH] Queue Stats Fetched Sequentially (9 Requests)
**File:** `apps/dashboard/src/pages/Queue.tsx:25-39`

9 API calls in a `for` loop. Should use `Promise.allSettled()`.

## [HIGH] fetchRuns Called on Every WebSocket Step Message
**File:** `apps/dashboard/src/pages/Runs.tsx:76`

Each `agent.step` WebSocket message triggers a full API call. 10 steps = 10 extra HTTP requests.

**Fix:** Debounce or update local state directly.

## [MEDIUM] SidebarContent Re-created Every Render
**File:** `apps/dashboard/src/components/Layout.tsx:316`

Defined as inner component — causes full unmount/remount on parent re-render.

## [MEDIUM] `<a href>` Used Instead of `<Link>`
**Files:** `Dashboard.tsx:323`, `Layout.tsx:280`

Causes full page reload instead of client-side navigation.

## [MEDIUM] Errors Silently Swallowed in Multiple Components
**Files:** `Agents.tsx:24,38`, `Editor.tsx:54`, `Dashboard.tsx:82`, `Settings.tsx:81,93`, `Runs.tsx:85`

```typescript
} catch { /* silent */ }
```

## [MEDIUM] Duplicate formatBytes and getFileIcon Functions
**Files:** `Dashboard.tsx:356` + `Files.tsx:28`, and `Files.tsx:36` + `Editor.tsx:25`.

## [MEDIUM] Settings Preferences Not Wired to State
**File:** `apps/dashboard/src/pages/Settings.tsx:412-435`

Uses `defaultValue` (uncontrolled). "Save Preferences" button has no handler. Values never actually save.

## [LOW] No Error Boundary
Any JS error crashes the entire app with no user-friendly message.

## [LOW] No AbortController for Fetch Requests
Navigating away doesn't cancel pending requests.

## [LOW] Notification Link Opens Without Validation
**File:** `apps/dashboard/src/components/Layout.tsx:145`

```typescript
if (n.link) window.location.href = n.link;
```

If a WebSocket notification contains `javascript:` in `link`, it executes.

---

# TOP 20 PRIORITY FIXES

## Immediate (Security — Do Now)

| # | Issue | File | Severity |
|---|-------|------|----------|
| 1 | Replace XOR with AES-256-GCM for user keys | `routes/user-keys.ts` | CRITICAL |
| 2 | Add secret_token to Telegram webhook | `routes/telegram.ts` | CRITICAL |
| 3 | Remove FORCED ACTION SSH prompt | `routes/telegram.ts:213` | CRITICAL |
| 4 | Replace execSync with safe zip library | `routes/files.ts:170` | CRITICAL |
| 5 | Validate file paths in chat endpoint | `routes/chat.ts:39` | HIGH |
| 6 | Sanitize uploaded filenames | `routes/files.ts:103` | HIGH |
| 7 | Add auth to /metrics endpoint | `routes/metrics.ts` | HIGH |
| 8 | Whitelist terminal env vars | `routes/terminal.ts:67` | HIGH |
| 9 | Remove sshpass from Dockerfile | `Dockerfile:40-41` | HIGH |
| 10 | Fix session ownership check (includes→exact) | `routes/chat.ts:269` | HIGH |

## Short Term (Architecture + Quality — This Sprint)

| # | Issue | File | Impact |
|---|-------|------|--------|
| 11 | Add Zod validation to all routes | `agents.ts, files.ts, git.ts, user-keys.ts` | HIGH |
| 12 | Extract AgentRunner factory function | 4 files | HIGH |
| 13 | Fix Redis bind for Docker networking | `docker/redis/redis.conf` | CRITICAL |
| 14 | Add resource limits to docker-compose | `docker-compose.yml` | CRITICAL |
| 15 | Fix spawn.cjs hardcoded path + entry point | `apps/core/spawn.cjs` | CRITICAL |

## Medium Term (Quality + Frontend — Next Sprint)

| # | Issue | File | Impact |
|---|-------|------|--------|
| 16 | Add React.lazy() code splitting | `apps/dashboard/src/App.tsx` | HIGH |
| 17 | Convert useAuth to AuthContext | `hooks/useAuth.ts` | HIGH |
| 18 | Centralize API_BASE/getToken (use client.ts) | 18+ dashboard files | HIGH |
| 19 | Add ARIA attributes for accessibility | All dashboard components | HIGH |
| 20 | Split queue-bootstrap.ts (1235 lines) | `queue-bootstrap.ts` | MEDIUM |

---

# SUGGESTIONS FOR IMPROVEMENT

1. **Adopt turborepo/nx** for parallel builds and dependency graph management
2. **Add Error Boundaries** to the React dashboard
3. **Implement token-in-first-message** pattern for WebSocket instead of URL query param
4. **Add `prom-client`** instead of custom Prometheus metrics
5. **Create `docker-compose.prod.yml`** with proper resource limits and logging
6. **Unify tool registries** (packages/tools vs packages/agent-engine)
7. **Share types** between dashboard and backend via `@titan/shared`
8. **Add retry logic** to Anthropic provider (matching OpenAI provider)
9. **Implement rollback migrations** before production
10. **Target 60%+ test coverage** for critical packages (auth, database, queue, websocket)

---

*Generated by 5 specialized AI agents — Security, Architecture, Code Quality, DevOps, Frontend*
