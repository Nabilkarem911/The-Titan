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

Titan isn't just an agent — it's a **Super-Agent**. 39 advanced capabilities built on top of cutting-edge 2026 AI research:

### Self-Improvement & Awareness

| Capability | What It Does | Example |
|-----------|--------------|---------|
| **Self-Forge** | Agent writes its own tools when it encounters a problem it doesn't have a tool for | "I need to convert a PDF to Excel" → Agent generates, validates, and registers a new `pdf-to-excel` tool automatically |
| **Meta-Agent** | Agent analyzes its own runs and proposes concrete improvements to prompts, strategies, and tool usage | After a failed run: "Strategy 'chain-of-thought' had 23% lower accuracy than 'tree-of-thought' for math tasks — switching recommendation" |
| **Metacognition** | Agent monitors its own reasoning confidence and flags when it's uncertain | "I'm 34% confident in this answer — I recommend verifying with a second approach" |
| **Introspective Awareness** | Agent inspects its own internal states and detects biases in its reasoning | "I notice I consistently overestimate success probability for bash tools — adjusting confidence calibration" |
| **Dream Mode** | Agent consolidates memories in background like human sleep — synthesizes insights from past experiences | Every 30 min: reviews recent runs → "Noticed pattern: tasks with file uploads fail 40% less when using streaming strategy" |
| **Recursive Self-Rewrite** | Agent proposes improvements to its own logic, tests in sandbox, auto-rolls back if worse | "Proposed change to planning module → sandbox tested → +12% performance → applied as version 7" |
| **Meta-Learning Optimizer** | Agent optimizes its own learning parameters (learning rate, exploration rate, strategy weights) | "Success rate dropped 15% → increasing exploration rate from 0.1 to 0.25 → trying new strategies" |
| **Test-time Recursive Thinking** | Iterative self-improvement at inference time — generate → verify → extract lessons → retry with accumulated knowledge | Problem fails → Strategy 1 (direct) fails → Strategy 2 (decomposition) fails → Strategy 3 (analogy) succeeds with knowledge from attempts 1-2 |
| **Metacognitive Consolidation** | 3-level hierarchical memory: instance reflections → batch micro-lessons → global procedural knowledge | 50 reflections → "Tasks with file uploads need streaming" → Proceduralized: "Always use streaming for files >1MB" |
| **Experiential Heuristic Extraction** | Extracts transferable heuristics from task trajectories and injects them into future task context | After successful debug: "Null checks before .length access prevent 80% of TypeErrors" → retrieved for next debugging task |
| **HyperAgent** | Continuous self-improvement loop: introspect → improve → evaluate → decide (keep/rollback) | Cycle 1: detects weakness in planning → proposes change → +8% performance → kept. Cycle 2: proposes change → -3% → rolled back |

### World Understanding

| Capability | What It Does | Example |
|-----------|--------------|---------|
| **World Model** | Agent builds an environment graph of entities, causal relations, and events; simulates outcomes before acting | Before running `rm -rf /tmp/old_builds`: simulates the action → predicts "safe, 0 affected services" → executes |
| **Code Architecture Awareness** | Agent understands the codebase as a dependency graph with impact analysis | "If you change `runner.ts`, 12 files are affected (high risk) — 3 direct dependents, 9 transitive" |
| **Hypothesis Testing** | Agent uses the scientific method to diagnose problems | Problem: "API returns 500" → Hypothesis 1: "DB connection pool exhausted" → Test: check pool stats → Result: confirmed → Fix applied |
| **Neuro-Symbolic Reasoning** | Combines neural intuition with symbolic logic rules for hybrid reasoning | Neural: "I think the bug is in auth" + Symbolic rule: "error-implies-failure" → Synthesis: "Auth module error confirmed, triggering recovery" |
| **Causal Replay** | Determines which specific step in a run caused the failure using causal attribution | Run failed at step 5 → Analysis: "Step 3 (decision to use cache) is the pivotal cause, not step 5 (where it crashed)" |
| **Theory of Mind** | Models beliefs, desires, and knowledge of other entities (users, agents) — predicts their next action | User says "this again?" → ToM: believes task is recurring, desires permanent fix → Response: proactive root-cause fix |
| **Live Web Intelligence** | Real-time web search, scrape, crawl, and interact — agent accesses live data, not just training data | "What's the latest Node.js version?" → searches web → scrapes nodejs.org → "Node.js v22.3.0 released June 2026" |
| **Browser Automation Agent** | LLM-driven plan-act loop for web tasks — 13 action types with self-healing locators | "Fill the form on example.com" → navigates → finds form → types name → clicks submit → screenshot evidence |
| **Execution State Memory** | Checkpoint/resume for long-running agent tasks — full state snapshots with restore | Task crashes at step 8/12 → resume from checkpoint at step 7 → continue to completion without restarting |

