# Titan Dashboard Rebuild Plan

> **Goal**: Build a world-class, professional-grade dashboard with exceptional UI/UX that is fully functional and properly wired to every backend API endpoint.

---

## 0. Brand Identity — "Titan"

### 0.1 Brand Concept

Titan is a powerful AI agent platform — the dashboard must feel like a **mission control center** for AI operations. The identity draws from deep space mythology (Titan = Saturn's largest moon) combined with a **cyberpunk-meets-enterprise** aesthetic.

**Tagline**: *"Command Your AI Swarm"*

**Personality**: Powerful, intelligent, precise, trustworthy. Not playful — commanding.

### 0.2 Logo System

```
┌─────────────────────────────────────┐
│  T I T A N                          │
│  ▲                                  │
│  /|\  — Geometric "T" formed by     │
│ / | \   ascending triangles,        │
│  /|\    representing a swarm of     │
│ / | \   agents converging upward    │
└─────────────────────────────────────┘
```

- **Primary Logo**: Geometric "T" mark made of 3 stacked triangles (ascending, representing agent swarm convergence)
- **Favicon**: Simplified single triangle with gradient
- **Loading**: Animated triangle assembly (3 triangles converge into the T mark)
- **Logo variants**: Full (logo + wordmark), Mark only (triangle T), Wordmark only

### 0.3 Color Palette

#### Dark Theme (Primary)

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-void` | `#0A0E1A` | App background (deepest layer) |
| `--bg-surface` | `#111827` | Cards, panels |
| `--bg-elevated` | `#1A2234` | Modals, dropdowns, hover states |
| `--bg-sidebar` | `#0D1320` | Sidebar navigation |
| `--border-subtle` | `#1E293B` | Subtle borders, dividers |
| `--border-default` | `#334155` | Default borders, inputs |
| `--text-primary` | `#F1F5F9` | Primary text |
| `--text-secondary` | `#94A3B8` | Secondary text, labels |
| `--text-muted` | `#64748B` | Muted text, placeholders |
| `--accent-primary` | `#06B6D4` | Cyan — primary actions, links |
| `--accent-primary-glow` | `#06B6D420` | Glow effect for primary |
| `--accent-secondary` | `#8B5CF6` | Purple — secondary actions |
| `--accent-tertiary` | `#10B981` | Emerald — success states |
| `--status-success` | `#10B981` | Success |
| `--status-warning` | `#F59E0B` | Warning |
| `--status-error` | `#EF4444` | Error |
| `--status-info` | `#3B82F6` | Info |
| `--status-queued` | `#6366F1` | Queued/pending |
| `--status-running` | `#06B6D4` | Running/active |
| `--gradient-brand` | `linear-gradient(135deg, #06B6D4 0%, #8B5CF6 100%)` | Brand gradient |
| `--gradient-surface` | `linear-gradient(180deg, #111827 0%, #0A0E1A 100%)` | Surface depth |

#### Light Theme (Optional)

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-void` | `#F8FAFC` | App background |
| `--bg-surface` | `#FFFFFF` | Cards |
| `--bg-elevated` | `#F1F5F9` | Modals, hover |
| `--bg-sidebar` | `#FFFFFF` | Sidebar |
| `--border-subtle` | `#E2E8F0` | Subtle borders |
| `--border-default` | `#CBD5E1` | Input borders |
| `--text-primary` | `#0F172A` | Primary text |
| `--text-secondary` | `#475569` | Secondary text |
| `--text-muted` | `#94A3B8` | Muted |
| `--accent-primary` | `#0891B2` | Cyan (darker for contrast) |
| `--accent-secondary` | `#7C3AED` | Purple |

### 0.4 Typography

| Element | Font | Size | Weight | Line Height |
|---------|------|------|--------|-------------|
| Display | Inter | 32px | 700 | 1.2 |
| H1 | Inter | 28px | 700 | 1.3 |
| H2 | Inter | 22px | 600 | 1.4 |
| H3 | Inter | 18px | 600 | 1.4 |
| Body | Inter | 15px | 400 | 1.6 |
| Small | Inter | 13px | 400 | 1.5 |
| Mono | JetBrains Mono | 14px | 400 | 1.6 |
| Label | Inter | 12px | 500 | 1.4 |
| Caption | Inter | 11px | 400 | 1.4 |

- **Font loading**: Inter via `@fontsource/inter`, JetBrains Mono via `@fontsource/jetbrains-mono`
- **Feature**: Tabular numbers for all stats/metrics (font-variant-numeric: tabular-nums)

### 0.5 Spacing & Layout

- **Grid**: 8px base unit (4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- **Sidebar width**: 260px (expanded), 72px (collapsed)
- **Content max-width**: 1440px
- **Card padding**: 24px (default), 16px (compact)
- **Border radius**: 12px (cards), 8px (inputs/buttons), 6px (badges), 4px (tags)
- **Shadows**:
  - `sm`: `0 1px 2px rgba(0,0,0,0.3)`
  - `md`: `0 4px 12px rgba(0,0,0,0.4)`
  - `lg`: `0 8px 24px rgba(0,0,0,0.5)`
  - `glow`: `0 0 20px rgba(6,182,212,0.15)` (accent glow)

### 0.6 Motion & Animation

| Interaction | Duration | Easing | Effect |
|-------------|----------|--------|--------|
| Page transition | 200ms | ease-out | Fade + slight slide |
| Modal open | 200ms | ease-out | Scale 0.95→1 + fade |
| Modal close | 150ms | ease-in | Scale 1→0.95 + fade |
| Sidebar collapse | 250ms | ease-in-out | Width transition |
| Card hover | 150ms | ease-out | Subtle lift (translateY -2px) |
| Button press | 100ms | ease-out | Scale 0.97 |
| Skeleton shimmer | 1.5s | linear | Infinite gradient sweep |
| Logo assembly | 800ms | spring | Triangles converge |
| Toast slide-in | 300ms | spring | Slide from bottom-right |
| Status pulse | 2s | ease-in-out | Infinite opacity pulse for "running" states |

### 0.7 Component Visual Language

- **Buttons**: Solid (primary action), Ghost (secondary), Outline (tertiary), Icon (compact). Primary buttons use brand gradient on hover.
- **Cards**: `bg-surface` with `border-subtle`, 12px radius, subtle shadow on hover. Optional accent left-border for status cards.
- **Tables**: Zebra striping with `bg-elevated/30`, sticky headers, hover row highlight with `bg-elevated/50`.
- **Status Badges**: Pill shape, 6px radius, dot indicator + label. Color from status palette.
- **Inputs**: `bg-void` with `border-default`, focus ring in `accent-primary` with glow.
- **Sidebar**: `bg-sidebar` with active item highlighted by left accent bar (3px, accent-primary) + subtle background.
- **Top bar**: `bg-surface` with bottom border, 56px height, contains: workspace switcher, search, notifications, user menu.
- **Empty States**: Centered icon (64px, muted), title, description, CTA button.
- **Loading**: Skeleton shimmer for content, spinner for buttons, progress bar for uploads.

### 0.8 Iconography

- **Library**: Lucide React (already installed)
- **Size**: 16px (inline), 20px (navigation), 24px (empty states), 48px (hero)
- **Style**: Stroke-based, 1.5px stroke width, rounded corners
- **Key icons**:
  - Dashboard: `LayoutDashboard`
  - Chat: `MessageSquare`
  - Agents: `Bot`
  - Runs: `Activity`
  - Files: `FolderTree`
  - Terminal: `TerminalSquare`
  - Git: `GitBranch`
  - Swarm: `Network`
  - Queue: `Layers`
  - Health: `HeartPulse`
  - Plugins: `Puzzle`
  - Webhooks: `Webhook`
  - Cron: `Clock`
  - API Keys: `KeyRound`
  - Settings: `Settings`
  - Workspaces: `Building2`
  - Memory: `Brain`
  - Audit: `ShieldCheck`
  - Metrics: `BarChart3`
  - Playground: `FlaskConical`

### 0.9 Voice & Tone

- **UI Copy**: Clear, concise, professional. No jargon. Action-oriented.
  - "Create agent" not "New agent profile configuration"
  - "3 runs active" not "There are currently 3 active runs"
- **Empty States**: Helpful, not apologetic.
  - "No agents yet — create your first AI agent to get started"
- **Errors**: Specific, actionable.
  - "Failed to save file: path not found. Check the file still exists."
- **Success**: Brief, confirming.
  - "Agent created" not "Your agent profile was successfully created"

---

## 1. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | React 18 + TypeScript | Existing codebase, strict typing |
| Build | Vite 5 | Fast HMR, existing config |
| Styling | TailwindCSS 3 | Existing config, utility-first |
| UI Components | shadcn/ui + Radix Primitives | Accessible, customizable, professional |
| Icons | Lucide React | Already installed |
| Charts | Tremor (already installed) or Recharts | Analytics/metrics visualization |
| Terminal | xterm.js (already installed) | Terminal emulator |
| Code Editor | Monaco Editor (already installed) | File editing |
| Routing | React Router 6 | Already used |
| State | React Context + hooks | Lightweight, no extra deps |
| Forms | react-hook-form + zod | Type-safe forms matching backend zod schemas |
| Notifications | Sonner | Toast notifications |
| Animations | Framer Motion | Smooth transitions, micro-interactions |

---

## 2. Backend API Audit — Complete Endpoint Map

### 2.1 Authentication (`/api/v1/auth`)

| Method | Endpoint | Auth | Description | Dashboard Use |
|--------|----------|------|-------------|---------------|
| POST | `/api/v1/auth/register` | No | Register new user | Login page |
| POST | `/api/v1/auth/login` | No | Login, returns JWT + refresh | Login page |
| POST | `/api/v1/auth/refresh` | No | Refresh access token | Auto-refresh interceptor |
| POST | `/api/v1/auth/logout` | Yes | Logout current session | User menu |
| POST | `/api/v1/auth/logout-all` | Yes | Logout all sessions | Settings page |
| GET | `/api/v1/auth/me` | Yes | Current user info | Auth context |

### 2.2 Workspaces (`/api/v1/workspaces`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/workspaces` | Yes | List user's workspaces |
| POST | `/api/v1/workspaces` | Yes | Create workspace |
| GET | `/api/v1/workspaces/:id` | Yes | Get workspace details |
| PATCH | `/api/v1/workspaces/:id` | Yes | Update workspace |
| DELETE | `/api/v1/workspaces/:id` | Yes | Soft-delete workspace |
| GET | `/api/v1/workspaces/:id/members` | Yes | List members |
| POST | `/api/v1/workspaces/:id/members` | Yes | Add member |
| DELETE | `/api/v1/workspaces/:id/members/:userId` | Yes | Remove member |

### 2.3 API Keys (`/api/v1/api-keys`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/api-keys` | Yes | Create API key (returns plaintext once) |
| GET | `/api/v1/api-keys` | Yes | List API keys |
| DELETE | `/api/v1/api-keys/:id` | Yes | Revoke API key |

### 2.4 Agents (`/api/v1/agents`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/agents/:agentId/run` | Yes | Queue agent run (async) |
| GET | `/api/v1/agents/:agentId/runs` | Yes | List runs for agent |
| GET | `/api/v1/agents/:agentId/runs/:runId` | Yes | Get run details |
| POST | `/api/v1/agents/:agentId/stream` | Yes | SSE streaming chat (text + agent mode) |
| GET | `/api/v1/agents/:agentId/runs/:runId/steps` | Yes | Get run steps |

### 2.5 Agent Profiles (`/api/v1/agent-profiles`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/agent-profiles` | Yes | List my profiles |
| GET | `/api/v1/agent-profiles/public` | No | List public profiles |
| POST | `/api/v1/agent-profiles` | Yes | Create profile |
| GET | `/api/v1/agent-profiles/:id` | Yes | Get profile |
| PATCH | `/api/v1/agent-profiles/:id` | Yes | Update profile |
| DELETE | `/api/v1/agent-profiles/:id` | Yes | Delete profile |

### 2.6 Chat (`/api/v1/chat`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/chat` | Yes | SSE streaming chat with context, history, file attachments |

### 2.7 Files (`/api/v1/files`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/files` | Yes | List directory contents |
| POST | `/api/v1/files/mkdir` | Yes | Create directory |
| POST | `/api/v1/files/upload` | Yes | Upload files (multipart) |
| GET | `/api/v1/files/download` | Yes | Download single file |
| GET | `/api/v1/files/download-zip` | Yes | Download directory as ZIP |
| DELETE | `/api/v1/files` | Yes | Delete file/directory |
| GET | `/api/v1/files/content` | Yes | Read file content |
| PUT | `/api/v1/files/content` | Yes | Write file content |

### 2.8 Git (`/api/v1/git`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/git/push` | Yes | Git add, commit, push |

### 2.9 Terminal (`/terminal`)

| Type | Endpoint | Auth | Description |
|------|----------|------|-------------|
| WebSocket | `/terminal?token=JWT` | JWT in query | Interactive shell (bash/PowerShell) |

### 2.10 Swarm (`/api/v1/swarm`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/swarm/run` | Yes | Launch multi-agent swarm task |
| GET | `/api/v1/swarm/tasks` | Yes | List recent swarm tasks |
| GET | `/api/v1/swarm/tasks/:taskId` | Yes | Get task details |

### 2.11 Plugins (`/api/v1/plugins`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/plugins` | No | List all plugins |
| GET | `/api/v1/plugins/:id` | No | Get plugin details |
| POST | `/api/v1/plugins` | Yes | Install plugin |
| PATCH | `/api/v1/plugins/:id/status` | Yes | Enable/disable plugin |
| POST | `/api/v1/plugins/:id/execute` | Yes | Execute plugin tool |
| GET | `/api/v1/plugins/search` | No | Search plugins |
| POST | `/api/v1/plugins/:id/rate` | Yes | Rate plugin |
| GET | `/api/v1/plugins/:id/ratings` | No | Get plugin ratings |
| PATCH | `/api/v1/plugins/:id/versions/:vid/publish` | Yes | Publish version |
| PATCH | `/api/v1/plugins/:id/versions/:vid/deprecate` | Yes | Deprecate version |
| GET | `/api/v1/plugins/loaded` | Yes | List loaded plugins in memory |
| DELETE | `/api/v1/plugins/:id` | Yes | Delete plugin |

### 2.12 Cron Jobs (`/api/v1/cron`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/cron` | Yes | List cron jobs |
| POST | `/api/v1/cron` | Yes | Create cron job |
| GET | `/api/v1/cron/:id` | Yes | Get cron job |
| PATCH | `/api/v1/cron/:id` | Yes | Update cron job |
| DELETE | `/api/v1/cron/:id` | Yes | Delete cron job |

### 2.13 Webhooks (`/api/v1/webhooks`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/webhooks` | Yes | List webhooks |
| POST | `/api/v1/webhooks` | Yes | Create webhook |
| GET | `/api/v1/webhooks/:id` | Yes | Get webhook |
| PATCH | `/api/v1/webhooks/:id` | Yes | Update webhook |
| POST | `/api/v1/webhooks/:id/rotate-secret` | Yes | Rotate signing secret |
| GET | `/api/v1/webhooks/:id/deliveries` | Yes | Delivery log |
| DELETE | `/api/v1/webhooks/:id` | Yes | Delete webhook |
| POST | `/api/v1/webhooks/:id/trigger` | HMAC | Public trigger endpoint |

### 2.14 User Keys (`/api/v1/user/keys`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/user/keys` | Yes | List user keys |
| POST | `/api/v1/user/keys` | Yes | Add key (encrypted) |
| DELETE | `/api/v1/user/keys/:keyId` | Yes | Delete key |
| GET | `/api/v1/user/keys/:keyId/value` | Yes | Get decrypted value |

### 2.15 Compliance & Audit (`/api/v1/compliance`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/compliance/audit/verify` | Yes | Verify hash chain |
| GET | `/api/v1/compliance/audit/retention` | Yes | Retention info |
| POST | `/api/v1/compliance/audit/archive` | Yes | Archive old logs |
| GET | `/api/v1/compliance/audit/logs` | Yes | List audit logs |

### 2.16 Health & Metrics

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health/live` | No | Liveness probe |
| GET | `/health/ready` | No | Readiness probe |
| GET | `/health/startup` | No | Startup check |
| GET | `/health/dashboard` | Yes | Full health dashboard |
| GET | `/metrics` | Yes | Prometheus metrics |
| GET | `/metrics.json` | Yes | JSON metrics snapshot |
| GET | `/api/v1/admin/queues/:name/stats` | Yes | Queue stats |

### 2.17 WebSocket RPC (`/ws`)

| Method | Type | Description |
|--------|------|-------------|
| `ping` | Request | Health check |
| `server.info` | Request | Server info |
| `queue.stats` | Request | Queue statistics |
| `client.pong` | Notification | Heartbeat response |

### 2.18 Telegram Bot

| Endpoint | Description |
|----------|-------------|
| Telegram Bot API | Integrated via `registerTelegramRoutes` |

---

## 3. Database Schema Summary

### Core Tables
- **users** — id, email, name, password_hash, is_active, is_system, timestamps
- **workspaces** — id, name, slug, description, owner_id, timestamps
- **workspace_members** — workspace_id, user_id, role (owner/admin/member/viewer)
- **sessions** — user_id, refresh_token_hash, user_agent, ip_address
- **api_keys** — user_id, workspace_id, name, key_hash, key_prefix, scopes, expires_at

### Agent Tables
- **agent_profiles** — name, slug, system_prompt, model, allowed_tools, forbidden_tools, max_steps, temperature, owner_id, is_public
- **agent_runs** — agent_id, user_id, workspace_id, prompt, status, max_steps, current_step, tokens_used, final_answer
- **agent_steps** — run_id, step_index, status, thought, plan, action_name, observation_data, reflection, tokens_used, latency_ms

### Memory Tables
- **memory_messages** — session_id, role, content, metadata
- **memory_collections** — name, workspace_id, item_count
- **memory_items** — collection_id, external_id, content, embedding, metadata
- **user_secrets** — owner_id, key, value_enc (AES-256)
- **user_context** — owner_id, key, value (plain text facts)
- **user_long_term_memory** — user_id, key, value (JSONB), category, confidence, source
- **conversation_summaries** — user_id, session_id, summary, topics, decisions, action_items, mood

### Plugin Tables
- **plugins** — name, description, author, source, status, tags, capabilities
- **plugin_versions** — plugin_id, version, manifest, entrypoint, checksum, signature, status
- **plugin_ratings** — plugin_id, user_id, rating, review
- **plugin_installs** — plugin_id, workspace_id, version

### Integration Tables
- **integrations** — workspace_id, type (slack/discord/notion/linear/jira/github/etc), status, config_encrypted
- **notifications** — user_id, type, title, body, read, action_url
- **user_preferences** — user_id, theme, language, notification_email, notification_push

### Analytics Tables
- **token_usage** — user_id, model, input_tokens, output_tokens, total_tokens, cost_usd, run_id
- **tool_execution_stats** — tool_name, success, duration_ms, error_type

### Advanced Tables
- **workflows** — workspace_id, name, description, nodes (JSONB), edges (JSONB), entry_node
- **workflow_executions** — workflow_id, status, input, node_results
- **run_feedback** — run_id, user_id, rating (positive/negative/neutral), comment
- **marketplace_listings** — type, name, description, author_id, downloads, rating_avg, manifest
- **marketplace_reviews** — listing_id, user_id, rating, comment
- **user_favorites** — user_id, listing_id
- **indexed_documents** — workspace_id, name, type, chunk_count, total_chars
- **code_symbols** — workspace_id, name, kind, file_path, line_number, exported, signature
- **user_projects** — owner_id, name, path, repo_url, branch, description, is_default
- **project_context** — user_id, project_name, tech_stack, architecture_notes, known_issues, recent_changes
- **webhooks** — owner_id, name, url, secret, events, is_active
- **audit.logs** — actor_id, workspace_id, action, resource, resource_id, metadata, ip_address

---

## 4. Dashboard Pages Plan

### 4.1 Pages to Build (Priority Order)

#### Tier 1 — Core (Must Have)
1. **Login / Register** — split-screen, branded, validation
2. **Dashboard Overview** — stats cards, recent activity, quick actions
3. **Chat** — SSE streaming, multi-turn, file attachments, agent mode toggle
4. **Agents** — list, create, edit, delete profiles; run agent; view run history
5. **Runs** — list all runs, filter by status/agent, view run details + steps timeline
6. **Files** — file explorer tree, upload, download, Monaco editor, delete

#### Tier 2 — Operations (Should Have)
7. **Terminal** — xterm.js, WebSocket shell, resize, themes
8. **Git** — push form, commit message, file selection, history
9. **Swarm** — create swarm task, agent configuration, task monitoring
10. **Playground** — raw API playground, test endpoints, view responses
11. **Queue** — queue stats per queue, active/waiting/completed/failed
12. **Health** — system health, DB pool, Redis, queue health, audit integrity

#### Tier 3 — Management (Nice to Have)
13. **API Keys** — create, list, revoke, copy-once pattern
14. **Webhooks** — CRUD, secret rotation, delivery log
15. **Cron Jobs** — CRUD, cron expression helper, next run preview
16. **Plugins** — marketplace, install, enable/disable, rate, search
17. **Workspaces** — CRUD, member management, role assignment
18. **Settings** — user preferences, theme, language, notifications, user keys
19. **Memory** — view user context, long-term memory, conversation summaries
20. **Audit Logs** — filterable log table, hash chain verification
21. **Metrics** — charts, token usage, cost tracking, tool execution stats

#### Tier 4 — Parked (Complex / May Not Work)
22. **Logs** — requires log streaming infrastructure (PARKED)
23. **Integrations** — Slack/Discord/Notion setup UI (PARKED — backend incomplete)
24. **Workflows** — visual workflow builder (PARKED — no backend route exists)
25. **Marketplace** — browse/download agents/tools (PARKED — no backend route exists)

### 4.2 Shared Components

- **Layout** — sidebar nav, top bar (user menu, workspace switcher, notifications), main content area
- **AuthContext** — login, logout, refresh, user info, token management
- **ApiClient** — typed fetch wrapper, auto-refresh, error handling
- **NotificationProvider** — toast notifications via Sonner
- **DataTable** — reusable table with sorting, filtering, pagination
- **Modal/Dialog** — shadcn/ui based
- **ConfirmDialog** — destructive action confirmation
- **StatusBadge** — colored status indicators
- **EmptyState** — friendly empty states with illustrations
- **LoadingSkeleton** — shimmer loading states
- **ErrorBoundary** — graceful error handling
- **CodeBlock** — syntax-highlighted code display
- **MarkdownRenderer** — render markdown in chat/messages

---

## 5. UI/UX Design Principles

### 5.1 Visual Design
- **Theme**: Dark-first with optional light mode (user_preferences.theme)
- **Colors**: Deep navy background, cyan/teal accents, semantic colors for status
- **Typography**: Inter font, clear hierarchy (16px base, 14px secondary, 12px labels)
- **Spacing**: 8px grid system, consistent padding/margins
- **Shadows**: Subtle, layered for depth
- **Border radius**: 8px for cards, 6px for inputs, 4px for badges
- **Animations**: Subtle transitions (150-200ms), loading shimmer, slide-in for modals

### 5.2 UX Patterns
- **Optimistic updates** for mutations with rollback on error
- **Skeleton loading** for all async content
- **Empty states** with helpful CTAs
- **Error states** with retry buttons
- **Toast notifications** for success/error feedback
- **Keyboard shortcuts** for power users (Cmd+K command palette)
- **Responsive**: Desktop-first, collapsible sidebar for tablet, stacked for mobile
- **Accessibility**: ARIA labels, keyboard navigation, focus traps in modals
- **Real-time**: WebSocket for live updates (queue stats, run status)

---

## 6. Architecture

```
apps/dashboard/src/
├── main.tsx                    # Entry point
├── App.tsx                     # Router + providers
├── index.css                   # Tailwind + global styles
│
├── api/
│   ├── client.ts               # Base fetch wrapper, auth, interceptors
│   ├── types.ts                # All TypeScript interfaces
│   ├── auth.ts                 # Auth API methods
│   ├── agents.ts               # Agent + profile API methods
│   ├── files.ts                # File API methods
│   ├── workspaces.ts           # Workspace API methods
│   ├── plugins.ts              # Plugin API methods
│   ├── swarm.ts                # Swarm API methods
│   ├── cron.ts                 # Cron API methods
│   ├── webhooks.ts             # Webhook API methods
│   ├── compliance.ts           # Audit/compliance API methods
│   ├── keys.ts                 # API keys + user keys
│   ├── health.ts               # Health + metrics API methods
│   └── git.ts                  # Git API methods
│
├── components/
│   ├── ui/                     # shadcn/ui primitives (button, input, dialog, etc.)
│   ├── layout/
│   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   ├── TopBar.tsx          # User menu, workspace switcher, notifications
│   │   └── Layout.tsx          # Shell layout
│   ├── shared/
│   │   ├── DataTable.tsx       # Reusable table
│   │   ├── StatusBadge.tsx     # Status indicators
│   │   ├── EmptyState.tsx      # Empty state component
│   │   ├── ConfirmDialog.tsx   # Destructive confirmation
│   │   ├── CodeBlock.tsx       # Syntax-highlighted code
│   │   ├── MarkdownRenderer.tsx # Markdown rendering
│   │   └── ErrorBoundary.tsx   # Error boundary
│   └── charts/
│       ├── TokenUsageChart.tsx
│       ├── CostChart.tsx
│       └── QueueStatsChart.tsx
│
├── contexts/
│   ├── AuthContext.tsx         # Auth state, login/logout/refresh
│   └── NotificationContext.tsx # Toast notifications
│
├── hooks/
│   ├── useApi.ts               # Generic data fetching hook
│   ├── useDebounce.ts          # Debounce hook
│   ├── useWebSocket.ts         # WebSocket connection hook
│   └── useLocalStorage.ts      # Persist UI state
│
├── pages/
│   ├── Login.tsx
│   ├── Dashboard.tsx           # Overview
│   ├── Chat.tsx
│   ├── Agents.tsx
│   ├── Runs.tsx
│   ├── Files.tsx
│   ├── Terminal.tsx
│   ├── Git.tsx
│   ├── Swarm.tsx
│   ├── Playground.tsx
│   ├── Queue.tsx
│   ├── Health.tsx
│   ├── ApiKeys.tsx
│   ├── Webhooks.tsx
│   ├── Cron.tsx
│   ├── Plugins.tsx
│   ├── Workspaces.tsx
│   ├── Settings.tsx
│   ├── Memory.tsx
│   ├── AuditLogs.tsx
│   ├── Metrics.tsx
│   └── NotFound.tsx
│
└── utils/
    ├── format.ts               # Date/number/bytes formatters
    └── constants.ts            # App constants, nav items
```

---

## 7. Implementation Phases

### Phase 1: Foundation (Core)
- [ ] Install dependencies (shadcn/ui, framer-motion, sonner, react-hook-form)
- [ ] Set up Tailwind theme (colors, typography, spacing)
- [ ] Build API client with auto-refresh interceptor
- [ ] Build AuthContext with login/logout/refresh
- [ ] Build Layout (sidebar, topbar, content area)
- [ ] Build Login/Register page
- [ ] Build Dashboard overview page

### Phase 2: Core Features
- [ ] Chat page (SSE streaming, file attachments, agent mode)
- [ ] Agents page (CRUD profiles, run agent, view runs)
- [ ] Runs page (list, filter, detail with steps timeline)
- [ ] Files page (file explorer, Monaco editor, upload/download)

### Phase 3: Operations
- [ ] Terminal page (xterm.js WebSocket)
- [ ] Git page (push form, history)
- [ ] Swarm page (create task, monitor)
- [ ] Queue page (live stats via WebSocket)
- [ ] Health page (system health dashboard)

### Phase 4: Management
- [ ] API Keys page
- [ ] Webhooks page
- [ ] Cron Jobs page
- [ ] Plugins page (marketplace)
- [ ] Workspaces page
- [ ] Settings page
- [ ] Memory page
- [ ] Audit Logs page
- [ ] Metrics page

### Phase 5: Polish
- [ ] Command palette (Cmd+K)
- [ ] Keyboard shortcuts
- [ ] Responsive design audit
- [ ] Accessibility audit
- [ ] Dark/light theme toggle
- [ ] Animation polish
- [ ] Error states + empty states review
- [ ] Performance optimization (lazy loading, code splitting)

---

## 8. Parked Features (May Not Work / Backend Incomplete)

| Feature | Reason | Status |
|---------|--------|--------|
| **Logs page** | No log streaming API endpoint | PARKED |
| **Integrations UI** | No REST routes for integrations CRUD | PARKED |
| **Workflow Builder** | No REST routes for workflows CRUD | PARKED |
| **Marketplace Browse** | No REST routes for marketplace listings | PARKED |
| **Notifications panel** | Table exists but no API routes | PARKED |
| **User Preferences** | Table exists but no API routes | PARKED |
| **Run Feedback** | Table exists but no API routes | PARKED |
| **Project Context** | Table exists but no API routes | PARKED |
| **Code Symbols Index** | Table exists but no API routes | PARKED |
| **Telegram Bot UI** | Bot exists but no dashboard integration needed | N/A |

---

## 9. Key Technical Decisions

1. **No global state library** — React Context + hooks are sufficient for this app size
2. **SSE for chat streaming** — Already implemented in backend, use EventSource API
3. **WebSocket for real-time** — Use for queue stats, run status updates, terminal
4. **Token refresh** — Interceptor in API client, refresh before expiry
5. **File uploads** — Multipart form data via fetch API
6. **Monaco editor** — Lazy load to avoid initial bundle bloat
7. **xterm.js** — Already installed, use addons for fit + web links
8. **Form validation** — Mirror backend zod schemas on frontend
9. **Error handling** — Centralized error handler in API client, toast on errors
10. **Code splitting** — Lazy load all pages (already done in previous version)

---

## 10. Dependencies to Install

```bash
npm install sonner framer-motion react-hook-form @hookform/resolvers class-variance-authority clsx tailwind-merge @fontsource/inter @fontsource/jetbrains-mono
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input dialog dropdown-menu select table tabs card badge avatar separator sheet tooltip toast skeleton scroll-area switch checkbox
```

> Note: Keep existing deps (lucide-react, @tremor/react, @monaco-editor/react, @xterm/*, xterm, tailwindcss, react-router-dom)

---

## 11. Success Criteria

- [ ] Every page is fully functional and wired to its backend API
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Build passes cleanly (`npm run build`)
- [ ] Responsive on desktop, tablet, mobile
- [ ] Dark theme is polished and professional
- [ ] Loading states for all async operations
- [ ] Error states with retry for all failed operations
- [ ] Empty states with CTAs for all list views
- [ ] Keyboard accessible (tab navigation, focus traps)
- [ ] Auto token refresh works seamlessly
- [ ] SSE chat streaming works with typing indicators
- [ ] WebSocket terminal works with resize
- [ ] File editor saves via API
- [ ] All CRUD operations show toast feedback
