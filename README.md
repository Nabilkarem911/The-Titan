# TITAN

**Production-grade autonomous AI agent framework.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-22+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-AGPL--3.0-blue?style=flat-square)](LICENSE)

---

## What is Titan

Titan is an autonomous AI agent framework built entirely from scratch in TypeScript. It provides a multi-step agent runner with tool execution, streaming responses, and a registry of 80+ tools. The system includes JWT authentication, RBAC, audit logging, rate limiting, and a PostgreSQL-backed persistence layer with 34 migrations. Titan supports multi-channel communication (Telegram, Discord, Slack, WhatsApp) and includes a React dashboard with 47 pages. It is designed to be self-hosted via Docker Compose with PostgreSQL, Redis, and a local embedding service.

---

## Quick Start

```bash
# 1. Clone and configure
git clone https://github.com/Nabilkarem911/The-Titan.git
cd Titan
cp .env.example .env
# Edit .env — set JWT_SECRET, LLM_API_KEY, and database passwords

# 2. Start all services
docker compose up -d

# 3. Check health
curl http://localhost:3001/api/v1/health/live

# 4. Open the dashboard
open http://localhost:3001
```

Services started:

| Service | Port | Description |
|---------|------|-------------|
| `core` | 3001 | Titan API server |
| `worker` | — | Queue processor |
| `postgres` | 55432 | PostgreSQL 16 + pgvector |
| `redis` | 6379 | Redis (queue, cache, pub/sub) |
| `embed` | 8100 | Local BGE-small embedding service |

Optional tools (add `--profile tools`): pgAdmin on 5050, Redis Insight on 5540.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Dashboard                       │
│                   (47 pages, Vite)                       │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / WebSocket
┌────────────────────────▼────────────────────────────────┐
│                   Titan Core API                         │
│              (Fastify, 50 route files)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │   Auth   │ │   Chat   │ │ Autonomous│ │ Reasoning│   │
│  │  (JWT)   │ │ (SSE)    │ │  Tasks   │ │   Tools  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │  Agents  │ │  Files   │ │  Teams   │ │   V5     │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└──────┬───────────┬──────────────┬──────────────┬───────┘
       │           │              │              │