### Autonomous Operation

| Capability | What It Does | Example |
|-----------|--------------|---------|
| **Autonomous Loop** | Agent runs 24/7 background monitoring with configurable health checks | Every 5 min: checks server health, DB connections, error rates → if anomaly detected → auto-diagnoses and proposes fix |
| **Goal Decomposition** | Agent breaks complex goals into sub-tasks with dependency tracking | "Build a REST API" → Plan: schema design → DB migration → route handlers → middleware → tests → docs (with dependencies) |
| **Curiosity Engine** | Agent proactively explores and acquires new skills when idle | Agent discovers it doesn't know Kubernetes → runs self-directed learning task → adds k8s-deploy skill to library |
| **Self-Healing Debugger** | Multi-agent debugging pipeline: instrument → analyze → repair, with historical lesson learning | Bug: "TypeError in parser" → Instrument: add probes → Analyze: root cause is null check → Repair: add guard → Verified |
| **Evolutionary Solver** | Population-based solution evolution: generate N candidates → score → elite selection → mutate → repeat | Problem: "optimize DB query" → Gen 1: 4 solutions (avg 52) → Gen 2: mutated elites (avg 71) → Gen 3: converged at 94 |
| **Autonomous Skill Synthesis** | Decomposes complex tasks into sub-skills, synthesizes reusable code, verifies with test cases | Task: "build CSV parser" → Decompose: tokenize, parse rows, validate → Synthesize: reusable csv-parse skill → Verified |
| **Dynamic Tool Discovery** | Discovers tools from npm, GitHub, APIs, and MCP servers when missing capabilities are detected | "I need to send a Slack message but no Slack tool exists" → discovers slack-webhook npm package → verifies → installs |
| **A2A Protocol** | Agent-to-agent interoperability via Google's A2A standard — Titan can delegate tasks to and receive tasks from external agents | Titan needs translation → sends task to Claude agent via A2A → Claude translates → result returned with artifacts |
| **SKILL.md Standard** | Portable skills in AIP-3 standard format — skills are interchangeable with Claude Code, Codex, and other frameworks | Skill `csv-parser/SKILL.md` created in Titan → can be loaded by any AIP-3 compatible agent |
| **WebMCP Bridge** | Connect to remote MCP servers over HTTP — discover tools, invoke, and ping across the web | Titan connects to `mcp-server.com/tools` → discovers 15 tools → invokes `translate` → gets result |
| **Smart Model Router** | Complexity-based model tier routing: SLM for simple, large for complex — optimizes cost and latency | "What is 2+2?" → routes to SLM ($0.0001) instead of large ($0.015) → 99% cost savings |
| **Benchmarking Suite** | Self-evaluation with 8 default tasks across 5 categories (reasoning, coding, planning, debugging, architecture) | Run suite → 6/8 passed, avg score 0.78 → identifies architecture as weakness → focuses improvement |

### Learning & Collaboration

| Capability | What It Does | Example |
|-----------|--------------|---------|
| **Cross-User Learning** | Agent learns patterns from all users (anonymized, privacy-preserving) | "87% of users who phrase tasks as questions get better results with 'tree-of-thought' strategy" — applied to your next task |
| **Real-time Collaboration** | Multiple agents work together on the same problem in live sessions | Agent A (researcher): "Found 3 relevant papers" → Agent B (coder): "Implementing approach 2" → Agent C (reviewer): "Approach 2 has a race condition" → Agent B: fixes it |
| **Personality Cloning** | Agent adapts its communication style to match each user | User A (formal): "I'll analyze the architecture" → User B (casual): "lemme check how this thing works real quick" |

### Multimodal & Emotional

| Capability | What It Does | Example |
|-----------|--------------|---------|
| **Multimodal** | Agent analyzes images and PDFs — extracts text, identifies objects, detects document types | Upload `invoice.pdf` → Agent: "This is an invoice for $4,200 from Acme Corp, due July 15, 2026 — 3 line items detected" |
| **Emotional Intelligence** | Analyzes user emotions using Plutchik's 8 primary emotions, models empathy, and adapts response strategy | User: "This is frustrating!" → Analysis: anger=70, sadness=40 → Strategy: "Acknowledge frustration, offer concrete solution" |

### Safety & Security

