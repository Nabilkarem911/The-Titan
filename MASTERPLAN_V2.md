\# TITAN MASTER PLAN V2



\## PROJECT NAME



Titan



\## PROJECT TYPE



Universal Autonomous Agent Framework



\## OBJECTIVE



Build an open-source autonomous AI operating system capable of:



\- planning

\- reasoning

\- coding

\- executing tools

\- managing containers

\- remembering information

\- monitoring infrastructure

\- interacting through UI



without dependency on LangChain, CrewAI, AutoGen, or framework wrappers. Only Vanilla NodeJS.



\## CORE PHILOSOPHY



Everything must be:



\- Modular

\- Provider Agnostic

\- Dockerized

\- API Driven

\- Environment Configurable

\- Self-Healing

\- Extensible

\- \*\*Observable\*\*

\- \*\*Horizontally Scalable\*\*

\- \*\*Multi-Tenant Secure\*\*



\---



\## PHASE 1: Foundation (Hardened)



\*\*Goals\*\*: Create production-ready infrastructure foundation that all subsequent phases depend on.



\### Deliverables



\#### Infrastructure Stack (`docker/`)

```

docker/

├── postgres/           # Primary DB + pgvector extension

├── redis/              # Queue + Pub/Sub + Cache + Rate Limiting

├── chromadb/           # Vector store (persistence volume)

├── jaeger/             # Distributed tracing backend

├── prometheus/         # Metrics collection

├── grafana/            # Dashboards + alerting

├── nginx/              # API Gateway + TLS termination + WebSocket proxy

├── vault/              # Secrets management (dev mode)

└── sandbox-pool/       # Pre-warmed Alpine containers (gRPC API)

```



\#### Core Packages (`packages/`)

```

packages/

├── shared/             # Types, constants, utilities, Zod schemas

├── database/           # Prisma/Drizzle ORM + migrations + RLS policies

├── queue/              # BullMQ wrapper + worker base class + job types

├── config/             # Dynamic config (etcd/Consul/.env hybrid) + feature flags

├── gateway/            # Fastify app + auth + rate limit + OpenAPI + WS upgrade

├── telemetry/          # OpenTelemetry + structured logging + tracing + metrics

├── secrets/            # Vault/AWS/Doppler client + .env fallback + rotation

├── memory/             # Provider interface + ChromaDB + pgvector + mock implementations

├── sandbox/            # gRPC client for container pool + execution API

└── auth/               # JWT + API keys + workspace-scoped permissions

```



\#### Applications (`apps/`)

```

apps/

├── core/               # API Gateway + Core Services (config, auth, health)

└── worker/             # Generic job worker entry point (scales independently)

```



\### Database Schema (PostgreSQL + pgvector)



```sql

\-- Core tables with Row Level Security

users

workspaces

workspace\_members

sessions

agent\_runs

tool\_executions

memories (vector column via pgvector)

audit\_logs (append-only, partitioned by month)

metrics (hypertable via TimescaleDB or partitioned)

api\_keys

provider\_configs

feature\_flags

```



\### Queue Topology (Redis + BullMQ)



| Queue | Purpose | Priority | Retention |

|-------|---------|----------|-----------|

| `agent:execute` | Agent ReAct loop steps | High | 7 days |

| `tool:execute` | Tool invocations (bash, patch, docker, scrape) | High | 7 days |

| `memory:index` | Embedding generation + vector upsert | Medium | 30 days |

| `memory:retrieve` | Semantic search queries | Medium | 7 days |

| `sandbox:exec` | Container execution requests | High | 3 days |

| `monitoring:check` | Health checks, metrics collection | Low | 1 day |

| `audit:write` | Immutable audit log writes | Critical | 1 year |

| `webhook:deliver` | External callbacks | Medium | 3 days |



\### WebSocket Protocol (JSON-RPC 2.0 over WS)



```

Client -> Server: {"jsonrpc":"2.0","id":1,"method":"auth","params":{"token":"..."}}

Server -> Client: {"jsonrpc":"2.0","id":1,"result":{"session\_id":"..."}}



Methods:

\- agent.run        (start agent with goal)

\- agent.stream     (subscribe to agent events)

\- tool.execute     (invoke tool directly)

\- memory.search    (semantic search)

\- workspace.files  (file tree + watch)

\- metrics.subscribe (real-time metrics)

\- logs.subscribe   (real-time logs)

```



