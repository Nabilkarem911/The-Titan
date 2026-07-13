# Titan Remediation Plan

> **Created**: 2026-07-12  
> **Last Updated**: 2026-07-12  
> **Status**: Active — Implementation Phase  
> **Based on**: AUDIT_REPORT.md + live code review

---

## Status Legend

- [ ] Not started
- [x] Fixed (verified in code)
- [~] Partially fixed / needs verification
- [!] New issue discovered during review
- [✅] Fixed in this remediation session

---

## Phase 1: Security (Critical)

### 1.1 Command injection in verify-runner.ts
- **Status**: [x] FIXED + [✅] Regression tests added
- **Details**: `verify-runner.ts` now uses `execFileAsync` (promisified `execFile`) with args array — no string concatenation. `tsconfigPath` is passed as a separate arg, not interpolated.
- **File**: `packages/agent-engine/src/autonomous/verification/verify-runner.ts:16-24`
- **Tests**: `packages/agent-engine/src/autonomous/verification/verify-runner.test.ts` — command injection, null bytes, shell metacharacters

### 1.2 Missing validateCwd in autonomous routes
- **Status**: [x] FIXED + [✅] Path traversal tests added
- **Details**: `autonomous.ts` now calls `validateCwd(cwd)` for both `/verify` and `/task` endpoints, returning 400 if outside allowed prefixes.
- **File**: `apps/core/src/routes/autonomous.ts:27-32, 73-78`
- **Tests**: `packages/tools/src/sandbox.test.ts` — Path Traversal section

### 1.3 Race condition in globalThis.__currentUserId
- **Status**: [x] FIXED
- **Details**: `request-context.ts` now uses `AsyncLocalStorage` via `runWithLogContext`. No `globalThis.__currentUserId` found in current code.
- **File**: `apps/core/src/plugins/request-context.ts:44-64`

### 1.4 Sandbox blocklist bypass (validateCommand)
- **Status**: [ ] OPEN — Medium priority
- **Details**: `sandbox.ts` still uses string-inclusion blocklist (`FORBIDDEN_PATTERNS`). Bypassable via whitespace, unicode, or reformatting. Added `rm -r -f /` variant to catch flag reordering.
- **File**: `packages/tools/src/sandbox.ts:13-57`
- **Action**: 
  - Option A: Switch to allowlist mode (only permit specific commands)
  - Option B: Run commands inside Docker container with seccomp profile
  - Option C: Add shell metacharacter validation + command parsing before blocklist check
- **Priority**: Medium (blocklist is defense-in-depth, not primary barrier)

### 1.5 SSH command validation bypass
- **Status**: [✅] FIXED
- **Details**: `validateCommand` no longer skips content after quotes in SSH commands. The full command string is now validated against the blocklist.
- **File**: `packages/tools/src/sandbox.ts:79-108`
- **Tests**: `packages/tools/src/sandbox.test.ts` — SSH Command Bypass section (4 tests)

### 1.6 Error detail leakage in command route
- **Status**: [✅] FIXED
- **Details**: `command.ts` now logs errors internally via `log.error()` and returns generic `'Tool execution failed'` message to user. No `String(err)` in response.
- **File**: `apps/core/src/routes/command.ts:31-32, 52-53`

### 1.7 /api/v1/command allows any registered tool
- **Status**: [✅] FIXED
- **Details**: Added `riskLevel` field to `ToolDefinition` (`safe` / `elevated` / `dangerous`). Command route checks `TOOL_EXECUTE_ELEVATED` permission for elevated/dangerous tools. `execute_bash` marked as `dangerous`, `patch_file` marked as `elevated`. New `TOOL_EXECUTE_ELEVATED` permission added to `PERMISSIONS` and assigned to `admin` and `owner` roles.
- **Files**: 
  - `packages/shared/src/constants.ts:56-74` — new permission
  - `packages/agent-engine/src/tool-registry.ts:12-22` — riskLevel field
  - `apps/core/src/routes/command.ts:22-25` — permission check
  - `apps/core/src/queue-bootstrap.ts:40, 56` — riskLevel on tools

---

## Phase 2: Fake / Stub Tools

### 2.1 Already fixed tools (verified working)
- **Status**: [x] FIXED
- **Tools now properly implemented**:
  - `digital_twin_simulate` → calls `wiring.whatIfEngine.simulate()`
  - `normative_check` → calls `wiring.normativeAgency.evaluateAction()`
  - `theory_of_mind` → calls `wiring.theoryOfMind.analyze()`
  - `prompt_optimize` → uses LLM to optimize prompt
  - `dream_world_explore` → calls `wiring.dreamWorld.dream()`
  - `visual_workflow_build` → calls `wiring.visualWorkflowBuilder` methods
  - `trt_solve` → creates `TestTimeRecursiveThinking` and calls `solve()`
  - `router_route` → creates `SmartModelRouter` and calls `route()`