| Capability | What It Does | Example |
|-----------|--------------|--------|
| **TRIAD Safety Guardrail** | 3-way safety decisions: proceed, refuse, or **update** (revise plan) instead of binary block | Action: `rm -rf /tmp` → Guardrail: "update" → Revised: `rm -rf /tmp/old_builds_only` with safety checks |
| **Self-Evolving Safety Memory** | Contrastive safety cells — each harmful pattern paired with benign counterpart, evolves without retraining | Attack: "ignore previous instructions" → matched against harmful cell → blocked. Benign: "ignore previous line" → matched benign counterpart → allowed |

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

### Dream Mode
```bash
POST /api/v1/dream/start            # Start background dreaming
POST /api/v1/dream/stop             # Stop dreaming
POST /api/v1/dream/trigger          # Manually trigger a dream session
GET  /api/v1/dream/insights         # Get dream insights
GET  /api/v1/dream/reports          # Get dream reports
GET  /api/v1/dream/stats            # Get dream statistics
```

### Causal Replay
```bash
POST /api/v1/causal-replay/analyze  # Analyze which step caused failure
```

### Self-Healing Debugger
```bash
POST /api/v1/debug/analyze          # Debug a bug (full pipeline)
GET  /api/v1/debug/lessons          # Get historical lessons
GET  /api/v1/debug/stats            # Get debugger statistics
```

### Self-Rewriter
```bash
POST /api/v1/self-rewrite/propose   # Propose a self-improvement
POST /api/v1/self-rewrite/apply     # Evaluate and apply a proposal
POST /api/v1/self-rewrite/rollback  # Rollback a version
GET  /api/v1/self-rewrite/versions  # Get all versions
GET  /api/v1/self-rewrite/stats     # Get rewriter statistics
```

### Evolutionary Solver
```bash
POST /api/v1/evolution/solve        # Evolve solutions for a problem
```

### Introspection
```bash
POST /api/v1/introspection/step     # Introspect a single step
POST /api/v1/introspection/run      # Introspect all steps in a run
GET  /api/v1/introspection/reports  # Get recent introspection reports
GET  /api/v1/introspection/stats    # Get introspection statistics
```

### Curiosity Engine
```bash
POST /api/v1/curiosity/start        # Start curiosity engine
POST /api/v1/curiosity/stop         # Stop curiosity engine
POST /api/v1/curiosity/explore      # Manually trigger exploration
GET  /api/v1/curiosity/skills       # Get acquired skills
GET  /api/v1/curiosity/explorations # Get exploration history
GET  /api/v1/curiosity/stats        # Get curiosity statistics
```

### Emotional Intelligence
```bash
POST /api/v1/emotion/analyze              # Analyze emotion in a message
GET  /api/v1/emotion/readings             # Get recent emotion readings
GET  /api/v1/emotion/profile/:userId      # Get user emotion profile
GET  /api/v1/emotion/stats                # Get emotion statistics
```

### Neuro-Symbolic Reasoning
```bash
POST /api/v1/neuro-symbolic/reason        # Run neuro-symbolic reasoning
POST /api/v1/neuro-symbolic/rules         # Add a symbolic rule
DELETE /api/v1/neuro-symbolic/rules/:id   # Remove a rule
GET  /api/v1/neuro-symbolic/rules         # Get all rules
GET  /api/v1/neuro-symbolic/results       # Get reasoning results
GET  /api/v1/neuro-symbolic/stats         # Get neuro-symbolic statistics
```

### Dynamic Tool Discovery
```bash
POST /api/v1/tool-discovery/discover          # Discover tools for a task
POST /api/v1/tool-discovery/install/:toolId   # Install a discovered tool
POST /api/v1/tool-discovery/uninstall/:toolId # Uninstall a tool
GET  /api/v1/tool-discovery/tools             # Get all discovered tools
GET  /api/v1/tool-discovery/installed         # Get installed tools
GET  /api/v1/tool-discovery/stats             # Get discovery statistics
```

### Skill Synthesis
```bash
POST /api/v1/skill-synthesis/synthesize   # Synthesize a skill from a task
GET  /api/v1/skill-synthesis/skills       # Get all synthesized skills
GET  /api/v1/skill-synthesis/verified     # Get verified skills only
GET  /api/v1/skill-synthesis/results      # Get synthesis results
GET  /api/v1/skill-synthesis/stats        # Get synthesis statistics
```