\### API Gateway Routes



| Route | Auth | Rate Limit | Purpose |

|-------|------|------------|---------|

| `/api/v1/auth/\*` | None | 10/min | Login, refresh, API keys |

| `/api/v1/workspaces` | JWT | 100/min | CRUD workspaces |

| `/api/v1/agents` | JWT | 50/min | Agent runs, history |

| `/api/v1/tools` | JWT | 200/min | Tool registry, execute |

| `/api/v1/memory` | JWT | 100/min | Search, inject, manage |

| `/api/v1/sandbox` | JWT | 20/min | Exec, containers |

| `/api/v1/monitoring` | JWT | 60/min | Health, metrics, alerts |

| `/ws` | JWT (query) | 50 conn/user | Real-time events |



\---



\## PHASE 2: Agent Engine



\*\*Goals\*\*: Custom ReAct framework with full observability, queue integration, and horizontal scalability.



\### Features



\- \*\*Planning\*\*: Goal decomposition → task DAG

\- \*\*Observation\*\*: Tool results + environment state

\- \*\*Reflection\*\*: Failure analysis + plan revision

\- \*\*Retry Logic\*\*: Exponential backoff + circuit breaker per provider

\- \*\*Tool Calling\*\*: Queue-based async execution with timeout budgets

\- \*\*Memory Injection\*\*: Async memory retrieval via queue (non-blocking)

\- \*\*Streaming Responses\*\*: SSE + WebSocket for real-time token streaming

\- \*\*Rules Engine\*\*: Declarative constraints (max steps, token budget, forbidden tools)



\### Architecture



```

Agent Run (stateless worker)

├── Planner (LLM call via Provider Layer)

├── Executor (dispatches to tool:execute queue)

├── Reflector (LLM call on failure)

├── Memory Client (async memory:retrieve queue)

├── Context Builder (sliding window + recursive summarization)

└── State Persistence (agent\_runs table + Redis checkpoint)

```



\### Worker Deployment



\- Horizontal pod autoscaling based on `agent:execute` queue depth

\- Each worker processes ONE agent step at a time

\- State checkpointed to PostgreSQL after each step

\- Graceful shutdown: finish current step, requeue if incomplete



\---



\## PHASE 3: Tool Arsenal



\*\*Goals\*\*: Production-grade tools with sandbox isolation, auditing, and resource limits.



\### Core Tools (Queue-Based Execution)



| Tool | Queue | Sandbox | Timeout | Resources |

|------|-------|---------|---------|-----------|

| `execute\_bash` | `tool:execute` | Yes | 120s | 1 CPU, 512MB |

| `patch\_file` | `tool:execute` | Yes | 30s | 0.5 CPU, 256MB |

| `read\_file\_ast` | `tool:execute` | Yes | 10s | 0.5 CPU, 256MB |

| `docker\_orchestrator` | `sandbox:exec` | N/A (host Docker) | 300s | — |

| `firecrawl\_scrape` | `tool:execute` | No (external) | 60s | — |



\### Tool Execution Contract



```typescript

interface ToolJob {

&#x20; tool: string;

&#x20; params: Record<string, unknown>;

&#x20; context: {

&#x20;   workspaceId: string;

&#x20;   sessionId: string;

&#x20;   agentRunId: string;

&#x20;   userId: string;

&#x20;   permissions: string\[];

&#x20; };

&#x20; limits: {

&#x20;   cpu: string;

&#x20;   memory: string;

&#x20;   timeoutMs: number;

&#x20;   network: boolean;

&#x20; };

}

```



\### Future Tools (Queue-Ready)



\- `browser\_automation` → `sandbox:exec` (Playwright in container)

\- `github\_manager` → `tool:execute` (GitHub App auth)

\- `database\_manager` → `tool:execute` (read-only by default)

\- `email\_sender` → `tool:execute` (provider-agnostic)

