# AI Agent Integration Guide

This document explains how external AI agents (e.g., Claude Desktop, Cursor, custom Python agents) can integrate with Titan as their execution backend.

## Overview

Titan provides a secure, multi-tenant foundation for autonomous agents. Agents authenticate via API keys, execute tasks through BullMQ queues, store memory via pgvector, and receive real-time updates via WebSocket JSON-RPC.

---

## Authentication

Agents authenticate using **workspace-scoped API keys**.

### 1. Obtain an API Key

```bash
curl -X POST http://localhost:3000/api-keys \
  -H "Authorization: Bearer <user_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Claude Desktop Agent", "scopes": ["agent:execute", "tool:execute", "memory:read", "memory:write"]}'
```

Response:
```json
{
  "id": "key-uuid",
  "plaintext": "tk_a1b2c3d4_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "keyPrefix": "tk_a1b2c3d4",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

**Important:** Store the `plaintext` securely. It is shown only once.

### 2. Use the API Key

Include the key in every request:

```bash
curl http://localhost:3000/health/ready \
  -H "X-API-Key: tk_a1b2c3d4_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

---

## Core Workflows

### Submit an Agent Task (Queue)

Agents submit work to the `agent-execute` queue via the REST API (future endpoint) or directly via BullMQ. For now, enqueue jobs through the gateway:

```bash
curl -X POST http://localhost:3000/jobs \
  -H "X-API-Key: <api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "queue": "agent-execute",
    "payload": {
      "runId": "550e8400-e29b-41d4-a716-446655440000",
      "agentId": "claude-desktop-v1",
      "prompt": "Analyze the codebase and suggest refactoring opportunities",
      "workspaceId": "optional-workspace-uuid"
    }
  }'
```

### Execute a Tool

Agents can trigger tool executions (bash, file patch, scrape, etc.) via the `tool-execute` queue:

```bash
curl -X POST http://localhost:3000/jobs \
  -H "X-API-Key: <api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "queue": "tool-execute",
    "payload": {
      "toolName": "execute_bash",
      "input": { "command": "find . -name \"*.ts\" | wc -l" }
    }
  }'
```

Supported tools (Phase 3):
| Tool | Purpose |
|------|---------|
| `execute_bash` | Run shell commands in sandbox |
| `patch_file` | Apply unified diff patches |
| `read_file_ast` | Return AST structure |
| `firecrawl_scrape` | Scrape URLs via Firecrawl |
| `docker_orchestrator` | Manage containers |

### Memory Operations

Agents store and retrieve long-term context:

```bash
# Store memory
curl -X POST http://localhost:3000/memory \
  -H "X-API-Key: <api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "collection": "agent-context",
    "items": [{"id": "ctx-1", "content": "User prefers TypeScript", "metadata": {}}]
  }'

# Search memory
curl "http://localhost:3000/memory/agent-context/search?query=TypeScript&limit=5" \
  -H "X-API-Key: <api-key>"
```

---

## Real-Time Updates (WebSocket)

Connect to Titan's WebSocket endpoint for live queue stats, job completions, and streaming results.

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  // Authenticate
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'auth',
    params: { apiKey: 'tk_a1b2c3d4_xxxxxxxx...' }
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === 'queue.stats') {
    console.log('Queue status:', msg.params);
  }
};
```

### JSON-RPC Methods

| Method | Description |
|--------|-------------|
| `auth` | Authenticate with API key |
| `ping` | Keep-alive / latency check |
| `server.info` | Get server version and uptime |
| `queue.stats` | Subscribe to queue statistics |

---

## Permission Model

API keys are scoped to specific permissions. Common agent permission sets:

```typescript
// Read-only observer
['workspace:read', 'agent:read', 'tool:read', 'memory:read']

// Interactive agent (recommended)
['workspace:read', 'agent:read', 'agent:write', 'agent:execute',
 'tool:read', 'tool:execute', 'memory:read', 'memory:write']

// Admin agent
['workspace:read', 'workspace:write', 'workspace:admin',
 'agent:read', 'agent:write', 'agent:execute',
 'tool:read', 'tool:execute', 'memory:read', 'memory:write',
 'sandbox:read', 'sandbox:execute', 'monitoring:read']
```

---

## Example: Python Agent Client

```python
import asyncio
import websockets
import httpx

class TitanAgent:
    def __init__(self, api_key: str, base_url: str = "http://localhost:3000"):
        self.api_key = api_key
        self.base_url = base_url
        self.client = httpx.AsyncClient(headers={"X-API-Key": api_key})

    async def submit_task(self, prompt: str, agent_id: str) -> dict:
        payload = {
            "queue": "agent-execute",
            "payload": {
                "runId": str(uuid.uuid4()),
                "agentId": agent_id,
                "prompt": prompt
            }
        }
        r = await self.client.post(f"{self.base_url}/jobs", json=payload)
        return r.json()

    async def run_tool(self, tool_name: str, params: dict) -> dict:
        payload = {
            "queue": "tool-execute",
            "payload": {"toolName": tool_name, "input": params}
        }
        r = await self.client.post(f"{self.base_url}/jobs", json=payload)
        return r.json()

    async def stream_events(self):
        uri = f"ws://localhost:3000/ws"
        async with websockets.connect(uri) as ws:
            await ws.send(json.dumps({
                "jsonrpc": "2.0", "id": 1,
                "method": "auth",
                "params": {"apiKey": self.api_key}
            }))
            async for message in ws:
                yield json.loads(message)

# Usage
async def main():
    agent = TitanAgent(api_key="tk_...")
    result = await agent.run_tool("execute_bash", {"command": "ls -la"})
    print(result)

asyncio.run(main())
```

---

## Security Best Practices

1. **Never commit API keys** — store them in environment variables or a secret manager.
2. **Use minimal scopes** — grant only the permissions the agent actually needs.
3. **Rotate keys regularly** — revoke old keys and issue new ones via `DELETE /api-keys/:id`.
4. **Monitor audit logs** — every action is logged at `GET /audit-logs`.
5. **Enable TLS in production** — WebSocket and HTTP endpoints should use WSS/HTTPS.

---

## Future Enhancements (Phase 2+)

| Feature | Phase | Description |
|---------|-------|-------------|
| Streaming completions | 2 | SSE/WebSocket streaming for agent outputs |
| ReAct loop engine | 2 | Built-in reasoning + action loop |
| Multi-agent orchestration | 3 | Agent-to-agent delegation via queues |
| Plugin marketplace | 9 | WASM-signed custom tools |