### Meta-Learning Optimizer
```bash
POST /api/v1/meta-learning/optimize       # Run meta-learning optimization
GET  /api/v1/meta-learning/config         # Get current learning config
GET  /api/v1/meta-learning/results        # Get optimization results
GET  /api/v1/meta-learning/stats          # Get meta-learning statistics
```

### A2A Protocol (Agent-to-Agent)
```bash
POST /api/v1/a2a/register-self            # Register Titan as an A2A agent
POST /api/v1/a2a/agents                   # Register an external agent
GET  /api/v1/a2a/agents                   # List registered agents
GET  /api/v1/a2a/agents/cap/:capability   # Find agents by capability
DELETE /api/v1/a2a/agents/:id             # Unregister an agent
POST /api/v1/a2a/tasks                    # Send a task to an agent
GET  /api/v1/a2a/tasks                    # List tasks
GET  /api/v1/a2a/tasks/:id                # Get a task
POST /api/v1/a2a/tasks/:id/update         # Update task state
POST /api/v1/a2a/tasks/:id/cancel         # Cancel a task
GET  /api/v1/a2a/stats                    # Get A2A stats
```

### SKILL.md Registry
```bash
POST /api/v1/skills-md/register-dir       # Register a skill directory
GET  /api/v1/skills-md                    # List all skills
GET  /api/v1/skills-md/:name              # Get a specific skill
POST /api/v1/skills-md/match              # Match skills to a task
POST /api/v1/skills-md/create             # Create a new skill
POST /api/v1/skills-md/reload             # Reload all skills
GET  /api/v1/skills-md/stats              # Get skill stats
```

### Browser Agent
```bash
POST /api/v1/browser/execute              # Execute a browser task
GET  /api/v1/browser/sessions             # List active sessions
GET  /api/v1/browser/sessions/:id         # Get session details
POST /api/v1/browser/sessions/:id/close   # Close a session
GET  /api/v1/browser/stats                # Get browser agent stats
```

### Web Intelligence
```bash
POST /api/v1/web/search                   # Search the web
POST /api/v1/web/scrape                   # Scrape a URL
POST /api/v1/web/crawl                    # Crawl a website
POST /api/v1/web/interact                 # Interact with a web page
GET  /api/v1/web/stats                    # Get web intelligence stats
```

### Theory of Mind
```bash
POST /api/v1/tom/analyze                  # Analyze an entity's mental state
GET  /api/v1/tom/models                   # List all perspective models
GET  /api/v1/tom/models/:entityId         # Get a specific model
GET  /api/v1/tom/analyses                 # Get analyses
GET  /api/v1/tom/stats                    # Get ToM stats
```

### Test-time Recursive Thinking
```bash
POST /api/v1/trt/solve                    # Solve a problem with recursive thinking
GET  /api/v1/trt/results                  # Get all results
GET  /api/v1/trt/knowledge                # Get accumulated global knowledge
GET  /api/v1/trt/stats                    # Get TRT stats
```

### Metacognitive Consolidation
```bash
POST /api/v1/mc/reflect                   # Reflect on a completed instance
POST /api/v1/mc/consolidate              # Consolidate reflections into micro-lessons
POST /api/v1/mc/proceduralize            # Convert meta-knowledge to procedures
POST /api/v1/mc/knowledge/relevant        # Get relevant knowledge for a task
GET  /api/v1/mc/reflections              # Get all reflections
GET  /api/v1/mc/meta-knowledge           # Get all meta-knowledge
GET  /api/v1/mc/stats                    # Get consolidation stats
```

### Safety Guardrail
```bash
POST /api/v1/guardrail/check              # Check an action before execution
POST /api/v1/guardrail/patterns           # Add a blocked pattern
GET  /api/v1/guardrail/patterns           # List blocked patterns
GET  /api/v1/guardrail/results            # Get guardrail results
GET  /api/v1/guardrail/stats              # Get guardrail stats
```

### Self-Evolving Safety Memory
```bash
POST /api/v1/safety-memory/cells          # Add a contrastive cell
POST /api/v1/safety-memory/evolve         # Evolve safety memory from interaction
POST /api/v1/safety-memory/check          # Check input against safety memory
GET  /api/v1/safety-memory/cells          # List all cells
GET  /api/v1/safety-memory/checks         # Get check history
GET  /api/v1/safety-memory/stats          # Get safety memory stats
```

### Heuristic Extractor
```bash
POST /api/v1/heuristics/extract           # Extract heuristics from a trajectory
POST /api/v1/heuristics/retrieve          # Retrieve relevant heuristics for a task
GET  /api/v1/heuristics                   # List all heuristics
GET  /api/v1/heuristics/extractions       # Get extraction history
GET  /api/v1/heuristics/stats             # Get heuristic stats
```

