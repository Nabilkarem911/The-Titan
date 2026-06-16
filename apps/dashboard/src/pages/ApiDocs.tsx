import { useState } from 'react';
import { BookOpen, Search, Lock, Globe, Server } from 'lucide-react';

interface Endpoint {
  method: string;
  path: string;
  description: string;
  auth: boolean;
  tags: string[];
}

const ENDPOINTS: Endpoint[] = [
  // Auth
  { method: 'POST', path: '/api/v1/auth/register', description: 'Register new user', auth: false, tags: ['Auth'] },
  { method: 'POST', path: '/api/v1/auth/login', description: 'Login and get access token', auth: false, tags: ['Auth'] },
  { method: 'POST', path: '/api/v1/auth/refresh', description: 'Refresh access token', auth: false, tags: ['Auth'] },
  { method: 'POST', path: '/api/v1/auth/logout', description: 'Logout user', auth: true, tags: ['Auth'] },

  // Workspaces
  { method: 'GET', path: '/api/v1/workspaces', description: 'List my workspaces', auth: true, tags: ['Workspaces'] },
  { method: 'POST', path: '/api/v1/workspaces', description: 'Create new workspace', auth: true, tags: ['Workspaces'] },
  { method: 'GET', path: '/api/v1/workspaces/:id', description: 'Get workspace details', auth: true, tags: ['Workspaces'] },
  { method: 'PATCH', path: '/api/v1/workspaces/:id', description: 'Update workspace', auth: true, tags: ['Workspaces'] },
  { method: 'DELETE', path: '/api/v1/workspaces/:id', description: 'Delete workspace', auth: true, tags: ['Workspaces'] },
  { method: 'GET', path: '/api/v1/workspaces/:id/members', description: 'List workspace members', auth: true, tags: ['Workspaces'] },
  { method: 'POST', path: '/api/v1/workspaces/:id/members', description: 'Add member to workspace', auth: true, tags: ['Workspaces'] },
  { method: 'DELETE', path: '/api/v1/workspaces/:id/members/:userId', description: 'Remove member', auth: true, tags: ['Workspaces'] },

  // Agents
  { method: 'POST', path: '/api/v1/agents/:agentId/run', description: 'Run agent with prompt', auth: true, tags: ['Agents'] },
  { method: 'GET', path: '/api/v1/agents/:agentId/runs', description: 'List agent runs', auth: true, tags: ['Agents'] },
  { method: 'GET', path: '/api/v1/agents/:agentId/runs/:runId', description: 'Get run details', auth: true, tags: ['Agents'] },
  { method: 'GET', path: '/api/v1/agents/:agentId/runs/:runId/steps', description: 'Get run steps', auth: true, tags: ['Agents'] },
  { method: 'POST', path: '/api/v1/agents/:agentId/stream', description: 'Stream agent response (SSE)', auth: true, tags: ['Agents'] },

  // Agent Profiles
  { method: 'GET', path: '/api/v1/agent-profiles', description: 'List my agent profiles', auth: true, tags: ['Templates'] },
  { method: 'GET', path: '/api/v1/agent-profiles/public', description: 'List public profiles', auth: false, tags: ['Templates'] },
  { method: 'POST', path: '/api/v1/agent-profiles', description: 'Create agent profile', auth: true, tags: ['Templates'] },
  { method: 'GET', path: '/api/v1/agent-profiles/:id', description: 'Get agent profile', auth: true, tags: ['Templates'] },
  { method: 'PATCH', path: '/api/v1/agent-profiles/:id', description: 'Update agent profile', auth: true, tags: ['Templates'] },
  { method: 'DELETE', path: '/api/v1/agent-profiles/:id', description: 'Delete agent profile', auth: true, tags: ['Templates'] },

  // Chat
  { method: 'POST', path: '/api/v1/chat', description: 'Chat with agent (SSE streaming)', auth: true, tags: ['Chat'] },
  { method: 'GET', path: '/api/v1/chat/history', description: 'Get chat history', auth: true, tags: ['Chat'] },

  // Files
  { method: 'GET', path: '/api/v1/files', description: 'List files at path', auth: true, tags: ['Files'] },
  { method: 'DELETE', path: '/api/v1/files', description: 'Delete file/folder', auth: true, tags: ['Files'] },
  { method: 'POST', path: '/api/v1/files/upload', description: 'Upload files', auth: true, tags: ['Files'] },
  { method: 'GET', path: '/api/v1/files/download', description: 'Download file', auth: true, tags: ['Files'] },
  { method: 'GET', path: '/api/v1/files/download-zip', description: 'Download folder as zip', auth: true, tags: ['Files'] },

  // Cron
  { method: 'GET', path: '/api/v1/cron', description: 'List cron jobs', auth: true, tags: ['Cron'] },
  { method: 'POST', path: '/api/v1/cron', description: 'Create cron job', auth: true, tags: ['Cron'] },
  { method: 'GET', path: '/api/v1/cron/:id', description: 'Get cron job', auth: true, tags: ['Cron'] },
  { method: 'PATCH', path: '/api/v1/cron/:id', description: 'Update cron job', auth: true, tags: ['Cron'] },
  { method: 'DELETE', path: '/api/v1/cron/:id', description: 'Delete cron job', auth: true, tags: ['Cron'] },
  { method: 'POST', path: '/api/v1/cron/:id/trigger', description: 'Trigger cron job now', auth: true, tags: ['Cron'] },
  { method: 'POST', path: '/api/v1/cron/:id/pause', description: 'Pause cron job', auth: true, tags: ['Cron'] },
  { method: 'POST', path: '/api/v1/cron/:id/resume', description: 'Resume cron job', auth: true, tags: ['Cron'] },

  // Plugins
  { method: 'GET', path: '/api/v1/plugins', description: 'List plugins', auth: false, tags: ['Plugins'] },
  { method: 'POST', path: '/api/v1/plugins', description: 'Install plugin', auth: true, tags: ['Plugins'] },
  { method: 'GET', path: '/api/v1/plugins/:id', description: 'Get plugin details', auth: true, tags: ['Plugins'] },
  { method: 'PATCH', path: '/api/v1/plugins/:id/status', description: 'Enable/disable plugin', auth: true, tags: ['Plugins'] },
  { method: 'POST', path: '/api/v1/plugins/:id/execute', description: 'Execute plugin tool', auth: true, tags: ['Plugins'] },
  { method: 'GET', path: '/api/v1/plugins/search', description: 'Search plugins', auth: false, tags: ['Plugins'] },
  { method: 'POST', path: '/api/v1/plugins/:id/rate', description: 'Rate plugin', auth: true, tags: ['Plugins'] },
  { method: 'GET', path: '/api/v1/plugins/:id/ratings', description: 'Get plugin ratings', auth: false, tags: ['Plugins'] },
  { method: 'DELETE', path: '/api/v1/plugins/:id', description: 'Delete plugin', auth: true, tags: ['Plugins'] },
  { method: 'GET', path: '/api/v1/plugins/loaded', description: 'List loaded plugins', auth: true, tags: ['Plugins'] },

  // Webhooks
  { method: 'GET', path: '/api/v1/webhooks', description: 'List webhooks', auth: true, tags: ['Webhooks'] },
  { method: 'POST', path: '/api/v1/webhooks', description: 'Create webhook', auth: true, tags: ['Webhooks'] },
  { method: 'GET', path: '/api/v1/webhooks/:id', description: 'Get webhook', auth: true, tags: ['Webhooks'] },
  { method: 'PATCH', path: '/api/v1/webhooks/:id', description: 'Update webhook', auth: true, tags: ['Webhooks'] },
  { method: 'DELETE', path: '/api/v1/webhooks/:id', description: 'Delete webhook', auth: true, tags: ['Webhooks'] },
  { method: 'POST', path: '/api/v1/webhooks/:id/rotate', description: 'Rotate webhook secret', auth: true, tags: ['Webhooks'] },
  { method: 'GET', path: '/api/v1/webhooks/:id/deliveries', description: 'Get delivery logs', auth: true, tags: ['Webhooks'] },

  // API Keys
  { method: 'GET', path: '/api/v1/api-keys', description: 'List API keys', auth: true, tags: ['API Keys'] },
  { method: 'POST', path: '/api/v1/api-keys', description: 'Create API key', auth: true, tags: ['API Keys'] },
  { method: 'DELETE', path: '/api/v1/api-keys/:id', description: 'Revoke API key', auth: true, tags: ['API Keys'] },

  // User Keys
  { method: 'GET', path: '/api/v1/user/keys', description: 'List user secrets', auth: true, tags: ['Settings'] },
  { method: 'POST', path: '/api/v1/user/keys', description: 'Add user secret', auth: true, tags: ['Settings'] },
  { method: 'DELETE', path: '/api/v1/user/keys/:keyId', description: 'Delete user secret', auth: true, tags: ['Settings'] },

  // Compliance / Audit
  { method: 'GET', path: '/api/v1/compliance/audit/verify', description: 'Verify audit hash chain', auth: true, tags: ['Audit'] },
  { method: 'GET', path: '/api/v1/compliance/audit/retention', description: 'Get retention info', auth: true, tags: ['Audit'] },
  { method: 'POST', path: '/api/v1/compliance/audit/archive', description: 'Archive old logs', auth: true, tags: ['Audit'] },
  { method: 'GET', path: '/api/v1/compliance/audit/logs', description: 'List audit logs', auth: true, tags: ['Audit'] },

  // Swarm
  { method: 'POST', path: '/api/v1/swarm/run', description: 'Launch swarm task', auth: true, tags: ['Swarm'] },
  { method: 'GET', path: '/api/v1/swarm/tasks', description: 'List swarm tasks', auth: true, tags: ['Swarm'] },
  { method: 'GET', path: '/api/v1/swarm/tasks/:taskId', description: 'Get swarm task details', auth: true, tags: ['Swarm'] },

  // Git
  { method: 'POST', path: '/api/v1/git/push', description: 'Git push workspace', auth: true, tags: ['Git'] },

  // Terminal
  { method: 'POST', path: '/api/v1/terminal/execute', description: 'Execute shell command', auth: true, tags: ['Terminal'] },

  // Metrics & Health
  { method: 'GET', path: '/api/v1/metrics', description: 'Prometheus metrics', auth: false, tags: ['Health'] },
  { method: 'GET', path: '/api/v1/metrics.json', description: 'JSON metrics snapshot', auth: true, tags: ['Health'] },
  { method: 'GET', path: '/api/v1/health/dashboard', description: 'System health dashboard', auth: true, tags: ['Health'] },
  { method: 'GET', path: '/health/live', description: 'Liveness probe', auth: false, tags: ['Health'] },
  { method: 'GET', path: '/health/ready', description: 'Readiness probe', auth: false, tags: ['Health'] },

  // Admin
  { method: 'GET', path: '/api/v1/admin/queues/:name/stats', description: 'Queue stats', auth: true, tags: ['Admin'] },
];