\- `telegram\_manager` → `tool:execute` (bot token from secrets)



\---



\## PHASE 4: Memory Layer (Abstracted)



\*\*Goals\*\*: Provider-agnostic memory with semantic search, conversation history, and project knowledge.



\### Provider Interface



```typescript

interface MemoryProvider {

&#x20; initialize(config: MemoryConfig): Promise<void>;

&#x20; healthCheck(): Promise<HealthStatus>;

&#x20; 

&#x20; // Conversation

&#x20; addMessage(sessionId: string, message: MemoryMessage): Promise<void>;

&#x20; getHistory(sessionId: string, limit?: number): Promise<MemoryMessage\[]>;

&#x20; 

&#x20; // Semantic

&#x20; upsert(collection: string, items: MemoryItem\[]): Promise<void>;

&#x20; search(collection: string, query: string, opts: SearchOpts): Promise<SearchResult\[]>;

&#x20; delete(collection: string, ids: string\[]): Promise<void>;

&#x20; 

&#x20; // Project Knowledge

&#x20; createCollection(name: string, workspaceId: string): Promise<void>;

&#x20; listCollections(workspaceId: string): Promise<CollectionInfo\[]>;

&#x20; 

&#x20; // Maintenance

&#x20; compact(collection: string): Promise<void>;

&#x20; backup(collection: string, destination: string): Promise<void>;

&#x20; restore(collection: string, source: string): Promise<void>;

}

```



\### Providers (Phase 4 + 8)



| Provider | Use Case | Scaling |

|----------|----------|---------|

| `chromadb` | Default, local dev | Single node + persistence |

| `pgvector` | Production, multi-tenant | Read replicas + partitioning |

| `weaviate` | Large scale, hybrid search | Cluster |

| `pinecone` | Managed, serverless | Auto-scale |

| `mock` | Testing, CI | In-memory |



\### Memory Injection Strategy



\- \*\*Async\*\*: Agent dispatches `memory:retrieve` job, continues planning

\- \*\*Callback\*\*: Worker publishes result to `agent:{runId}:memory` Redis channel

\- \*\*Cache\*\*: Recent searches cached in Redis (TTL 5min)

\- \*\*Budget\*\*: Max 4000 tokens injected per step (configurable)



\---



\## PHASE 5: Dashboard



\*\*Goals\*\*: Multi-tenant UI with real-time updates via WebSocket.



\### Authentication



\- JWT (access 15min, refresh 7d) + API Keys (workspace-scoped)

\- OAuth2/OIDC ready (Google, GitHub, GitLab) — Phase 10



\### Components (Micro-Frontend Ready)



| Component | Route | WebSocket Channel |

|-----------|-------|-------------------|

| Chat | `/chat` | `agent.stream` |

| Workspace Explorer | `/workspace/:id` | `workspace.files` |

| File Upload/Download | `/workspace/:id/files` | — |

| Memory Viewer | `/memory` | `memory.search` |

| Logs Viewer | `/logs` | `logs.subscribe` |

| Tool Manager | `/tools` | — |

| Metrics Dashboard | `/metrics` | `metrics.subscribe` |

| Container Dashboard | `/containers` | `container.events` |

| Settings | `/settings` | — |



\### API Contract



\- All endpoints: OpenAPI 3.1 spec generated from Zod schemas

\- Validation: Zod on request/response

\- Errors: RFC 9457 Problem Details

\- Pagination: Cursor-based (stable ordering)



\---



\## PHASE 6: Execution Sandbox (Container Pool)



\*\*Goals\*\*: Pre-warmed, isolated, audited command execution.



\### Architecture



```

Sandbox Pool Service (gRPC)

├── Pool Manager (maintains N warm containers)

├── Container Lifecycle (create, reuse, recycle, destroy)

├── Resource Enforcement (cgroups v2: CPU, RAM, PIDs, disk)

├── Network Policy (deny by default, allowlist per tool)

├── Filesystem (virtio-fs / 9P for workspace mount)

├── Audit Logger (every exec → audit:write queue)

└── Health Monitor (restart unhealthy, collect metrics)

```



\### Container Spec



