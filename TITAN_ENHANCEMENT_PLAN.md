# Titan Enhancement Plan — Next Phase

> **Goal**: Elevate Titan from functional to professional-grade by enhancing chat experience, agent transparency, and dashboard polish.

---

## Phase 1: Chat Experience (Priority: HIGH)

### 1.1 Load Chat History on Page Open
- **File**: `apps/dashboard/src/pages/Chat.tsx`
- **Backend**: Add `GET /api/v1/chat/history/:sessionId` endpoint
- **What**: When user opens Chat page, fetch last 50 messages from DB and display them
- **Why**: Currently messages disappear on refresh — they're saved in DB but not loaded
- **Status**: [x] Done

### 1.2 Render Agent Steps in Chat
- **File**: `apps/dashboard/src/pages/Chat.tsx`
- **What**: The SSE stream already sends `type: 'step'` events with thought/action/reflection — render them as collapsible cards between user message and final answer
- **UI**: Collapsible "Thinking..." section showing:
  - Step number + status (planning, executing, observing, reflecting)
  - Thought text (italic, muted)
  - Tool name + params (code block)
  - Observation result (collapsible)
  - Reflection (if any)
- **Why**: Makes Titan feel like a real agent, not a black box
- **Status**: [x] Done

### 1.3 Stop/Abort Button
- **File**: `apps/dashboard/src/pages/Chat.tsx`
- **What**: Already has `abortRef` — add a visible Stop button that calls `abortRef.current.abort()`
- **UI**: Replace send button with stop button while streaming
- **Status**: [x] Done

### 1.4 Session Persistence
- **File**: `apps/dashboard/src/pages/Chat.tsx`
- **What**: Save `sessionId` in localStorage, use it when sending messages. Add "New Chat" button to start fresh session.
- **Backend**: Add `GET /api/v1/chat/sessions` to list user's chat sessions
- **Status**: [x] Done

---

## Phase 2: Agent Transparency (Priority: HIGH)

### 2.1 Tool Usage Cards in Chat
- **File**: `apps/dashboard/src/pages/Chat.tsx`
- **What**: When a step has `actionName`, render a tool card inline:
  - Tool name (badge with icon)
  - Parameters (formatted JSON, collapsible)
  - Result (success/error badge + data, collapsible)
  - Latency (ms)
- **Why**: User sees what tools Titan is using in real-time
- **Status**: [x] Done

### 2.2 Streaming Thoughts
- **File**: `apps/dashboard/src/pages/Chat.tsx`
- **What**: Show thought text live as it streams (not just in final step card)
- **UI**: Typing indicator + thought text appearing character by character
- **Status**: [x] Done

### 2.3 Agent Profiles UI
- **File**: New page `apps/dashboard/src/pages/AgentProfiles.tsx`
- **Backend**: Already has `agentProfiles` DB repo + routes
- **What**: CRUD UI for agent profiles — name, slug, system prompt, max steps, forbidden tools
- **Status**: [x] Done

---

## Phase 3: Dashboard Polish (Priority: MEDIUM)

### 3.1 Command Palette (Cmd+K)
- **File**: New component `apps/dashboard/src/components/CommandPalette.tsx`
- **What**: Global search + quick actions overlay triggered by Cmd+K / Ctrl+K
- **Actions**: Navigate to pages, start new chat, install plugin, toggle theme
- **Status**: [x] Done

### 3.2 Activity Feed
- **File**: New component on Dashboard home
- **Backend**: Add `GET /api/v1/activity` endpoint (recent runs, tool executions, plugin installs)
- **What**: Timeline showing last 20 actions across the platform
- **Status**: [x] Done

### 3.3 Token/Cost Tracker
- **File**: `apps/dashboard/src/pages/Runs.tsx` or new widget
- **What**: Show tokens used per run, total tokens today/week/month
- **Backend**: Data already in `agentRuns.tokensUsed`
- **Status**: [x] Done

### 3.4 Model Selector
- **File**: `apps/dashboard/src/pages/Chat.tsx` header
- **What**: Dropdown to select LLM model (GPT-4, Claude, etc.)
- **Backend**: Pass `model` param to runner
- **Status**: [x] Done

---

## Phase 4: Plugin Marketplace Enhancement (Priority: MEDIUM)

### 4.1 Plugin Details Modal
- **File**: `apps/dashboard/src/pages/Plugins.tsx`
- **What**: Click plugin in library → modal with full description, tools list, code preview, example usage
- **Status**: [x] Done

