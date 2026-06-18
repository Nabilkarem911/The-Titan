<div align="center">

# TITAN

### Universal Autonomous Agent Framework

**The Most Advanced Open-Source AI Agent System — Built From Scratch**

[![Live](https://img.shields.io/badge/Live-titan.orcanox.xyz-blue?style=for-the-badge)](https://titan.orcanox.xyz)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-1090_passing-success?style=for-the-badge)](.)
[![Node](https://img.shields.io/badge/Node-22+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge)](.)

*Zero LangChain. Zero CrewAI. Zero AutoGen. 100% custom.*

</div>

---

## What is Titan?

Titan is a **complete AI operating system** — not a chatbot wrapper, not a thin API layer, but a full autonomous agent framework that can understand codebases, execute multi-step tasks, learn from experience, and communicate across channels.

```bash
# Talk to Titan from your terminal
titan chat "deploy the latest version to production"

# Or use the interactive REPL
titan
> analyze this codebase and find security issues
> write tests for the auth module
> create a PR with the fixes
```

---

## Core Capabilities

### Agent Intelligence Engine
| Feature | Description |
|---------|-------------|
| **Multi-Strategy Reasoning** | Chain-of-Thought, Tree-of-Thought, Internal Debate — auto-selected per task |
| **Advanced Planning** | Task decomposition, dependency graph, dynamic re-planning on failure |
| **Self-Reflection** | Self-critique, confidence scoring (0-100), error analysis |
| **Smart Retry** | Analyzes failures, switches tools, rephrases, decomposes — automatically |

### Memory Architecture (6 Layers)
| Layer | Purpose |
|-------|---------|
| **Working Memory** | Current task context — like RAM |
| **Episodic Memory** | Past experiences — what worked, what failed |
| **Semantic Memory** | Knowledge and concepts — pgvector search |
| **Procedural Memory** | How to do things — learned procedures |
| **User Memory** | Who you are — preferences, expertise, language |
| **Knowledge Graph** | Entity relationships — who uses what, what depends on what |

### Code Intelligence
| Feature | Description |
|---------|-------------|
| **Codebase Indexing** | Crawls files, extracts symbols, maps imports — 45+ languages |
| **Semantic Code Search** | "find the rate limiting code" — finds it across the entire project |
| **Smart Context** | Selects the most relevant code for LLM context — no more "file too large" |
| **Symbol Lookup** | Functions, classes, interfaces, types, enums — with line numbers |
| **Dependency Graph** | Import mapping — who depends on who |

### Autonomous Execution
| Feature | Description |
|---------|-------------|
| **Plan-Execute-Verify Loop** | Plans task → writes code → runs typecheck → fixes errors → commits |
| **Auto-Fixer** | LLM-powered error fixing with rollback safety |
| **Git Operations** | Branch creation, staging, LLM-generated commit messages |
| **Verification Suite** | TypeScript check, test runner, linter, build verification |

### Multi-Agent Teams
| Template | Roles |
|----------|-------|
| **Dev Team** | Tech Lead, Developer, Code Reviewer, QA Engineer |
| **Research Team** | Research Lead, Researcher, Fact Checker, Writer |
| **Ops Team** | SRE Lead, DevOps Engineer, Security Reviewer |
| **Content Team** | Strategist, Topic Researcher, Writer, Editor |

### 48+ Built-in Tools
**Execution:** bash, docker, file read/write/patch
**Web:** brave search, web scraping, HTTP requests, screenshot
**Data:** SQL queries, CSV/Excel/PDF parsing, calculations
**Communication:** email, Telegram
**Integrations:** GitHub API, git push, webhooks
**Utilities:** JWT decode, regex, translation, QR codes, maps, weather, and more

### MCP Protocol Support
- **MCP Client** — connect to any external MCP server
- **MCP Server** — expose Titan tools via Model Context Protocol
- **Auto-Discovery** — automatically register MCP tools
- **Tool Adapter** — converts MCP tools to Titan format

### Tool Composition
- **Pipelines** — chain tools: `search → scrape → summarize`
- **Parallel Execution** — run multiple tools simultaneously
- **Conditional Branching** — if-else tool execution
- **Macros** — save and reuse tool combinations

---

## Interfaces

### CLI (Terminal)
```bash
titan chat "ازيك يا تايتن"          # Quick message
titan run "build a REST API"         # Run a task
titan status                         # Check server health
titan login --server https://...     # Connect to remote server
titan config set model gpt-4o        # Configure
```

### Web Dashboard (28 Pages)
- **Chat** — real-time streaming with voice I/O
- **Agents** — browse, create, customize agent profiles
- **Playground** — quick agent testing
- **Swarm** — multi-agent task launcher
- **Workflow** — visual workflow builder
- **Terminal** — xterm.js shell in browser
- **Editor** — Monaco code editor
- **Files** — upload, download, browse
- **Git** — commit and push from UI
- **Metrics** — real-time performance monitoring
- **Queue** — BullMQ job management
- **Audit Logs** — tamper-evident hash chain
- **API Docs** — interactive 65+ endpoint explorer
- **System Health** — DB pool, queue depth, service status

### TypeScript SDK
```typescript
import { TitanClient } from '@titan/sdk';

const titan = new TitanClient({ baseUrl: 'https://your-server.com', apiKey: 'tk_...' });

// Simple chat
const response = await titan.chat('What is TypeScript?');

// Stream agent execution
for await (const event of titan.streamAgent({ prompt: 'analyze this PR' })) {
  if (event.type === 'token') process.stdout.write(event.data);
}

// Multi-agent swarm
const result = await titan.runSwarm({
  description: 'Full security audit',
  prompt: 'Audit the entire codebase for vulnerabilities',
});
```

### Channel Integrations
- **WhatsApp Business** — via Cloud API
- **Slack** — Events API + Bot
- **Discord** — Gateway + Bot
- **Telegram** — Webhook + send files

---

## Architecture

```
titan/
├── apps/
│   ├── core/            # Fastify API server (65+ endpoints)
│   ├── dashboard/       # React 18 + Vite + Tailwind (28 pages)
│   └── cli/             # Terminal interface (REPL + commands)
├── packages/
│   ├── agent-engine/    # The brain
│   │   ├── planner/         # Task decomposition + dependency graph
│   │   ├── reflection/      # Self-critique + confidence scoring
│   │   ├── strategies/      # CoT, ToT, Debate, auto-selection
│   │   ├── personality/     # Multilingual adaptive personality
│   │   ├── code-intel/      # Codebase indexing + semantic search
│   │   ├── autonomous/      # Plan→execute→verify→fix loop
│   │   ├── swarm/           # Multi-agent orchestration + supervisor
│   │   ├── workflow/        # Workflow builder + runner + templates
│   │   ├── integrations/    # WhatsApp, Slack, Discord adapters
│   │   ├── teams/           # Pre-built agent team templates
│   │   ├── voice/           # STT/TTS interfaces
│   │   ├── learning/        # Experience collection + insights
│   │   └── providers/       # OpenAI, Anthropic, multi-model router
│   ├── memory/          # The memory
│   │   ├── layers/          # Working, episodic, semantic, procedural, user
│   │   ├── consolidation/   # Summarization, merging, forgetting
│   │   ├── retrieval/       # Hybrid search + context ranking
│   │   ├── graph/           # Entity extraction + knowledge graph
│   │   ├── identity/        # User profiles + conversation continuity
│   │   └── rag/             # Document processing + knowledge base
│   ├── tools/           # The hands
│   │   ├── tools/           # 48+ individual tool implementations
│   │   ├── mcp/             # MCP client + server + adapter
│   │   ├── composition/     # Pipelines, parallel, conditional, macros
│   │   └── browser/         # Web browsing + page extraction
│   ├── sdk/             # TypeScript SDK client
│   ├── shared/          # Types, errors, resilience patterns
│   ├── auth/            # JWT, RBAC, API keys, encryption
│   ├── database/        # PostgreSQL + pgvector + 20 migrations
│   ├── queue/           # BullMQ (9 priority queues)
│   ├── websocket/       # JSON-RPC 2.0 real-time
│   ├── observability/   # Metrics, rate limiting, eval, tracing, cost
│   ├── logging/         # Pino structured logging
│   ├── config/          # Zod env validation
│   ├── sandbox/         # Docker container pool
│   └── telemetry/       # OpenTelemetry
├── services/
│   └── embed/           # Self-hosted embeddings (BGE-small-en-v1.5)
└── docker/              # PostgreSQL + Redis configs
```

---

## Security

- **JWT** with refresh token rotation + reuse detection
- **RBAC** — 4 roles, 16 granular permissions
- **API Keys** — scoped, SHA256 hashed, revokable
- **Audit Logs** — append-only with hash chain integrity (DB trigger enforced)
- **Docker Sandbox** — CapDrop ALL, readonly rootfs, no network, PID limit
- **Rate Limiting** — hybrid per-user + per-IP with abuse detection
- **Encryption** — AES-256-GCM for secrets, bcrypt for passwords
- **Circuit Breaker** — prevents cascade failures
- **Bulkhead** — isolates concurrent operations

---

## Production Features

- **Multi-Model Router** — cheapest/fastest/best/round-robin with auto-fallback
- **Cost Tracking** — per-run, per-model token and cost estimates
- **Evaluation Framework** — benchmarks, accuracy scoring, A/B testing
- **Full Tracing** — every LLM call, tool call, memory access — with nested spans
- **Health Aggregator** — multi-service health checks (critical/degraded/healthy)
- **Graceful Shutdown** — drain queues, close connections, flush logs
- **Self-Learning** — experience collection, pattern detection, strategy tuning

---

## Personality System

Titan adapts to whoever is talking to it:

| Language | Personality |
|----------|-------------|
| Egyptian Arabic | صديق ذكي بيتكلم عامية — "أنا تايتن، صديقك" |
| Gulf Arabic | رفيق يتكلم خليجي — "أنا تايتن، رفيقك" |
| Levantine Arabic | رفيق بيحكي شامي طبيعي |
| Maghreb Arabic | صاحب كيهضر بالدارجة |
| Formal Arabic | مساعد مهني بالفصحى المبسطة |
| English | Smart companion, not a corporate bot |
| French | Compagnon intelligent et naturel |

**Auto-detection** — detects language from the first message and adapts.
**Context-aware** — technical questions get precise answers, casual chat stays natural.
**Safety-first** — destructive operations require confirmation.

---

## Quick Start

### Docker Compose (Recommended)
```bash
git clone https://github.com/Nabilkarem911/The-Titan.git
cd The-Titan
cp .env.example .env  # Configure your LLM API key
docker compose up -d
# Dashboard: http://localhost:3000
```

### Local Development
```bash
npm install
docker compose up -d postgres redis embed  # Infrastructure only
npm run build
npm run dev:core       # API server on :3000
npm run dev:dashboard  # Dashboard on :5173
```

### CLI
```bash
npm run build -w apps/cli
npx titan chat "hello"
# Or link globally:
npm link -w apps/cli
titan
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_PROVIDER_TYPE` | `openai-compatible` or `anthropic` | `openai-compatible` |
| `LLM_API_KEY` | Your LLM API key | — |
| `LLM_MODEL` | Model name | `gpt-4o` |
| `LLM_BASE_URL` | API base URL | `https://api.openai.com/v1` |
| `POSTGRES_HOST` | PostgreSQL host | `localhost` |
| `REDIS_HOST` | Redis host | `localhost` |
| `JWT_SECRET` | JWT signing secret | — |
| `EMBEDDING_BASE_URL` | Embedding service URL | `http://localhost:8100/v1` |

See `packages/config/src/index.ts` for all 60+ configurable variables.

---

## Stats

| Metric | Value |
|--------|-------|
| Total Source Files | 400+ |
| Lines of Code | ~55,000 |
| Test Files | 61 |
| Tests Passing | 1,090 |
| Packages | 16 |
| API Endpoints | 95+ |
| Built-in Tools | 90 |
| Dashboard Pages | 43 |
| Database Migrations | 25 |
| Agent Profiles | 30 |
| Queue Types | 9 |

---

## Roadmap

- [x] Agent Intelligence (planning, reflection, multi-strategy)
- [x] Advanced Memory (5 layers + knowledge graph)
- [x] Swarm Orchestration + Workflow Engine
- [x] MCP Protocol Support
- [x] Tool Composition (pipelines, parallel, macros)
- [x] Evaluation Framework + Cost Tracking
- [x] TypeScript SDK
- [x] CLI Interface
- [x] Code Intelligence (indexer, search, smart context)
- [x] Autonomous Execution (verify→fix→commit loop)
- [x] Persistent Identity + User Profiles
- [x] Browser Agent (web browsing, page extraction)
- [x] Document RAG (chunking, citations, knowledge base)
- [x] Multi-Agent Teams (dev, research, ops, content)
- [x] Self-Learning (experience collection, insights)
- [x] Adaptive Multilingual Personality (7 languages)
- [x] Channel Integrations (WhatsApp, Slack, Discord)
- [x] Production Hardening (circuit breaker, bulkhead, health)
- [ ] Full Playwright Browser Automation
- [ ] Voice Interface (STT + TTS)
- [ ] Plugin Marketplace
- [ ] Enterprise SSO + LDAP
- [ ] Mobile App (React Native)

---

<div align="center">

**Built with obsession by [Nabil Karem](https://github.com/Nabilkarem911)**

*Titan doesn't use frameworks. Titan IS the framework.*

</div>