\- Base: `alpine:latest` + `docker-cli` + `git` + `node` + `python3`

\- User: Non-root (UID 1000), read-only rootfs + tmpfs mounts

\- Capabilities: Dropped all (`--cap-drop=ALL`)

\- Seccomp: Custom profile (allow only needed syscalls)

\- Timeout: Per-tool configurable (default 120s)

\- History: SQLite inside container → exported to `tool\_executions` on completion



\### Pool Configuration



```yaml

pool:

&#x20; minSize: 4

&#x20; maxSize: 32

&#x20; targetUtilization: 0.7

&#x20; recycleAfterExecutions: 100

&#x20; recycleAfterSeconds: 3600

&#x20; healthCheckInterval: 30s

&#x20; startupTimeout: 10s

```



\---



\## PHASE 7: Infrastructure Monitoring



\*\*Goals\*\*: Full-stack observability with alerting.



\### Metrics Collection



| Source | Metrics | Interval |

|--------|---------|----------|

| Node.js (core, worker) | HTTP latency, queue depth, memory, CPU, event loop lag | 10s |

| PostgreSQL | Connections, query latency, replication lag, deadlocks | 30s |

| Redis | Memory, hit rate, connected clients, queue lengths | 10s |

| ChromaDB | Collection sizes, query latency, index status | 60s |

| Sandbox Pool | Container count, exec latency, resource usage | 10s |

| LLM Providers | Latency, token usage, error rates, cost | Per-request |



\### Health Checks



| Service | Liveness | Readiness |

|---------|----------|-----------|

| Core API | HTTP 200 `/health/live` | DB + Redis + Queue reachable |

| Worker | Process alive | Can dequeue + reach providers |

| Sandbox Pool | gRPC health | Min pool size healthy |

| ChromaDB | HTTP 200 `/api/v1/heartbeat` | Can query + write |



\### Alerting Rules (Prometheus + Alertmanager)



\- \*\*Critical\*\*: API error rate > 5%, queue lag > 10min, DB unavailable

\- \*\*Warning\*\*: CPU > 80%, memory > 85%, disk > 80%, provider latency p99 > 30s

\- \*\*Info\*\*: New deployment, scaling events, cost thresholds



\### Notification Channels



\- Telegram (Phase 7)

\- Slack, PagerDuty, Email, Webhook (Phase 10)

\- Dashboard real-time (WebSocket)



\---



\## PHASE 8: Provider Layer



\*\*Goals\*\*: Runtime provider switching, circuit breaking, token budgeting.



\### Provider Registry



```typescript

interface ProviderRegistry {

&#x20; register(name: string, provider: LLMProvider): void;

&#x20; get(name: string): LLMProvider | undefined;

&#x20; getDefault(): LLMProvider;

&#x20; list(): ProviderInfo\[];

&#x20; healthCheckAll(): Promise<Record<string, HealthStatus>>;

}

```



\### Supported Providers (Config-Driven)



| Provider | Models | Auth | Streaming | Tool Calling |

|----------|--------|------|-----------|--------------|

| OpenAI | GPT-4o, GPT-4o-mini, o1 | API Key | Yes | Yes |

| Anthropic | Claude 3.5 Sonnet, Haiku | API Key | Yes | Yes |

| DeepSeek | DeepSeek-V3, R1 | API Key | Yes | Yes |

| Gemini | 1.5 Pro, 1.5 Flash | API Key | Yes | Yes |

| OpenRouter | 100+ models | API Key | Yes | Varies |

| Ollama | Local models | None | Yes | Limited |

| LiteLLM | Proxy to any | API Key | Yes | Yes |



\### Runtime Features



\- \*\*Per-request provider override\*\*: `X-Provider` header or config

\- \*\*Circuit breaker\*\*: 5 failures → open 30s → half-open

\- \*\*Token budget\*\*: Per-workspace daily/monthly limits (enforced in gateway)

\- \*\*Cost tracking\*\*: Per-request + aggregated (provider, model, workspace)

\- \*\*Fallback chain\*\*: Primary → Secondary → Local (Ollama)



\---



\## PHASE 9: Plugin System



