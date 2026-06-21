<div align="center">

# TITAN

### Universal Autonomous Agent Framework

**The Most Advanced Open-Source AI Agent System — Built From Scratch**

[![Live](https://img.shields.io/badge/Live-titan.orcanox.xyz-blue?style=for-the-badge)](https://titan.orcanox.xyz)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-63_passing-success?style=for-the-badge)](.)
[![Node](https://img.shields.io/badge/Node-22+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-AGPL--3.0-blue?style=for-the-badge)](LICENSE)
[![Super-Agent](https://img.shields.io/badge/Super--Agent-12_Capabilities-purple?style=for-the-badge)](TITAN_SUPER_AGENT_V2_PROPOSAL.md)

*Zero LangChain. Zero CrewAI. Zero AutoGen. 100% custom.*

</div>

---

## What is Titan?

Titan is a **complete AI operating system** — not a chatbot wrapper, not a thin API layer, but a full autonomous agent framework that can understand codebases, execute multi-step tasks, learn from experience, and communicate across channels.

What makes Titan different? **It thinks about its own thinking, writes its own tools, improves its own code, and collaborates with other agents in real-time.**

```bash
titan chat "deploy the latest version to production"
titan run "analyze this codebase and fix all bugs"
titan                # Interactive REPL mode
```

---

## Super-Agent Capabilities

Titan isn't just an agent — it's a **Super-Agent**. 12 advanced capabilities built on top of cutting-edge 2026 AI research:

### Self-Improvement & Awareness

| Capability | What It Does | Example |
|-----------|--------------|---------|
| **Self-Forge** | Agent writes its own tools when it encounters a problem it doesn't have a tool for | "I need to convert a PDF to Excel" → Agent generates, validates, and registers a new `pdf-to-excel` tool automatically |
| **Meta-Agent** | Agent analyzes its own runs and proposes concrete improvements to prompts, strategies, and tool usage | After a failed run: "Strategy 'chain-of-thought' had 23% lower accuracy than 'tree-of-thought' for math tasks — switching recommendation" |
| **Metacognition** | Agent monitors its own reasoning confidence and flags when it's uncertain | "I'm 34% confident in this answer — I recommend verifying with a second approach" |
| **Introspective Awareness** | Agent inspects its own internal states and detects biases in its reasoning | "I notice I consistently overestimate success probability for bash tools — adjusting confidence calibration" |

### World Understanding

| Capability | What It Does | Example |
|-----------|--------------|---------|
| **World Model** | Agent builds an environment graph of entities, causal relations, and events; simulates outcomes before acting | Before running `rm -rf /tmp/old_builds`: simulates the action → predicts "safe, 0 affected services" → executes |
| **Code Architecture Awareness** | Agent understands the codebase as a dependency graph with impact analysis | "If you change `runner.ts`, 12 files are affected (high risk) — 3 direct dependents, 9 transitive" |
| **Hypothesis Testing** | Agent uses the scientific method to diagnose problems | Problem: "API returns 500" → Hypothesis 1: "DB connection pool exhausted" → Test: check pool stats → Result: confirmed → Fix applied |

### Autonomous Operation

| Capability | What It Does | Example |
|-----------|--------------|---------|
| **Autonomous Loop** | Agent runs 24/7 background monitoring with configurable health checks | Every 5 min: checks server health, DB connections, error rates → if anomaly detected → auto-diagnoses and proposes fix |
| **Goal Decomposition** | Agent breaks complex goals into sub-tasks with dependency tracking | "Build a REST API" → Plan: schema design → DB migration → route handlers → middleware → tests → docs (with dependencies) |
| **Curiosity Engine** | Agent proactively explores and acquires new skills when idle | Agent discovers it doesn't know Kubernetes → runs self-directed learning task → adds k8s-deploy skill to library |

### Learning & Collaboration

| Capability | What It Does | Example |
|-----------|--------------|---------|
| **Cross-User Learning** | Agent learns patterns from all users (anonymized, privacy-preserving) | "87% of users who phrase tasks as questions get better results with 'tree-of-thought' strategy" — applied to your next task |
| **Real-time Collaboration** | Multiple agents work together on the same problem in live sessions | Agent A (researcher): "Found 3 relevant papers" → Agent B (coder): "Implementing approach 2" → Agent C (reviewer): "Approach 2 has a race condition" → Agent B: fixes it |
| **Personality Cloning** | Agent adapts its communication style to match each user | User A (formal): "I'll analyze the architecture" → User B (casual): "lemme check how this thing works real quick" |

### Multimodal Understanding

| Capability | What It Does | Example |
|-----------|--------------|---------|
| **Multimodal** | Agent analyzes images and PDFs — extracts text, identifies objects, detects document types | Upload `invoice.pdf` → Agent: "This is an invoice for $4,200 from Acme Corp, due July 15, 2026 — 3 line items detected" |

---

## Installation

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| **Node.js** | 22+ | Runtime |
| **Docker** + **Docker Compose** | Latest | PostgreSQL, Redis, Embedding service |
| **Git** | Latest | Clone + version control |

### Method 1: Docker Compose (Production — Recommended)

Everything runs in containers. No local Node.js needed (except for CLI).

```bash
# 1. Clone
git clone https://github.com/Nabilkarem911/The-Titan.git
cd The-Titan

# 2. Configure environment
cp .env.example .env
# Edit .env with your settings:
#   LLM_API_KEY=sk-your-openai-key        (required)
#   LLM_MODEL=gpt-4o                       (or claude-sonnet-4-6, etc.)
#   JWT_SECRET=your-random-secret-here     (min 32 chars)
#   JWT_REFRESH_SECRET=another-secret      (min 32 chars)
#   ENCRYPTION_KEY=32-char-hex-key         (for encrypting secrets)
#   API_KEY_ENCRYPTION_KEY=32-char-key     (for API keys)

# 3. Start all services
docker compose up -d

# This starts:
#   - PostgreSQL 16 + pgvector  (port 55432)
#   - Redis 7.4                 (port 6379)
#   - Embedding service         (port 8100)
#   - Titan Core API            (port 3000)
#   - Titan Worker              (background queue processor)

# 4. Open dashboard
# http://localhost:3000

# 5. Check health
curl http://localhost:3000/api/v1/health/live

# 6. View logs
docker compose logs -f core
```

**Stopping:**
```bash
docker compose down          # Stop all services
docker compose down -v       # Stop + remove volumes (deletes data!)
```

---

### Method 2: Local Development

Run infrastructure in Docker, code locally with hot reload.

```bash
# 1. Clone and install
git clone https://github.com/Nabilkarem911/The-Titan.git
cd The-Titan
npm install --legacy-peer-deps

# 2. Start infrastructure only
docker compose up -d postgres redis embed

# 3. Configure
cp .env.example .env
# Edit .env — same keys as Method 1 above
# Make sure POSTGRES_HOST=localhost and REDIS_HOST=localhost

# 4. Run database migrations
npm run db:migrate

# 5. Build all packages
npm run build

# 6. Start the API server (with hot reload)
npm run dev:core
# Server runs on http://localhost:3000

# 7. Start the dashboard (separate terminal)
npm run dev:dashboard
# Dashboard runs on http://localhost:5173
# (proxies API requests to :3000 automatically)
```

**Useful dev commands:**
```bash
npm run test                 # Run all 1090 tests
npm run test:watch           # Watch mode
npm run test:coverage        # Coverage report
npm run lint                 # ESLint
npm run typecheck            # TypeScript check
npm run format               # Prettier
```

---

### Method 3: Titan CLI

Talk to Titan from your terminal — connects to a running server or works locally.

```bash
# 1. Build the CLI
cd The-Titan
npm install --legacy-peer-deps
npm run build               # Build all packages first

# 2. Link globally (one-time)
npm link -w apps/cli

# 3. Connect to your server
titan login --server https://your-titan-server.com --api-key tk_your_key_here
# OR
titan login --server http://localhost:3000 --email admin@example.com --password yourpassword

# 4. Start chatting
titan                        # Interactive REPL
titan chat "ازيك يا تايتن"   # Quick message
titan run "build REST API"   # Run agent task
titan status                 # Check server health
```

**CLI Commands:**
```bash
titan                        # Interactive REPL mode
titan chat <message>         # Send a message
titan chat                   # Enter chat mode (same as titan)
titan run <prompt>           # Run an agent task
  --agent <id>               #   Use specific agent profile
  --steps <n>                #   Max steps (default: 15)
titan status                 # Server health + project info
titan login                  # Authenticate
  --server <url>             #   Server URL
  --api-key <key>            #   API key auth
  --email <email>            #   Email + password auth
  --password <pass>
titan logout                 # Clear credentials
titan config list            # Show config
titan config set <key> <val> # Set config value
```

**REPL Commands (inside interactive mode):**
```
/help                        # Show commands
/status                      # Server health
/context                     # Current project info
/clear                       # Clear screen
/exit                        # Quit
```

---

### Method 4: Deploy on Dokploy / VPS

For production deployment on your own server.

```bash
# On your server:

# 1. Install Docker + Docker Compose
curl -fsSL https://get.docker.com | sh

# 2. Clone
git clone https://github.com/Nabilkarem911/The-Titan.git
cd The-Titan

# 3. Configure production .env
cp .env.example .env
nano .env
# Set all required variables:
#   NODE_ENV=production
#   LLM_API_KEY=sk-...
#   JWT_SECRET=<random 64 char string>
#   JWT_REFRESH_SECRET=<random 64 char string>
#   ENCRYPTION_KEY=<random 32 char hex>
#   API_KEY_ENCRYPTION_KEY=<random 32 char hex>
#   POSTGRES_PASSWORD=<strong password>
#   REDIS_PASSWORD=<strong password>
#   CORS_ORIGIN=https://your-domain.com

# 4. Build and start
docker compose up -d --build

# 5. Set up reverse proxy (Nginx/Caddy/Traefik)
# Point your domain to port 3000

# For Dokploy specifically:
# - Create a new application
# - Set build method: Dockerfile
# - Set Dockerfile path: apps/core/Dockerfile
# - Add environment variables in Dokploy UI
# - Set domain in Dokploy
# - Deploy
```

---

### Method 5: Using the SDK (Integrate Titan into your app)

```bash
npm install @titan/sdk    # Coming soon — for now, use from monorepo
```

```typescript
import { TitanClient } from '@titan/sdk';

// Initialize
const titan = new TitanClient({
  baseUrl: 'https://your-titan-server.com',
  apiKey: 'tk_your_api_key',
});

// Chat
const response = await titan.chat('What is TypeScript?');
console.log(response.message);

// Run agent
const run = await titan.runAgent({
  prompt: 'Analyze this PR for security issues',
  agentId: 'security-analyst',
});
console.log(run.finalAnswer);

// Stream response
for await (const event of titan.streamAgent({ prompt: 'Explain Docker' })) {
  if (event.type === 'token') process.stdout.write(event.data as string);
}

// Multi-agent swarm
const swarm = await titan.runSwarm({
  description: 'Full codebase audit',
  prompt: 'Audit for bugs, security issues, and performance problems',
});
console.log(swarm.finalAnswer);
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
| **Sub-Agent Spawning** | Spawn child agents in foreground/background with orchestration engine |

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
| **Smart Context** | Selects the most relevant code for LLM context |
| **Symbol Lookup** | Functions, classes, interfaces, types, enums — with line numbers |
| **Dependency Graph** | Import mapping — who depends on who |
| **Impact Analysis** | "If I change file X, how many files are affected?" — risk-level scoring |
| **Circular Dependency Detection** | DFS-based cycle detection across the codebase |

### Autonomous Execution
| Feature | Description |
|---------|-------------|
| **Plan-Execute-Verify Loop** | Plans task → writes code → runs typecheck → fixes errors → commits |
| **Auto-Fixer** | LLM-powered error fixing with rollback safety |
| **Git Operations** | Branch creation, staging, LLM-generated commit messages |
| **Resource Monitor** | CPU/memory tracking before execution |

### 90 Built-in Tools
| Category | Tools |
|----------|-------|
| **Execution** | bash, docker, file read/write/patch |
| **Web** | brave search, web scraping, HTTP, screenshot, SEO analysis, sitemap crawl, RSS feed, web monitor |
| **Data** | SQL, CSV transform, Excel, PDF, XML, JSON Schema, YAML convert, data visualization |
| **Documents** | PDF create, spreadsheet create, slide create, invoice generate, report generate, contract draft, document template |
| **Images** | image generate (DALL-E), image analyze (Vision), image edit |
| **Cloud** | AWS S3, Google Cloud Storage, Google Drive, Dropbox |
| **Project Management** | Notion, Linear, Jira, Trello, Asana |
| **Communication** | email, Slack, Discord, WhatsApp, SMS (Twilio), Telegram, push notifications |
| **AI** | text classify, text summarize, entity extract, embeddings generate, code analyze |
| **System** | system metrics, log search, database backup, cron manage, process manager, network diagnose |
| **Business** | invoice generate, budget tracker, contract draft, report generate |
| **Security** | hash, JWT decode, password generate, DNS lookup, IP lookup |

### Multi-Agent System
- **Agent Spawner** — spawn foreground/background child agents
- **Agent Pool** — concurrency-limited execution with priority queue
- **Dynamic Factory** — LLM designs agents on-the-fly from capability specs
- **Orchestration Engine** — auto-decompose → parallel execute → aggregate results
- **Team Templates** — dev, research, ops, content teams with specialized roles
- **Meeting Protocol** — multi-round agent discussions with synthesis
- **Peer Review** — structured code/content review with scoring
- **Voting System** — weighted confidence-based decisions
- **Collaboration Sessions** — live multi-agent sessions with real-time messaging

### Web Dashboard (43 Pages)
**Core:** Chat, Agents, Playground, Swarm, Workflow Designer, Terminal, Editor, Files, Git, Projects, Templates, Teams, Settings, Getting Started, Login
**Operations:** Run History, Queues, Metrics, Cron, Logs, Webhooks, Audit Logs, System Health
**Analytics:** Analytics, Cost Dashboard, Trace Viewer, Agent Performance, Model Comparison, Tool Stats
**Advanced:** Knowledge Base, User Profile, Integration Hub, Marketplace, Learning Dashboard, Error Explorer, Notification Center, Workspace Insights
**Docs:** API Docs, 404 Page

---

## Super-Agent API Endpoints

All Super-Agent capabilities are exposed via REST API:

### Self-Forge
```bash
POST /api/v1/self-forge/forge     # Generate a new tool
GET  /api/v1/self-forge/tools     # List forged tools
DEL  /api/v1/self-forge/tools/:id # Remove a forged tool
```

### Autonomous Loop
```bash
GET  /api/v1/autonomous-loop/status     # Check loop status
POST /api/v1/autonomous-loop/start      # Start the loop
POST /api/v1/autonomous-loop/stop       # Stop the loop
POST /api/v1/autonomous-loop/trigger    # Manual trigger
GET  /api/v1/autonomous-loop/results    # Get results history
```

### Hypothesis Testing
```bash
POST /api/v1/hypothesis/generate        # Generate hypotheses for a problem
POST /api/v1/hypothesis/evaluate        # Evaluate test results
GET  /api/v1/hypothesis/history         # Get hypothesis history
```

### Code Architecture
```bash
POST /api/v1/architecture/index         # Index a file or directory
GET  /api/v1/architecture/impact        # Analyze impact of changing a file
GET  /api/v1/architecture/dependencies  # Get dependencies of a file
GET  /api/v1/architecture/stats         # Get graph statistics
GET  /api/v1/architecture/cycles        # Find circular dependencies
GET  /api/v1/architecture/files         # List all indexed files
```

### Cross-User Learning
```bash
GET  /api/v1/cross-user/insights        # Get aggregated insights
GET  /api/v1/cross-user/patterns        # Get top patterns
GET  /api/v1/cross-user/recommendations # Get recommendations
GET  /api/v1/cross-user/stats           # Get aggregate stats
POST /api/v1/cross-user/record          # Record a pattern
```

### Collaboration
```bash
POST /api/v1/collaboration/sessions              # Create a session
GET  /api/v1/collaboration/sessions              # List active sessions
GET  /api/v1/collaboration/sessions/:id          # Get session details
POST /api/v1/collaboration/sessions/:id/join     # Join a session
POST /api/v1/collaboration/sessions/:id/messages # Post a message
GET  /api/v1/collaboration/sessions/:id/messages # Get messages
POST /api/v1/collaboration/sessions/:id/complete # Complete with consensus
GET  /api/v1/collaboration/stats                  # Global stats
```

### Multimodal
```bash
POST /api/v1/multimodal/analyze    # Analyze an image or PDF
GET  /api/v1/multimodal/formats    # Get supported formats
```

### Sandbox
```bash
GET  /api/v1/sandbox/stats         # Pool statistics
POST /api/v1/sandbox/execute       # Execute command in sandbox
POST /api/v1/sandbox/warm          # Warm the pool
POST /api/v1/sandbox/shutdown      # Shutdown the pool
```

### Insights
```bash
GET  /api/v1/insights/overview      # Observability overview
GET  /api/v1/insights/experiences   # Experience insights
GET  /api/v1/insights/strategies    # Strategy insights
GET  /api/v1/insights/prompts       # Prompt insights
GET  /api/v1/insights/preferences   # User preferences
GET  /api/v1/insights/knowledge     # Knowledge graph
POST /api/v1/insights/feedback      # Record feedback
```

---

## Architecture

```
titan/
├── apps/
│   ├── core/                # Fastify API server (120+ endpoints)
│   ├── dashboard/           # React 18 + Vite + Tailwind (43 pages)
│   └── cli/                 # Terminal interface (REPL + commands)
├── packages/
│   ├── agent-engine/        # The brain (20+ modules)
│   │   ├── self-forge/      #   Agent writes its own tools
│   │   ├── metacognition/   #   Agent monitors its own thinking
│   │   ├── world-model/     #   Environment graph + action simulator
│   │   ├── reasoning/       #   Hypothesis testing (scientific method)
│   │   ├── collaboration/   #   Real-time multi-agent sessions
│   │   ├── multimodal/      #   Image + PDF understanding
│   │   ├── learning/        #   Experience, prompts, strategies, cross-user
│   │   ├── code-intel/      #   Codebase indexing + dependency graph
│   │   ├── swarm/           #   Multi-agent orchestration
│   │   └── ...              #   Planning, memory, personality, voice, teams
│   ├── memory/              # The memory (6 modules)
│   ├── tools/               # The hands (90 tools + MCP + composition + browser + marketplace)
│   ├── sdk/                 # TypeScript SDK
│   ├── shared/              # Types, errors, resilience, security, compliance
│   ├── auth/                # JWT, RBAC, API keys, encryption, SSO, quotas
│   ├── database/            # PostgreSQL + pgvector + 25 migrations
│   ├── queue/               # BullMQ (9 priority queues)
│   ├── websocket/           # JSON-RPC 2.0 real-time
│   ├── observability/       # Metrics, rate limiting, eval, tracing, cost
│   ├── logging/             # Pino structured logging
│   ├── config/              # Zod env validation (60+ vars)
│   ├── sandbox/             # Docker container pool
│   └── telemetry/           # OpenTelemetry
├── services/
│   └── embed/               # Self-hosted embeddings (BGE-small-en-v1.5)
└── docker/                  # PostgreSQL + Redis configs
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
- **Input Sanitization** — XSS, SQL injection, command injection, SSRF prevention
- **PII Detection** — auto-detect and redact emails, phones, SSNs, API keys
- **Anomaly Detection** — burst requests, failed auth, suspicious patterns
- **Secret Rotation** — expiry tracking, auto-rotate, key generation
- **Session Monitor** — concurrent limits, device fingerprinting
- **Circuit Breaker** — prevents cascade failures
- **Bulkhead** — isolates concurrent operations
- **GDPR Toolkit** — data export, deletion requests, consent management
- **File Validation** — extension, MIME, size, path traversal checks

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
**Emotion detection** — detects frustration, excitement, confusion and adjusts tone.
**Safety-first** — destructive operations require confirmation.

---

## Usage Examples

### Example 1: Self-Forge — Agent Creates a Missing Tool

```bash
# User asks Titan to do something it doesn't have a tool for
titan chat "Convert this CSV to a Parquet file"

# Titan recognizes it doesn't have a csv-to-parquet tool
# Self-Forge kicks in:
# 1. Generates TypeScript tool code
# 2. Validates it (static analysis + sandbox test)
# 3. Registers it in the tool registry
# 4. Executes it

# Response: "I didn't have a CSV-to-Parquet converter, so I built one.
# Your file has been converted. The tool is now available for future use."
```

### Example 2: Hypothesis Testing — Scientific Debugging

```bash
# API returns 500 errors
titan run "The /api/v1/orders endpoint returns 500 errors, fix it"

# Titan generates hypotheses:
# H1: "Database connection pool exhausted" (confidence: 78)
#     Test: check pool stats → Result: pool at 100% → CONFIRMED
# H2: "Missing required field in request body" (confidence: 45)
#     Test: check recent schema changes → Result: no changes → REFUTED
# H3: "Redis cache corruption" (confidence: 30)
#     Test: flush cache + retry → Result: still 500 → REFUTED

# Conclusion: H1 confirmed — connection pool exhausted
# Fix: increase pool size + add connection timeout
```

### Example 3: Code Architecture Awareness

```bash
# Before making changes
titan chat "I want to refactor the runner.ts file, is it safe?"

# Titan analyzes the dependency graph:
# "runner.ts has 12 dependents (HIGH RISK):
#   Direct: index.ts, runner.test.ts, create-runner.ts
#   Transitive: server.ts, 9 other files
#   Affected symbols: AgentRunner, AgentRunnerDeps, executeStep
#   No circular dependencies detected
# Recommendation: proceed with caution, run tests after changes"
```

### Example 4: Real-time Collaboration

```bash
# Start a collaboration session for a complex problem
curl -X POST http://localhost:3000/api/v1/collaboration/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"topic": "Design authentication system", "description": "Need JWT + OAuth + API keys"}'

# Agents join:
# Agent A (architect): "I propose JWT + refresh tokens + API key system"
# Agent B (security): "Need to add rate limiting + abuse detection"
# Agent C (implementer): "I'll start coding the JWT module"
# Agent B (reviewer): "The refresh token rotation has a race condition"
# Agent C: "Fixed — added database-level locking"
# Consensus: "JWT + refresh rotation + API keys + rate limiting — implementation complete"
```

### Example 5: Multimodal Analysis

```bash
# Analyze an image
curl -X POST http://localhost:3000/api/v1/multimodal/analyze \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"filePath": "/uploads/architecture-diagram.png"}'

# Response:
# {
#   "type": "image",
#   "analysis": {
#     "description": "A microservices architecture diagram showing 8 services...",
#     "analysisType": "diagram",
#     "extractedText": "API Gateway → Auth Service → User DB",
#     "objects": ["API Gateway", "Auth Service", "Database", "Cache"],
#     "confidence": 82
#   }
# }
```

### Example 6: Cross-User Learning

```bash
# Titan learns from all users (anonymized)
curl http://localhost:3000/api/v1/cross-user/insights \
  -H "Authorization: Bearer $TOKEN"

# Response:
# {
#   "insights": [
#     {
#       "insight": "Using 'tree-of-thought' strategy for debugging tasks improves success by 34%",
#       "confidence": 87,
#       "basedOnUsers": 142,
#       "basedOnRuns": 1240
#     },
#     {
#       "insight": "Breaking down tasks into 3-5 sub-tasks yields best results",
#       "confidence": 91,
#       "basedOnUsers": 203,
#       "basedOnRuns": 3100
#     }
#   ]
# }
```

---

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `LLM_API_KEY` | Your LLM API key | **Yes** | — |
| `LLM_PROVIDER_TYPE` | `openai-compatible` or `anthropic` | No | `openai-compatible` |
| `LLM_MODEL` | Model name | No | `gpt-4o` |
| `LLM_BASE_URL` | API base URL | No | `https://api.openai.com/v1` |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | **Yes** | — |
| `JWT_REFRESH_SECRET` | Refresh token secret | **Yes** | — |
| `ENCRYPTION_KEY` | AES encryption key | **Yes** | — |
| `API_KEY_ENCRYPTION_KEY` | API key encryption | **Yes** | — |
| `POSTGRES_HOST` | PostgreSQL host | No | `localhost` |
| `POSTGRES_PORT` | PostgreSQL port | No | `55432` |
| `POSTGRES_DB` | Database name | No | `titan` |
| `POSTGRES_USER` | Database user | No | `titan` |
| `POSTGRES_PASSWORD` | Database password | **Yes** (prod) | `titan_dev_password...` |
| `REDIS_HOST` | Redis host | No | `localhost` |
| `REDIS_PORT` | Redis port | No | `6379` |
| `REDIS_PASSWORD` | Redis password | **Yes** (prod) | `titan_dev_redis...` |
| `EMBEDDING_BASE_URL` | Embedding service URL | No | `http://localhost:8100/v1` |
| `EMBEDDING_DIMENSIONS` | Embedding vector size | No | `384` |
| `HTTP_PORT` | API server port | No | `3000` |
| `CORS_ORIGIN` | Allowed CORS origins | No | `*` |
| `NODE_ENV` | Environment | No | `development` |
| `AUTONOMOUS_LOOP_ENABLED` | Auto-start autonomous loop | No | `false` |

See `packages/config/src/index.ts` for all 60+ configurable variables.

---

## Stats

| Metric | Value |
|--------|-------|
| Total Source Files | 550+ |
| Lines of Code | ~75,000 |
| Test Files | 65+ |
| Tests Passing | 63+ (core suites) |
| Packages | 16 |
| API Endpoints | 120+ |
| Built-in Tools | 90 |
| Dashboard Pages | 43 |
| Database Migrations | 25 |
| Agent Profiles | 30 |
| Queue Types | 9 |
| Super-Agent Capabilities | 12 |
| Agent-Engine Modules | 20+ |

---

## Roadmap

### Completed — Core System
- [x] Agent Intelligence (planning, reflection, multi-strategy)
- [x] Advanced Memory (6 layers + knowledge graph + RAG)
- [x] Swarm Orchestration + Workflow Engine
- [x] Sub-Agent Spawner + Dynamic Factory + Orchestration Engine
- [x] MCP Protocol Support (client + server)
- [x] Tool Composition (pipelines, parallel, macros)
- [x] 90 Built-in Tools (documents, images, cloud, PM, comms, AI, system, business)
- [x] Evaluation Framework + Cost Tracking + Full Tracing
- [x] TypeScript SDK + Streaming
- [x] CLI Interface (REPL + commands + project detection)
- [x] Code Intelligence (indexer, search, smart context, symbol extraction)
- [x] Autonomous Execution (plan→execute→verify→fix→commit loop)
- [x] Persistent Identity + User Profiles + Preference Learning
- [x] Browser Agent (web browsing, forms, sessions, page analysis)
- [x] Document RAG (chunking, citations, knowledge base, hybrid pipeline)
- [x] Multi-Agent Teams (meetings, peer review, voting)
- [x] Self-Learning (experience collection, prompt optimization, strategy tuning)
- [x] Adaptive Multilingual Personality (7 languages + emotion detection)
- [x] Channel Integrations (WhatsApp, Slack, Discord, Telegram, SMS)
- [x] Production Hardening (circuit breaker, bulkhead, health aggregation)
- [x] Security (input sanitizer, PII detector, anomaly detector, GDPR, secret rotation)
- [x] Enterprise (SSO, usage quotas, file validation, session monitoring)
- [x] Plugin Marketplace (store, validator, version manager)
- [x] 43-Page Dashboard (analytics, traces, workflows, marketplace, learning, errors)
- [x] 30 Agent Profiles (PM, UX, Data Scientist, Legal, QA, DBA, Growth, and more)

### Completed — Super-Agent v1 (12 Capabilities)
- [x] **Self-Forge** — Agent writes, validates, and registers its own tools
- [x] **Meta-Agent** — Agent analyzes runs and proposes improvements
- [x] **Metacognition** — Agent monitors reasoning confidence and recommends actions
- [x] **World Model** — Environment graph + action outcome simulation
- [x] **Autonomous Loop** — 24/7 background monitoring with health checks
- [x] **Goal Decomposition** — Complex goals → sub-tasks with dependencies
- [x] **Hypothesis Testing** — Scientific method for problem diagnosis
- [x] **Code Architecture Awareness** — Dependency graph + impact analysis
- [x] **Multimodal** — Image + PDF understanding via vision models
- [x] **Cross-User Learning** — Privacy-preserving aggregated insights
- [x] **Personality Cloning** — Adaptive communication style per user
- [x] **Real-time Collaboration** — Live multi-agent sessions

### Planned — Super-Agent v2 (12 New Capabilities)
- [ ] **Dream Mode** — Background memory consolidation (OpenAI Dreaming V3 inspired)
- [ ] **Causal Replay** — Which step caused failure? (CAR inspired)
- [ ] **Recursive Self-Rewrite** — Agent rewrites its own logic at runtime (Gödel Agent inspired)
- [ ] **Evolutionary Solver** — Population-based solution evolution (AgentGA inspired)
- [ ] **Self-Healing Debugger** — Multi-agent debugging with historical lessons
- [ ] **Introspective Awareness** — Agent inspects its own internal states
- [ ] **Curiosity Engine** — Proactive skill acquisition without external requests
- [ ] **Emotional Intelligence** — IQ-EQ co-reasoning with empathy modeling
- [ ] **Neuro-Symbolic Reasoning** — Logic over knowledge graph
- [ ] **Dynamic Tool Discovery** — Find tools from external registries (MCP)
- [ ] **Thought Auditor** — Real-time chain-of-thought safety auditing
- [ ] **Memory Folding** — Compress long interactions to prevent context overflow

### Planned — Platform
- [ ] Full Playwright Browser Automation
- [ ] Production Voice Interface (STT + TTS)
- [ ] Mobile App (React Native)

See [TITAN_SUPER_AGENT_V2_PROPOSAL.md](TITAN_SUPER_AGENT_V2_PROPOSAL.md) for detailed specs.

---

<div align="center">

**Built with obsession by [Nabil Karem](https://github.com/Nabilkarem911)**

*Titan doesn't use frameworks. Titan IS the framework.*

</div>