┌──────▼─────┐ ┌──▼───────┐ ┌────▼─────┐ ┌──────▼──────┐
│ agent-engine│ │  tools   │ │ database │ │   memory    │
│ (runner,    │ │ (bash,   │ │ (pg,     │ │ (pgvector,  │
│  registry,  │ │  files,  │ │  34 migr │ │  redis)     │
│  80+ tools) │ │  utils)  │ │          │ │             │
└─────────────┘ └──────────┘ └──────────┘ └─────────────┘
       │
┌──────▼──────────────────────────────────────┐
│              14 packages total               │
│ agent-engine · tools · database · memory     │
│ auth · config · logging · observability      │
│ queue · sandbox · sdk · shared · telemetry   │
│ websocket                                    │
└──────────────────────────────────────────────┘
```

---

## Core Capabilities

### Agent & Chat

- ✅ **Multi-step agent runner** — planning, strategy selection, self-critique, tool execution
- ✅ **Streaming chat** — SSE streaming with multi-turn context
- ✅ **80+ registered tools** — bash, file operations, code analysis, web search, creative generation, translation, and more
- ✅ **Tool registry** — LRU cache (max 500 entries), periodic cleanup, rate limiting per tool
- ✅ **Self-Forge** — agent generates new tools at runtime
- ✅ **Code intelligence** — codebase indexing, smart context building, symbol extraction
- ✅ **Autonomous task executor** — plan → execute → verify → auto-fix → commit loop
- ✅ **Verification runner** — async typecheck, lint, test, build (non-blocking)

### Security

- ✅ **JWT authentication** — access + refresh tokens, API key auth
- ✅ **RBAC** — role-based permissions on all endpoints
- ✅ **Audit logging** — all actions logged to database
- ✅ **Rate limiting** — global, auth, API, and per-tool limits
- ✅ **CWD validation** — `validateCwd` on bash and autonomous routes
- ✅ **AsyncLocalStorage** — per-request user context (no global state leakage)
- ✅ **Sandbox** — command validation, forbidden patterns, output truncation
- ✅ **Helmet** — CSP, security headers
- ✅ **Encryption** — API key encryption at rest

### Memory & Persistence

- ✅ **pgvector embeddings** — 384-dim local BGE-small model
- ✅ **Chat history** — session-based storage with window function queries
- ✅ **Agent runs** — full run persistence with steps and results
- ✅ **Experience collector** — records agent experiences for learning
- ✅ **Preference learning** — tracks user interactions for personalization
- ✅ **34 database migrations** — foundational tables through full persistence

### Integrations

- ✅ **Telegram bot** — full bot with webhook, inline keyboards, file handling
- ✅ **Discord bot** — message routing and agent responses
- ✅ **Slack integration** — slash commands and mentions
- ✅ **WhatsApp** — webhook-based integration
- ✅ **Desktop agent** — remote desktop control (execute, files, screenshot, mouse, keyboard)
- ✅ **A2A protocol** — agent-to-agent communication
- ✅ **Web intelligence** — Brave Search integration
- ✅ **Browser agent** — headless browser automation
- ✅ **WebMCP bridge** — remote MCP server tool discovery and invocation

### Reasoning & Metacognition

- ✅ **Dream mode** — experience consolidation and insight extraction
- ✅ **Causal replay** — failure analysis with causal attribution
- ✅ **Self-healing debugger** — automatic bug diagnosis and fix proposals
- ✅ **Evolutionary solver** — population-based problem solving
- ✅ **Neuro-symbolic reasoning** — hybrid neural + symbolic logic
- ✅ **Hypothesis testing** — generate and evaluate testable hypotheses
- ✅ **Safety guardrails** — action safety checking
- ✅ **Anti-sycophancy** — detects excessively agreeable responses
- ✅ **Theory of mind** — models user mental state from messages
- ✅ **Test-time recursive thinking** — multi-strategy iterative problem solving
- ✅ **Smart model router** — routes input to best model by complexity/cost
- ✅ **Prompt optimizer** — LLM-based prompt improvement

### Creative & World Model

- ✅ **Digital twin** — system snapshots, trend analysis, anomaly detection, predictive alerts
- ✅ **What-if simulation** — LLM-driven scenario simulation with heuristic fallback
- ✅ **Normative agency** — commitment tracking, conflict detection, action evaluation
- ✅ **Dream world** — creative exploration with LLM-generated insights
- ✅ **Visual workflow builder** — create workflows with nodes, edges, triggers, export to DAG
- ✅ **Creative engine** — image, music, video, art generation prompts
- ✅ **World simulator** — environment graph with entities and relations
- ✅ **Universal translator** — 100+ language translation
- ✅ **Temporal intelligence** — past analysis, future prediction, timeline branches

### Platform

- ✅ **Docker Compose** — PostgreSQL, Redis, embedding service, core, worker
- ✅ **React dashboard** — 47 pages covering all features
- ✅ **SDK** — `TitanClient` with auth, chat, agent runs, streaming
- ✅ **Queue system** — BullMQ-based job processing
- ✅ **WebSocket** — real-time step updates and broadcasting
- ✅ **Observability** — OpenTelemetry traces, metrics, structured logging

---

## Missing or In-Development Features

- 🚧 **MCP Governance** — code exists in `v5.ts` but not connected to chat flow
- 🚧 **DAG Workflow Engine** — registered as tool, not wired to chat agent
- 🚧 **Multi-layer guardrails** — module exists, not integrated into chat pipeline
- 🚧 **Bi-temporal knowledge graph** — endpoints exist, not used by agent
- 🚧 **Hive mind** — collective intelligence module, not connected to chat
- 🚧 **Agent economy** — internal marketplace, not connected to chat
- 🚧 **Swarm evolution** — population evolution, standalone only
- 🚧 **RL training** — reinforcement learning environment, requires state/action generators
- 🚧 **Meta-evolution** — higher-order evolution, returns stats only
- 🚧 **GitHub miner** — repository search, not integrated into agent flow
- 🚧 **Zero-data co-evolution** — self-play evolution, standalone
- 🚧 **Quantum optimizer** — quantum-inspired optimization, basic scoring function
- 🚧 **Autonomous gardener** — creative idea nurturing, not connected to chat
- 🚧 **Infinite self-play** — autonomous skill development, standalone
- 🚧 **Self-evolving code** — module analysis, not auto-applying changes
- 🚧 **Apex evolution** — harness patching, requires manual invocation
- 🚧 **Proactive intelligence** — suggestion engine, not wired to chat
- 🚧 **Cross-user learning** — anonymized patterns, not connected to chat
- 🚧 **Strategy tuner** — performance tracking, no auto-tuning yet
- 🚧 **Edge privacy** — on-device processing framework, not active
- 🚧 **Screen monitor** — multimodal screen analysis, not connected to chat
- 🚧 **Advanced multimodal** — PDF tables, code from screenshots, chart understanding
- 🚧 **Constitution** — principles and amendments, not enforced in agent flow
- 🚧 **Execution state memory** — checkpoint/resume, not auto-triggered
- 🚧 **Self-rewriter** — code patch proposals, sandbox testing, not auto-deployed
- 🚧 **Meta-learning optimizer** — learning process optimization, standalone
- 🚧 **Heuristic extractor** — rule extraction from experiences, not wired to agent
- 🚧 **Benchmarking suite** — standardized task evaluation, standalone
- 🚧 **Hyper-agent** — introspection → improvement → evaluation loop, standalone
- 🚧 **Skill synthesis** — autonomous skill creation, not connected to chat
- 🚧 **Dynamic tool discovery** — missing capability detection, not auto-creating tools
- 🚧 **Emotional intelligence** — text emotion analysis, not wired to chat personality
- 🚧 **Curiosity engine** — topic exploration, standalone
- 🚧 **Metacognitive consolidation** — knowledge synthesis, not scheduled
- 🚧 **Safety memory** — past incident tracking, not enforced in agent flow
- 🚧 **Introspection** — self-examination, not connected to chat
- 🚧 **Inner monologue** — internal dialogue, not surfaced in chat
- 🚧 **Cognitive controller** — attention management, not wired to agent runner
- 🚧 **Episodic buffer** — short-term memory, not connected to chat
- 🚧 **Collaboration** — session manager, not integrated with chat

---

## Environment Variables

Only the essential variables needed to run Titan:

```bash
# Required — security
JWT_SECRET=<at least 64 chars, use: openssl rand -hex 64>
API_KEY_ENCRYPTION_KEY=<32 bytes hex>

# Required — LLM
LLM_PROVIDER_TYPE=openai-compatible
LLM_API_KEY=<your API key>
LLM_MODEL=gpt-4o
LLM_BASE_URL=https://api.openai.com/v1

# Required — database (defaults work with docker compose)
POSTGRES_PASSWORD=<change in production>
REDIS_PASSWORD=<change in production>

# Optional — integrations
TELEGRAM_BOT_TOKEN=
BRAVE_SEARCH_API_KEY=
GITHUB_TOKEN=

# Optional — embeddings (defaults to local BGE-small via docker)
EMBEDDING_BASE_URL=http://embed:8000/v1
EMBEDDING_DIMENSIONS=384
```

See `.env.example` for the full list.

---

## SDK Example

```typescript
import { TitanClient } from '@titan/sdk';

const client = new TitanClient({ baseUrl: 'http://localhost:3001' });
await client.login('user@example.com', 'password');
const result = await client.chat({
  prompt: 'Analyze this codebase and list bugs',
  agentId: 'default-agent',
  stream: false,
});
console.log(result.response);
```

---

## Stats

| Metric | Value |
|--------|-------|
| TypeScript files | 698 |
| Test files | 111 |
| Database migrations | 34 |
| Registered tools | 80 |
| API route files | 50 |
| Packages | 14 |
| Dashboard pages | 47 |
| LLM providers | OpenAI-compatible, Anthropic, Google, Ollama |

---

## License

AGPL-3.0 — see [LICENSE](LICENSE).