\*\*Goals\*\*: Secure, versioned, marketplace-ready tool extensions.



\### Architecture



```

Plugin Manager

├── Registry (PostgreSQL: plugins, versions, signatures)

├── Installer (WASM module + manifest validation)

├── Sandbox (wasmtime/V8 isolates, no host access)

├── Capability System (declare: fs, net, exec, memory, tools)

├── Hot Reload (worker reload on plugin enable/disable)

└── Marketplace API (search, install, update, review)

```



\### Plugin Manifest



```json

{

&#x20; "name": "github-manager",

&#x20; "version": "1.2.0",

&#x20; "description": "GitHub repository management",

&#x20; "author": "titan-community",

&#x20; "signature": "sig\_...",

&#x20; "capabilities": \["net:github.com", "tool:execute\_bash"],

&#x20; "tools": \[

&#x20;   {"name": "github\_create\_pr", "schema": {...}},

&#x20;   {"name": "github\_list\_issues", "schema": {...}}

&#x20; ],

&#x20; "entrypoint": "dist/plugin.wasm",

&#x20; "minEngineVersion": "0.10.0"

}

```



\### Security



\- Signed WASM modules (cosign/sigstore)

\- Capability-based permissions (no ambient authority)

\- Resource limits per plugin (CPU, memory, execution time)

\- Audit log for all plugin actions

\- No direct host filesystem/network access



\---



\## PHASE 10: Production Hardening



\*\*Goals\*\*: Multi-tenant, multi-region, compliant, scalable.



\### Security



| Layer | Implementation |

|-------|----------------|

| Transport | TLS 1.3 everywhere (nginx + mTLS for service mesh) |

| Authentication | JWT + API Keys + mTLS (service-to-service) |

| Authorization | RBAC + ABAC (workspace, role, resource, action) |

| Rate Limiting | Distributed (Redis sliding window) per user/workspace/IP |

| Input Validation | Zod schemas on ALL endpoints + queue jobs |

| Audit Logs | Append-only (PostgreSQL partitioned + S3 archive) |

| Sandbox Isolation | gVisor/Kata Containers option for high-security |

| Secrets | Vault (prod) + .env (dev) + automatic rotation |

| Supply Chain | SBOM (Syft), signing (cosign), provenance (SLSA L3) |



\### Scalability



| Dimension | Strategy |

|-----------|----------|

| Multi-Workspace | Row-Level Security (PostgreSQL) + workspace-scoped queues |

| Multi-User | JWT claims → workspace membership → RLS policies |

| Multi-Session | Session table + WebSocket affinity (Redis pub/sub) |

| Horizontal Scaling | K8s HPA (custom metrics: queue depth, CPU, custom) |

| ARM64/AMD64 | Multi-arch Docker images (buildx) + CI matrix |

| Multi-Region | Active-passive (DB replication) + active-active (read replicas) |

| Disaster Recovery | RPO < 1hr (WAL-G), RTO < 15min (automated failover) |



\### Compliance



\- SOC 2 Type II ready (audit logs, access controls, encryption)

\- GDPR: Data export/deletion endpoints, DPA template

\- HIPAA: BAA-ready infrastructure (encrypted, audited, isolated)



\---



\## DEFINITION OF DONE



Titan is complete when:



\- Can receive goals via API/UI

\- Creates plans with DAG visualization

\- Executes tools in isolated sandboxes with audit trail

\- Reflects on failures and retries with revised plans

\- Stores memories with semantic search across providers

\- Manages containers (lifecycle, networks, volumes)

\- Communicates through real-time Dashboard

\- Operates continuously without human intervention

\- \*\*Scales horizontally to 1000+ concurrent agent runs\*\*

\- \*\*Supports 100+ workspaces with data isolation\*\*

\- \*\*Meets SOC 2 / GDPR compliance requirements\*\*

\- \*\*Recovers from region failure in < 15min\*\*



\---



\## DEVELOPMENT RULES



\- Never create placeholders.

\- Never create TODO sections.

\- Never mock core functionality.

\- Every feature must be production ready.

\- Every endpoint must have validation.

\- Every error must be handled.

\- Every service must have logs, metrics, traces.