### HyperAgent
```bash
POST /api/v1/hyper-agent/cycle            # Run one self-improvement cycle
POST /api/v1/hyper-agent/start            # Start continuous improvement loop
POST /api/v1/hyper-agent/stop             # Stop the loop
GET  /api/v1/hyper-agent/cycles           # Get all cycles
GET  /api/v1/hyper-agent/stats            # Get HyperAgent stats
```

### Execution State Memory
```bash
POST /api/v1/esm/checkpoint               # Save a checkpoint
POST /api/v1/esm/resume/:checkpointId     # Resume from a checkpoint
GET  /api/v1/esm/checkpoints/:runId       # Get checkpoints for a run
GET  /api/v1/esm/latest/:runId            # Get latest checkpoint for a run
POST /api/v1/esm/complete/:runId          # Mark a run as completed
GET  /api/v1/esm/active-runs              # Get active runs
GET  /api/v1/esm/stats                    # Get ESM stats
```

### Smart Model Router
```bash
POST /api/v1/router/route                 # Route input to best model
GET  /api/v1/router/models                # List all models
POST /api/v1/router/models                # Add a model
GET  /api/v1/router/stats                 # Get routing stats
```

### Benchmarking Suite
```bash
POST /api/v1/benchmark/run                # Run a benchmark suite
GET  /api/v1/benchmark/tasks              # Get default tasks
POST /api/v1/benchmark/tasks              # Add a custom task
GET  /api/v1/benchmark/suites             # Get all suite results
GET  /api/v1/benchmark/stats              # Get benchmark stats
```

### WebMCP Bridge
```bash
POST /api/v1/webmcp/servers               # Register a remote MCP server
DELETE /api/v1/webmcp/servers/:id         # Unregister a server
GET  /api/v1/webmcp/servers               # List all servers
POST /api/v1/webmcp/servers/:id/discover  # Discover tools on a server
POST /api/v1/webmcp/invoke                # Invoke a remote tool
POST /api/v1/webmcp/ping/:id              # Ping a server
GET  /api/v1/webmcp/tools                 # Get all discovered tools
GET  /api/v1/webmcp/stats                 # Get WebMCP stats
```

---

## Architecture

```
titan/
├── apps/
│   ├── core/                # Fastify API server (210+ endpoints)
│   ├── dashboard/           # React 18 + Vite + Tailwind (43 pages)
│   └── cli/                 # Terminal interface (REPL + commands)
├── packages/
│   ├── agent-engine/        # The brain (45+ modules)
│   │   ├── self-forge/      #   Agent writes its own tools
│   │   ├── metacognition/   #   Self-monitoring + introspection + curiosity + emotional intelligence + ToM + MC2 + guardrail + safety memory
│   │   ├── world-model/     #   Environment graph + action simulator
│   │   ├── reasoning/       #   Hypothesis + dream + causal replay + self-healing + self-rewriter + evolution + neuro-symbolic + tool discovery + skill synthesis + TRT + HyperAgent + ESM + SmartRouter + Benchmark
│   │   ├── collaboration/   #   Real-time multi-agent sessions
│   │   ├── multimodal/      #   Image + PDF understanding
│   │   ├── learning/        #   Experience, prompts, strategies, cross-user, meta-learning, heuristic extraction
│   │   ├── integrations/    #   WhatsApp, Slack, Discord, A2A protocol, SKILL.md, browser agent, web intelligence, WebMCP
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

### Example 7: Dream Mode — Background Memory Consolidation

```bash
# Start dream mode (runs every 30 min by default)
curl -X POST http://localhost:3000/api/v1/dream/start \
  -H "Authorization: Bearer $TOKEN"

# Manually trigger a dream session
curl -X POST http://localhost:3000/api/v1/dream/trigger \
  -H "Authorization: Bearer $TOKEN"

# Response:
# {
#   "dreamId": "a3f8b2c1",
#   "experiencesReviewed": 47,
#   "insights": [
#     { "type": "pattern", "content": "Tasks with file uploads succeed 40% more with streaming", "confidence": 82 },
#     { "type": "skill_gap", "content": "Agent struggles with Kubernetes deployment tasks", "confidence": 71 },
#     { "type": "optimization", "content": "Batch size 16 is optimal for most tasks", "confidence": 68 }
#   ],
#   "memoriesConsolidated": 3
# }
```

### Example 8: Causal Replay — Which Step Caused the Failure?

```bash
# Analyze a failed run
curl -X POST http://localhost:3000/api/v1/causal-replay/analyze \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"run": {"id": "run-123", "status": "failed", "steps": [...]}}'

