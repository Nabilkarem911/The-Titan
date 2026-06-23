# Titan Fix Plan — Strict Rules

## Rules (NO EXCEPTIONS)
1. **No breaking changes** — every existing API route, tool name, and dashboard page must keep working
2. **Build must pass** — `npm run build:core` and `npm run build:dashboard` must succeed after each step
3. **No new dependencies** — use existing packages only
4. **Minimal edits** — change only what's needed, don't refactor surrounding code
5. **Verify after each step** — build before moving to next step
6. **Commit after all steps** — single commit with all fixes

## Steps

### Step 1: Fix 6 stub tools in capability-wiring.ts
Connect handlers to real code that already exists:

| Tool | Current (stub) | Fix (real call) |
|------|---------------|-----------------|
| `meta_monitor_stats` | Returns `{ status: 'active' }` | Return `wiring.metaMonitor.assessStep` stats or a summary |
| `self_improve` | Returns `{ status: 'active' }` | Call `wiring.selfImprover.getArchive()` to show real proposals |
| `introspect` | Returns `{ status: 'active' }` | Call `wiring.introspection.stats()` |
| `prompt_optimize` | Returns prompt unchanged | Call `wiring.promptOptimizer.getStats()` |
| `strategy_tune` | Returns `{ status: 'complete' }` | Call `wiring.strategyTuner.getPerformance()` |
| `extract_heuristics` | Returns `{ heuristics: [] }` | Call `wiring.heuristicExtractor.getAllHeuristics()` |

**Risk:** Low — just changing return values in handlers. No signature changes.

### Step 2: Fix WebIntelligence to use Brave Search API format
- `executeApiSearch` currently uses `Authorization: Bearer` + POST to `/search`
- Brave API uses `X-Subscription-Token` header + GET to `https://api.search.brave.com/res/v1/web/search`
- Fix: Change `executeApiSearch` to use Brave's actual API format
- The `config.baseUrl` should default to `https://api.search.brave.com/res/v1/web/search`
- The `config.apiKey` is the Brave subscription token

**Risk:** Low — only changes internal method. Public `search()` signature unchanged.

### Step 3: Build and verify
- `npm run build:core`
- `npm run build:dashboard` (if needed)
- Commit and push

## What is NOT being fixed in this round
- Browser Agent (needs Playwright — separate task)
- Self-Healing Debugger (needs file write access — separate task)
- Self-Rewriter (needs file write access — separate task)
- Database persistence for in-memory features (separate task)
- Brave Search API key (user will add later)

## Verification checklist
- [ ] All 6 stub tools now return real data
- [ ] WebIntelligence.executeApiSearch uses Brave API format
- [ ] `npm run build:core` passes
- [ ] No existing tool names changed
- [ ] No existing API routes changed
- [ ] Committed and pushed