- **File**: `packages/agent-engine/src/capability-wiring.ts`

### 2.2 rl_train — improved
- **Status**: [✅] FIXED
- **Details**: Tool description updated to be accurate. Handler now returns useful environment stats from `wiring.autonomousTrading.getStats()` instead of a dead-end message.
- **File**: `packages/agent-engine/src/capability-wiring.ts:1055-1072`

### 2.3 autonomous_loop_status — improved
- **Status**: [✅] FIXED
- **Details**: Handler now returns available endpoints alongside status message for better UX.
- **File**: `packages/agent-engine/src/capability-wiring.ts:1367-1378`

### 2.4 Hardcoded tool count
- **Status**: [✅] FIXED
- **Details**: Replaced `15 + 53 + 12` with `registry.size()` for dynamic count.
- **File**: `packages/agent-engine/src/capability-wiring.ts:1443`

### 2.5 WebIntelligence with empty API key
- **Status**: [~] Documented
- **Details**: Added TODO comment documenting the issue. WebIntelligence still created with empty apiKey when env var is missing.
- **File**: `packages/agent-engine/src/capability-wiring.ts:295-304`
- **Action**: Future improvement — set to `null` when no API key, return clear error when tool invoked.

---

## Phase 3: Performance

### 3.1 execSync blocking event loop
- **Status**: [x] FIXED
- **Details**: `verify-runner.ts` now uses `execFileAsync` (async). No `execSync` found.
- **File**: `packages/agent-engine/src/autonomous/verification/verify-runner.ts`

### 3.2 Tool cache memory leak
- **Status**: [x] FIXED
- **Details**: `ToolRegistry` now has:
  - LRU eviction (`evictIfNeeded` with `MAX_CACHE_SIZE = 500`)
  - Periodic cleanup (`cleanupExpired` via `setInterval` every 5 min)
  - `unref()` on timer to not block process exit
- **File**: `packages/agent-engine/src/tool-registry.ts:34-160`

### 3.3 Eager initialization of 60+ modules
- **Status**: [ ] DEFERRED — Medium priority
- **Details**: `wireCapabilities` creates all 60+ module instances immediately. Memory wasted on unused modules.
- **File**: `packages/agent-engine/src/capability-wiring.ts:218-321`
- **Action**: Deferred — requires careful refactor of `WiredCapabilities` interface and all consumers. Low risk vs reward ratio at current scale.

### 3.4 Slow SQL query for chat sessions
- **Status**: [x] FIXED (index added in migration 0033)
- **Details**: Migration `0033_chat_session_index.sql` adds `idx_memory_messages_session_created_at` on `(session_id, created_at DESC)`.
- **File**: `packages/database/migrations/0033_chat_session_index.sql`

---

## Phase 4: Architecture / Code Quality

### 4.1 wireCapabilities singleton ignores different LLM
- **Status**: [✅] FIXED
- **Details**: `wireCapabilities` now caches by LLM identity (`globalWiringLlm === llm`). If a different LLM is passed, it re-wires with the new instance. `resetGlobalWiring` also clears `globalWiringLlm`.
- **File**: `packages/agent-engine/src/capability-wiring.ts:196-197, 200, 327-328, 1450-1453`

### 4.2 Test quality — lenient assertions
- **Status**: [✅] FIXED
- **Details**: All lenient `expect([401, 500, 200]).toContain(res.statusCode)` assertions replaced with strict `expect(res.statusCode).toBe(401)` in:
  - `comprehensive-audit.test.ts` — 6 assertions fixed (plugins, autonomous, spawner, v5, protected routes loop)
  - `external-services.test.ts` — 1 assertion fixed (bots/channels)
- **Files**: `apps/core/src/routes/__tests__/comprehensive-audit.test.ts`, `apps/core/src/routes/__tests__/external-services.test.ts`

### 4.3 Missing tests for security edge cases
- **Status**: [✅] FIXED
- **Details**: Added comprehensive security regression tests:
  - `verify-runner.test.ts` — command injection via tsconfigPath, null bytes, shell metacharacters (5 tests)
  - `sandbox.test.ts` — path traversal (5 tests), blocklist bypass attempts (10 tests), SSH command bypass (4 tests)
- **Files**: 
  - `packages/agent-engine/src/autonomous/verification/verify-runner.test.ts` (new file)
  - `packages/tools/src/sandbox.test.ts` (extended)

---

## Phase 5: Database / pgvector Optimization