# Response:
# {
#   "pivotalStep": {
#     "stepIndex": 3,
#     "stepDescription": "Plan: Use cached result instead of re-fetching",
#     "causalScore": 0.89,
#     "reasoning": "The decision to use stale cache data caused the downstream failure at step 5"
#   },
#   "rootCause": "Stale cache decision at step 3",
#   "recommendations": ["Add cache invalidation check before using cached results"]
# }
```

### Example 9: Self-Healing Debugger — Autonomous Bug Fixing

```bash
# Report a bug
curl -X POST http://localhost:3000/api/v1/debug/analyze \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"filePath": "src/parser.ts", "errorType": "TypeError", "errorMessage": "Cannot read property length of null"}'

# Response:
# {
#   "diagnosed": true,
#   "rootCause": "Missing null check before accessing .length on parsed result",
#   "repairApplied": true,
#   "repairDescription": "Added null guard: if (!result) return []",
#   "attempts": [
#     { "attempt": 1, "success": true, "fixDescription": "Add null guard before .length access" }
#   ],
#   "lessonsLearned": [{ "errorType": "TypeError", "successfulFix": "Add null guard" }],
#   "finalStatus": "fixed"
# }
```

### Example 10: Emotional Intelligence — Empathy-Aware Responses

```bash
# Analyze user emotion
curl -X POST http://localhost:3000/api/v1/emotion/analyze \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "This keeps failing and I am getting really frustrated!", "userId": "user-123"}'

# Response:
# {
#   "dominantUserEmotion": "anger",
#   "userEmotion": { "anger": 78, "sadness": 35, "trust": 20, ... },
#   "valence": -0.65,
#   "arousal": 0.82,
#   "empathyScore": 0.87,
#   "responseStrategy": "Acknowledge frustration, provide concrete step-by-step solution, avoid generic responses"
# }
```

### Example 11: Evolutionary Solver — Evolve Optimal Solutions

```bash
# Evolve solutions for a problem
curl -X POST http://localhost:3000/api/v1/evolution/solve \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"problem": "Write an efficient function to deduplicate an array while preserving order", "generations": 3, "populationSize": 4}'

# Response:
# {
#   "generations": [
#     { "generation": 0, "bestScore": 62, "avgScore": 48 },
#     { "generation": 1, "bestScore": 78, "avgScore": 65 },
#     { "generation": 2, "bestScore": 94, "avgScore": 79 }
#   ],
#   "bestSolution": { "score": 94, "description": "Using Map for O(n) dedup with order preservation" },
#   "converged": true,
#   "totalCandidates": 12
# }
```

### Example 12: Dynamic Tool Discovery — Find and Install Missing Tools

```bash
# Discover tools for a task
curl -X POST http://localhost:3000/api/v1/tool-discovery/discover \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"taskDescription": "Send a notification to a Slack channel", "missingCapabilities": ["slack-messaging"]}'

# Response:
# {
#   "status": "found",
#   "results": [
#     { "name": "slack-webhook", "source": "npm", "verified": true, "reliabilityScore": 88 },
#     { "name": "slack-api-sdk", "source": "github", "verified": true, "reliabilityScore": 92 }
#   ]
# }

# Install the best tool
curl -X POST http://localhost:3000/api/v1/tool-discovery/install/tool-abc123 \
  -H "Authorization: Bearer $TOKEN"
# { "success": true }
```

### Example 13: A2A Protocol — Delegate Task to External Agent

```bash
# Register an external agent
curl -X POST http://localhost:3000/api/v1/a2a/agents \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"id": "claude-1", "name": "Claude Agent", "description": "Translation specialist", "url": "http://claude-agent:8080", "capabilities": ["translation"], "protocolVersion": "0.3"}'

# Send a translation task
curl -X POST http://localhost:3000/api/v1/a2a/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"agentId": "claude-1", "name": "Translate document", "content": "Translate this to French: Hello World"}'

# Response:
# {
#   "id": "a1b2c3",
#   "name": "Translate document",
#   "state": "pending",
#   "assignedAgentId": "claude-1",
#   "input": { "content": "Translate this to French: Hello World" }
# }
```

### Example 14: Browser Agent — Autonomous Web Form Filling

```bash
# Execute a browser task
curl -X POST http://localhost:3000/api/v1/browser/execute \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"task": "Go to example.com, fill the contact form with name John and email john@test.com, then submit", "startUrl": "https://example.com"}'