### 4.2 Tool Testing Console
- **File**: New page `apps/dashboard/src/pages/ToolConsole.tsx`
- **What**: Select any registered tool, input params as JSON, execute, see result
- **Backend**: Already has `POST /api/v1/plugins/:id/execute`
- **Status**: [x] Done

### 4.3 Plugin Categories Filter
- **File**: `apps/dashboard/src/pages/Plugins.tsx`
- **What**: Filter buttons for categories in library (Web, Utilities, Security, etc.)
- **Status**: [x] Done

### 4.4 Plugin Ratings
- **File**: `apps/dashboard/src/pages/Plugins.tsx`
- **Backend**: Already has `pluginRatings` DB repo
- **What**: Star rating + review text on installed plugins
- **Status**: [x] Done

---

## Phase 5: Mobile & UX (Priority: LOW)

### 5.1 Responsive Design Audit
- **What**: Test all pages on mobile breakpoints, fix layout issues
- **Focus**: Chat page, Plugins page, Settings page
- **Status**: [ ] Not started

### 5.2 Notifications Center
- **File**: New component in sidebar/header
- **What**: Bell icon with dropdown showing recent notifications (run completed, errors, plugin updates)
- **Status**: [ ] Not started

### 5.3 Onboarding Wizard
- **File**: New component `apps/dashboard/src/components/Onboarding.tsx`
- **What**: 3-step wizard for new users: link Telegram → install plugins → start first chat
- **Status**: [ ] Not started

---

## Phase 6: Pro Features (Priority: LOW)

### 6.1 Audit Log Viewer
- **Backend**: Already has audit logs table
- **What**: Page showing filterable audit trail (user, action, timestamp, details)
- **Status**: [ ] Not started

### 6.2 API Key Management
- **What**: Create/revoke API keys from dashboard
- **Backend**: Already has `apiKeys` DB repo
- **Status**: [ ] Not started

### 6.3 WebSocket Live Updates
- **What**: Runs page updates in real-time without refresh
- **Backend**: Already has WS server broadcasting `agent.run.updated` and `agent.step`
- **Status**: [ ] Not started

### 6.4 Export/Import Memory
- **What**: Download user context as JSON, import from file
- **Status**: [ ] Not started

---

## Execution Order

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | Load chat history on page open | Small | High |
| 2 | Render agent steps in chat | Medium | High |
| 3 | Stop/abort button | Small | Medium |
| 4 | Tool usage cards | Medium | High |
| 5 | Session persistence + New Chat | Medium | High |
| 6 | Command Palette (Cmd+K) | Medium | Medium |
| 7 | Agent Profiles UI | Medium | Medium |
| 8 | Activity Feed | Medium | Medium |
| 9 | Plugin details modal | Small | Medium |
| 10 | Tool testing console | Medium | Medium |
| 11 | Token/cost tracker | Small | Medium |
| 12 | Model selector | Small | Medium |
| 13 | Responsive audit | Medium | Medium |
| 14 | Notifications center | Medium | Low |
| 15 | Onboarding wizard | Medium | Low |
| 16 | Audit log viewer | Small | Low |
| 17 | API key management | Small | Low |
| 18 | WebSocket live updates | Medium | Medium |
| 19 | Export/import memory | Small | Low |
| 20 | Plugin ratings | Small | Low |

---

## Progress Tracking

- [x] Plugin Library (16 plugins, 9 categories) — DONE
- [x] Plugin Library search + installed/available sections — DONE
- [x] Telegram linking (merge memory + history) — DONE
- [x] Fix POST body 400 error — DONE
- [x] Phase 1.1: Load chat history on page open — DONE
- [x] Phase 1.2: Render agent steps in chat — DONE
- [x] Phase 1.3: Stop/abort button — DONE
- [x] Phase 1.4: Session persistence + New Chat — DONE
- [x] Phase 3.1: Command Palette (Cmd+K) — DONE
- [x] Phase 2: Agent Transparency — DONE
- [x] Phase 2.1: Tool Usage Cards — DONE
- [x] Phase 2.2: Streaming Thoughts — DONE (thoughts appear live per step)
- [x] Phase 2.3: Agent Profiles UI — DONE
- [x] Phase 3.2-3.4: Activity Feed, Token Tracker, Model Selector — DONE
- [x] Phase 4: Plugin Marketplace — DONE (Details Modal, Tool Testing Console, Categories Filter, Ratings)
- [ ] Phase 5: Mobile & UX
- [ ] Phase 6: Pro Features