### 5.1 Enable HNSW index on pgvector
- **Status**: [✅] FIXED
- **Details**: New migration `0034_hnsw_vector_index.sql` drops old IVFFlat index and creates HNSW index with `m=16, ef_construction=64`. Falls back to IVFFlat if HNSW not supported.
- **File**: `packages/database/migrations/0034_hnsw_vector_index.sql`

### 5.2 Add missing indexes for chat sessions
- **Status**: [x] FIXED (already in migration 0033)
- **Details**: `idx_memory_messages_session_created_at` on `(session_id, created_at DESC)` already exists.
- **File**: `packages/database/migrations/0033_chat_session_index.sql`

---

## Execution Priority

| Priority | Task | Effort | Impact | Status |
|----------|------|--------|--------|--------|
| **P0** | 4.3 Add security regression tests | Small | High | ✅ Done |
| **P0** | 5.1 Enable HNSW index | Tiny | High | ✅ Done |
| **P1** | 1.4 Sandbox blocklist → allowlist/container | Medium | High | Open |
| **P1** | 1.5 SSH validation bypass | Small | High | ✅ Done |
| **P1** | 1.7 Tool permission classification | Medium | High | ✅ Done |
| **P1** | 4.1 wireCapabilities singleton fix | Small | Medium | ✅ Done |
| **P2** | 2.2 Fix rl_train stub | Small | Medium | ✅ Done |
| **P2** | 2.3 Fix autonomous_loop_status | Small | Medium | ✅ Done |
| **P2** | 3.3 Lazy initialization of modules | Medium | Medium | Deferred |
| **P2** | 4.2 Fix lenient test assertions | Medium | Medium | ✅ Done |
| **P3** | 1.6 Error detail leakage | Small | Low | ✅ Done |
| **P3** | 2.4 Fix hardcoded tool count | Tiny | Low | ✅ Done |
| **P3** | 2.5 WebIntelligence empty API key | Small | Low | Documented |
| **P3** | 3.4 Optimize chat session SQL | Small | Low | Already fixed |
| **P3** | 5.2 Add session index | Tiny | Low | Already fixed |

---

## Progress Tracking

| Phase | Total | Done | Open | Deferred |
|-------|-------|------|------|----------|
| 1. Security | 7 | 6 | 1 | 0 |
| 2. Stub Tools | 5 | 4 | 0 | 1 (documented) |
| 3. Performance | 4 | 3 | 0 | 1 |
| 4. Code Quality | 3 | 3 | 0 | 0 |
| 5. Database | 2 | 2 | 0 | 0 |
| **Total** | **21** | **18** | **1** | **2** |

---

## Files Modified in This Session

| File | Change |
|------|--------|
| `packages/tools/src/sandbox.ts` | Fixed SSH bypass, added `rm -r -f /` to blocklist |
| `packages/tools/src/sandbox.test.ts` | Added 19 security regression tests |
| `packages/agent-engine/src/autonomous/verification/verify-runner.test.ts` | New file — 5 command injection regression tests |
| `packages/database/migrations/0034_hnsw_vector_index.sql` | New migration — HNSW index |
| `packages/agent-engine/src/capability-wiring.ts` | Fixed singleton, improved stubs, dynamic tool count |
| `packages/agent-engine/src/tool-registry.ts` | Added `riskLevel` field + `list()` output |
| `packages/shared/src/constants.ts` | Added `TOOL_EXECUTE_ELEVATED` permission |
| `packages/shared/src/constants.test.ts` | Updated permission count 16→17 |
| `apps/core/src/routes/command.ts` | Risk level checks, error leakage fix, logging |
| `apps/core/src/queue-bootstrap.ts` | Marked execute_bash as dangerous, patch_file as elevated |
| `apps/core/src/routes/__tests__/comprehensive-audit.test.ts` | Fixed 6 lenient assertions |
| `apps/core/src/routes/__tests__/external-services.test.ts` | Fixed 1 lenient assertion |

---

## Remaining Items

1. **1.4 Sandbox blocklist → allowlist/container** — Requires architectural decision (allowlist vs Docker vs seccomp). Recommend Docker container isolation as long-term solution.
2. **3.3 Lazy initialization** — Deferred. Requires refactoring `WiredCapabilities` interface and all consumers. Low risk vs reward at current scale.
3. **2.5 WebIntelligence empty API key** — Documented with TODO. Low impact.

---

## Notes

- The AUDIT_REPORT.md (dated 2025-01-15) flagged several issues that have since been fixed. This plan reflects the **current state** of the codebase as of 2026-07-12.
- All lint errors shown in IDE are pre-existing module resolution issues in the monorepo (vitest, node types, @titan/* packages) — not caused by our changes.
- After completing all open items, a re-evaluation will be performed.