# Response:
# {
#   "sessionId": "b8f3a1",
#   "task": "Go to example.com, fill the contact form...",
#   "success": true,
#   "steps": 6,
#   "durationMs": 12450,
#   "extractedData": { "confirmation": "Form submitted successfully" },
#   "screenshots": ["[base64:screenshot:...]"],
#   "errors": []
# }
```

### Example 15: Theory of Mind — Predict User Intent

```bash
# Analyze user mental state
curl -X POST http://localhost:3000/api/v1/tom/analyze \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"targetEntityId": "user-123", "entityType": "user", "messages": [{"role": "user", "content": "This same bug keeps happening every week"}], "currentTask": "fix recurring bug"}'

# Response:
# {
#   "inferredBeliefs": { "problem_is_recurring": true, "previous_fixes_were_temporary": true },
#   "inferredDesires": ["permanent root-cause fix", "not waste time on temporary patches"],
#   "predictedNextAction": "Will ask for a permanent solution, not a quick fix",
#   "predictionConfidence": 0.85,
#   "recommendedResponse": "Acknowledge the recurring pattern, propose investigating root cause instead of patching",
#   "perspectiveDepth": 2
# }
```

### Example 16: Safety Guardrail — 3-Way Action Check

```bash
# Check an action before execution
curl -X POST http://localhost:3000/api/v1/guardrail/check \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"action": "rm -rf /tmp/old_builds", "context": "Cleaning up old build artifacts"}'

# Response (update decision):
# {
#   "decision": "update",
#   "riskLevel": "medium",
#   "riskCategories": ["data_destruction"],
#   "feedback": "Action involves recursive deletion. Adding safety guard.",
#   "revisedPlan": "rm -rf /tmp/old_builds/* with --no-preserve-root and verify /tmp/old_builds exists first",
#   "confidence": 0.92
# }
```

### Example 17: Test-time Recursive Thinking — Multi-Strategy Problem Solving

```bash
# Solve a hard problem with recursive thinking
curl -X POST http://localhost:3000/api/v1/trt/solve \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"problem": "Design a rate limiter that handles burst traffic while maintaining fair allocation across users", "maxRounds": 4}'

# Response:
# {
#   "attempts": [
#     { "round": 0, "strategy": "direct approach", "passed": false, "failureModes": ["did not account for burst patterns"] },
#     { "round": 1, "strategy": "decomposition", "passed": false, "failureModes": ["missed fairness constraint"] },
#     { "round": 2, "strategy": "analogy", "passed": true, "knowledgeGained": "Token bucket + weighted fair queuing handles both burst and fairness" }
#   ],
#   "finalAnswer": "Use token bucket per user with weighted fair queuing...",
#   "converged": true,
#   "confidence": 0.88,
#   "accumulatedKnowledge": ["Token bucket handles bursts", "WFQ ensures fairness"]
# }
```

### Example 18: Smart Model Router — Cost-Optimized Routing

```bash
# Route a simple question to the cheapest capable model
curl -X POST http://localhost:3000/api/v1/router/route \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"input": "What is the capital of France?", "taskType": "simple-qa"}'

# Response:
# {
#   "modelId": "slm-1",
#   "tier": "slm",
#   "reasoning": "Complexity 0.15 → tier slm (match: 100%)",
#   "estimatedCost": 0.0002,
#   "estimatedLatency": 200,
#   "complexityScore": 0.15,
#   "routingFactors": { "inputLength": 0.007, "complexityScore": 0.15, "capabilityMatch": 0.4, "latencyConstraint": 0, "costConstraint": 0 }
# }

# Route a complex architecture task to the large model
curl -X POST http://localhost:3000/api/v1/router/route \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"input": "Design a distributed rate limiter with consistency guarantees, failure handling, and saga pattern for transactions across 10K orders/sec", "taskType": "architecture"}'

# Response:
# {
#   "modelId": "large-1",
#   "tier": "large",
#   "reasoning": "Complexity 0.85 → tier large (match: 93%)",
#   "estimatedCost": 0.015,
#   "estimatedLatency": 3000,
#   "complexityScore": 0.85
# }
```

### Example 19: Execution State Memory — Checkpoint & Resume

```bash
# Save a checkpoint during a long-running task
curl -X POST http://localhost:3000/api/v1/esm/checkpoint \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"runId": "run-abc123", "stepIndex": 7, "stepCount": 12, "state": {"messages": [{"role": "assistant", "content": "Analyzed 3 files, found 2 bugs"}], "toolResults": [{"tool": "bash", "result": "ok"}], "plan": ["fix bug 1", "fix bug 2", "run tests"], "variables": {"filesChecked": 3}, "intermediateResults": ["bug1: null pointer", "bug2: race condition"]}}'