\- All secrets must come from secrets manager (Vault/.env).

\- No hardcoded credentials.

\- No LangChain, CrewAI, AutoGen, framework wrappers.

\- \*\*All inter-service communication via queue or gRPC (no direct HTTP)\*\*

\- \*\*All state externalized (PostgreSQL, Redis, ChromaDB)\*\*

\- \*\*All async operations idempotent with exactly-once semantics\*\*

\- \*\*All database migrations backwards compatible\*\*

\- \*\*All APIs versioned (v1, v2...) with deprecation policy\*\*



\---



\## EXECUTION STRATEGY



\*\*Work sequentially. Finish one phase completely. Run tests. Commit. Continue to next phase. Never skip phases. Never generate entire project in one step.\*\*



\### Phase Dependencies (Critical Path)



```

Phase 1 (Foundation: DB, Queue, Gateway, Telemetry, Secrets, Memory Interface, Sandbox Pool)

&#x20;   ↓

Phase 2 (Agent Engine: stateless workers + queue integration)

&#x20;   ↓

Phase 6 (Sandbox Pool: gRPC service + container lifecycle) ← parallel with Phase 3

&#x20;   ↓

Phase 3 (Tools: queue-based + sandbox integration)

&#x20;   ↓

Phase 4 (Memory: provider implementations + async injection)

&#x20;   ↓

Phase 8 (Providers: registry + circuit breaker + budgets)

&#x20;   ↓

Phase 5 (Dashboard: micro-frontends + WebSocket) ← parallel with Phase 7

&#x20;   ↓

Phase 7 (Monitoring: metrics + alerts + dashboards)

&#x20;   ↓

Phase 9 (Plugins: WASM runtime + marketplace)

&#x20;   ↓

Phase 10 (Production: multi-region, compliance, hardening)

```



\### Phase 1 Acceptance Criteria (Must Pass Before Phase 2)



\- \[ ] PostgreSQL + pgvector running, migrations apply cleanly

\- \[ ] Redis cluster (3 nodes) with queue + pub/sub + cache working

\- \[ ] NGINX Gateway: TLS, rate limit, JWT validation, WebSocket proxy

\- \[ ] OpenTelemetry: traces + metrics + logs flowing to Jaeger/Prometheus/Grafana

\- \[ ] Vault: secrets readable, rotation works, .env fallback

\- \[ ] Memory Interface: ChromaDB + pgvector + mock all pass contract tests

\- \[ ] Sandbox Pool: 4 warm containers, gRPC exec < 50ms cold, < 5ms warm

\- \[ ] Queue: all 8 queues processing, dead letter handling, retry works

\- \[ ] Health checks: all services report ready/live correctly

\- \[ ] Load test: 100 concurrent agent runs, p99 latency < 2s



\---



\## APPENDIX: Technology Decisions



| Category | Choice | Rationale |

|----------|--------|-----------|

| Language | TypeScript (Node.js 22+) | Type safety, ecosystem, single language full-stack |

| Database | PostgreSQL 16 + pgvector | ACID, RLS, JSONB, vector extension, mature |

| Queue | BullMQ (Redis) | Priority, retries, scheduling, metrics, active community |

| Gateway | NGINX + Fastify | Performance, TLS, WebSocket, OpenAPI, plugins |

| Telemetry | OpenTelemetry (JS) + Prometheus + Jaeger + Grafana | Vendor-neutral, standard, scalable |

| Secrets | HashiCorp Vault (dev) / AWS Secrets Manager (prod) | Dynamic secrets, rotation, audit, K8s integration |

| Vector DB | ChromaDB (dev) / pgvector (prod) / Weaviate (scale) | Abstraction layer supports all |

| Sandbox | gRPC + Alpine + cgroups v2 | Low overhead, standard Linux isolation |

| Plugin | WASM (wasmtime) + cosign | Portable, sandboxed, verifiable |

| Orchestration | Kubernetes (K3s dev, EKS/GKE prod) | Industry standard, autoscaling, multi-cloud |

| CI/CD | GitHub Actions + Buildx + Cosign + Syft | Supply chain security, multi-arch |