const TAGS = Array.from(new Set(ENDPOINTS.flatMap((e) => e.tags)));

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  POST: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  PATCH: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  DELETE: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export default function ApiDocsPage() {
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null);

  const filtered = ENDPOINTS.filter((e) => {
    const q = search.toLowerCase();
    const matchesSearch = e.path.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
    const matchesTag = !activeTag || e.tags.includes(activeTag);
    return matchesSearch && matchesTag;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-400">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">API Documentation</h3>
            <p className="text-xs text-slate-500">Interactive reference for all Titan endpoints</p>
          </div>
        </div>
      </div>

      {/* Tag filters */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setActiveTag(null)}
          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${!activeTag ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-slate-800/40 text-slate-400 border border-slate-700/30 hover:bg-slate-800'}`}
        >
          All
        </button>
        {TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => setActiveTag(tag === activeTag ? null : tag)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${tag === activeTag ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-slate-800/40 text-slate-400 border border-slate-700/30 hover:bg-slate-800'}`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search endpoints..." className="input pl-9" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* List */}
        <div className="lg:col-span-2 space-y-2 max-h-[600px] overflow-y-auto">
          {filtered.map((e) => (
            <div
              key={e.method + e.path}
              onClick={() => setSelectedEndpoint(e)}
              className={`card p-3 cursor-pointer hover:bg-slate-800/40 transition-colors ${selectedEndpoint?.path === e.path && selectedEndpoint?.method === e.method ? 'ring-1 ring-indigo-500/40' : ''}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${METHOD_COLORS[e.method] ?? 'bg-slate-700 text-slate-400'}`}>{e.method}</span>
                <span className="text-xs font-mono text-slate-300">{e.path}</span>
                {e.auth ? <Lock className="h-3 w-3 text-amber-400" /> : <Globe className="h-3 w-3 text-emerald-400" />}
              </div>
              <p className="text-xs text-slate-500">{e.description}</p>
            </div>
          ))}
        </div>

        {/* Detail */}
        <div className="card space-y-4">
          {selectedEndpoint ? (
            <>
              <div className="flex items-center gap-2 border-b border-slate-800/50 pb-3">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${METHOD_COLORS[selectedEndpoint.method]}`}>
                  {selectedEndpoint.method}
                </span>
                <span className="text-xs font-mono text-white">{selectedEndpoint.path}</span>
              </div>
              <p className="text-sm text-slate-300">{selectedEndpoint.description}</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Auth:</span>
                  <span className={`flex items-center gap-1 ${selectedEndpoint.auth ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {selectedEndpoint.auth ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                    {selectedEndpoint.auth ? 'Required' : 'Public'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Tags:</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedEndpoint.tags.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-800/40 font-mono text-[11px] text-slate-400 space-y-1">
                <div className="text-slate-500"># cURL example</div>
                <div>curl -X {selectedEndpoint.method} \\</div>
                <div>  {window.location.origin}{selectedEndpoint.path} \\</div>
                {selectedEndpoint.auth && (
                  <>
                    <div>  -H "Authorization: Bearer $TOKEN" \\</div>
                    <div>  -H "Content-Type: application/json"</div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <Server className="h-8 w-8 mb-2 text-slate-600" />
              <p className="text-sm">Select an endpoint to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