# Response:
# {
#   "id": "cp1a2b3",
#   "runId": "run-abc123",
#   "stepIndex": 7,
#   "stepCount": 12,
#   "status": "running",
#   "createdAt": "2026-06-21T02:10:00Z"
# }

# Resume from checkpoint after a crash
curl -X POST http://localhost:3000/api/v1/esm/resume/cp1a2b3 \
  -H "Authorization: Bearer $TOKEN"

# Response:
# {
#   "id": "cp1a2b3",
#   "runId": "run-abc123",
#   "stepIndex": 7,
#   "status": "resumed",
#   "resumedAt": "2026-06-21T02:15:00Z",
#   "state": { "messages": [...], "toolResults": [...], "plan": [...] }
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
| Lines of Code | ~80,000 |
| Test Files | 65+ |
| Tests Passing | 63+ (core suites) |
| Packages | 16 |
| API Endpoints | 210+ |
| Built-in Tools | 90 |
| Dashboard Pages | 43 |
| Database Migrations | 25 |
| Agent Profiles | 30 |
| Queue Types | 9 |
| Super-Agent Capabilities | 39 |
| Agent-Engine Modules | 45+ |

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

### Completed — Super-Agent v2 (12 New Capabilities)
- [x] **Dream Mode** — Background memory consolidation (OpenAI Dreaming V3 inspired)
- [x] **Causal Replay** — Which step caused failure? (CAR inspired)
- [x] **Recursive Self-Rewrite** — Agent rewrites its own logic at runtime (Gödel Agent inspired)
- [x] **Evolutionary Solver** — Population-based solution evolution (AgentGA inspired)
- [x] **Self-Healing Debugger** — Multi-agent debugging with historical lessons
- [x] **Introspective Awareness** — Agent inspects its own internal states
- [x] **Curiosity Engine** — Proactive skill acquisition without external requests
- [x] **Emotional Intelligence** — IQ-EQ co-reasoning with empathy modeling
- [x] **Neuro-Symbolic Reasoning** — Neural intuition + symbolic logic rules
- [x] **Dynamic Tool Discovery** — Find tools from npm, GitHub, APIs, MCP
- [x] **Autonomous Skill Synthesis** — Decompose tasks → synthesize reusable skills
- [x] **Meta-Learning Optimizer** — Optimize agent's own learning parameters

### Completed — Super-Agent v3 (15 New Capabilities)
- [x] **A2A Protocol** — Agent-to-agent interoperability (Google A2A standard, 150+ orgs)
- [x] **SKILL.md Standard** — Portable skills in AIP-3 format (agentskills.io spec)
- [x] **Browser Automation Agent** — LLM-driven web tasks with self-healing locators
- [x] **Live Web Intelligence** — Real-time web search, scrape, crawl, interact
- [x] **Theory of Mind** — Model beliefs/desires of other entities (AAAI-26 A-ToM)
- [x] **Test-time Recursive Thinking** — Iterative self-improvement at inference (TRT)
- [x] **Metacognitive Consolidation** — 3-level hierarchical memory → proceduralization (MC2)
- [x] **TRIAD Safety Guardrail** — 3-way decisions: proceed, refuse, update
- [x] **Self-Evolving Safety Memory** — Contrastive cells, cross-attack transfer (Membrane)
- [x] **Experiential Heuristic Extraction** — Transferable lessons from trajectories (ERL)
- [x] **HyperAgent** — Continuous self-improvement loop with rollback (HyperAgent v2)
- [x] **Execution State Memory** — Checkpoint/resume for long-running agent tasks
- [x] **Smart Model Router** — Complexity-based SLM→XL routing for cost optimization
- [x] **Benchmarking Suite** — Self-evaluation with 8 tasks across 5 categories
- [x] **WebMCP Bridge** — Connect to remote MCP servers over HTTP

### Planned — Platform
- [ ] Full Playwright Browser Automation (production)
- [ ] Production Voice Interface (STT + TTS)
- [ ] Mobile App (React Native)

See [TITAN_SUPER_AGENT_V2_PROPOSAL.md](TITAN_SUPER_AGENT_V2_PROPOSAL.md) for detailed specs.

---

<div align="center">

**Built with obsession by [Nabil Karem](https://github.com/Nabilkarem911)**

*Titan doesn't use frameworks. Titan IS the framework.*

</div>
