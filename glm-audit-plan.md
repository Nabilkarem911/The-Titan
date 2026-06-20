# Titan Audit — Fix Plan

## Principles
- No breaking changes to existing functionality
- Minimal, focused edits
- Backward-compatible where possible
- Test after each fix

---

## Phase 1 — Critical Fixes

### 1.1 SQL Injection in GDPR helpers ✅ DONE
- **File**: `packages/database/src/gdpr.ts`
- **Issue**: Table/column names interpolated directly into SQL
- **Fix**: Use a static whitelist map with TypeScript literal types; reject any input not in the map
- **Risk**: None — current callers use hardcoded arrays only

### 1.2 Sandbox fallback to host execution ✅ DONE
- **File**: `packages/tools/src/tools/bash.ts`
- **Issue**: Falls back to host execution silently when Docker unavailable
- **Fix**: Add `SANDBOX_STRICT_MODE` config flag; when true, throw instead of falling back. Default false for backward compat
- **Files to touch**: `packages/config/src/index.ts` (add flag), `packages/tools/src/tools/bash.ts`

### 1.3 CI/CD Pipeline ✅ ALREADY EXISTS
- **File**: `.github/workflows/ci.yml`
- **Status**: Already present with lint, typecheck, test, build, security audit, and Docker build verification

---

## Phase 2 — High Priority

### 2.1 Migrate embeddings to native vector type ✅ DONE
- **File**: `packages/database/migrations/0026_pgvector_embeddings.sql`
- **Issue**: Embeddings stored as JSONB, not scalable for similarity search
- **Fix**: Add migration to create `vector` column, backfill from JSONB, add ivfflat index
- **Files to touch**: New migration, `packages/memory/src/pgvectorProvider.ts`

### 2.2 LLM retry logic ✅ ALREADY EXISTS
- **Status**: Both OpenAI and Anthropic providers already have retry with exponential backoff (500ms/1s/2s, up to 2 retries)
- **File**: `packages/agent-engine/src/runner.ts` (or provider wrapper)
- **Issue**: Transient LLM API failures kill agent runs
- **Fix**: Add retry with exponential backoff (3 attempts, 1s/2s/4s) around `llm.complete()`
- **Files to touch**: `packages/agent-engine/src/providers/factory.ts` or new wrapper

### 2.3 Remove SSH client from production Docker image ✅ DONE
- **File**: `apps/core/Dockerfile`
- **Issue**: `openssh-client` and `sshpass` expand attack surface
- **Fix**: Move SSH tools to a separate stage or make them opt-in via build arg
- **Risk**: Tools using SSH would need the build arg — backward compat maintained with default true

### 2.4 Workspace-scoped WebSocket broadcast ✅ DONE
- **File**: `packages/websocket/src/server.ts`
- **Issue**: `broadcast()` sends to all authenticated clients regardless of workspace
- **Fix**: Add `broadcastToWorkspace(workspaceId, event, data)` method; keep `broadcast()` for global events
- **Risk**: None — additive change

### 2.5 Fail fast on no TLS in production ✅ DONE
- **File**: `packages/database/src/client.ts`
- **Issue**: Only logs warning when TLS disabled in production
- **Fix**: Add `POSTGRES_ALLOW_NO_TLS` env var; throw if TLS disabled in production unless explicitly allowed
- **Files to touch**: `packages/config/src/index.ts`, `packages/database/src/client.ts`

---

## Phase 3 — Medium Priority

### 3.1 Replace `any` types in error handlers ✅ DONE
- **File**: `apps/core/src/server.ts`
- **Issue**: `reply: any` in error handler functions
- **Fix**: Use `FastifyReply` type

### 3.2 Execute all LLM tool calls per step ✅ DONE
- **File**: `packages/agent-engine/src/strategies/chain-of-thought.ts`
- **Issue**: Only first tool call executed
- **Fix**: Loop through all `completion.toolCalls` and execute in sequence

### 3.3 Resolve `--legacy-peer-deps` ✅ DONE
- **File**: `apps/core/Dockerfile`, `package.json`
- **Issue**: Peer dependency conflicts
- **Fix**: Audit dependencies and resolve conflicts properly

### 3.4 Locale-aware fallback messages ✅ DONE
- **File**: `packages/agent-engine/src/runner.ts`
- **Issue**: Arabic fallback messages hardcoded
- **Fix**: Use locale from agent context; default to English

### 3.5 Document missing migration 0014 ✅ DONE
- **File**: `packages/database/migrations/`
- **Issue**: Gap in migration numbering
- **Fix**: Add `0014_placeholder.sql` with comment explaining the gap

---

## Phase 4 — Nice to Have

### 4.1 Add OpenTelemetry tracing
### 4.2 Container image vulnerability scanning
### 4.3 Add `updated_at` trigger on `agent_runs`
### 4.4 Split large seed migration 0012
### 4.5 Add per-method WebSocket message size limits

---

## Execution Order

1. Phase 1 (Critical) → 2. Phase 2 (High) → 3. Phase 3 (Medium) → 4. Phase 4 (Nice to have)

Each fix will be:
- Implemented with minimal edits
- Verified for backward compatibility
- Committed and pushed after completion
