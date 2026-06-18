const _env = (import.meta as unknown as { env: Record<string, string> }).env;
export const API_BASE = _env.VITE_API_BASE_URL ?? '/api/v1';
export const getToken = () => localStorage.getItem('titan_access_token') ?? '';

/* ── Type definitions ─────────────────────────────────────────────── */

export interface AgentProfile {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  systemPrompt: string;
  allowedTools: string[];
  forbiddenTools: string[];
  maxSteps: number;
  isPublic: boolean;
  ownerId: string;
  createdAt: string;
}

export interface ApiRun {
  id: string;
  agentId: string;
  status: string;
  prompt: string;
  maxSteps: number;
  currentStep: number;
  tokensUsed: number;
  tokenBudget: number | null;
  finalAnswer: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiStep {
  id: string;
  runId: string;
  stepIndex: number;
  status: string;
  thought: string | null;
  plan: string | null;
  actionName: string | null;
  actionParams: Record<string, unknown> | null;
  observationSuccess: boolean | null;
  observationData: unknown;
  observationError: string | null;
  reflection: string | null;
  tokensUsed: number | null;
  latencyMs: number | null;
  createdAt: string;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  agentId: string;
  prompt: string;
  enabled: boolean;
  lastRun: string | null;
  nextRun: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string | null;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  permissions: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface UserKey {
  id: string;
  provider: string;
  label: string;
  maskedKey: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  actor: string;
  target: string | null;
  meta: Record<string, unknown>;
  timestamp: string;
  hash: string;
  previousHash: string | null;
}

/* ── Error handling ───────────────────────────────────────────────── */

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: string,
  ) {
    super(`API ${status}: ${body || statusText}`);
    this.name = 'ApiError';
  }
}

type ErrorHandler = (error: ApiError | Error) => void;
let globalErrorHandler: ErrorHandler | null = null;

export function onApiError(handler: ErrorHandler) {
  globalErrorHandler = handler;
}

/* ── Token refresh ────────────────────────────────────────────────── */

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('titan_refresh_token');
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken: string; refreshToken?: string };
    localStorage.setItem('titan_access_token', data.accessToken);
    if (data.refreshToken) localStorage.setItem('titan_refresh_token', data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

/* ── Core fetch helpers ───────────────────────────────────────────── */

async function fetchJson<T>(path: string, opts?: RequestInit & { _retry?: boolean }): Promise<T> {
  const makeRequest = (token: string) =>
    fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts?.headers ?? {}),
      },
      ...opts,
    });

  let res: Response;
  try {
    res = await makeRequest(getToken());
  } catch (err) {
    if (!opts?._retry) {
      await new Promise((r) => setTimeout(r, 1000));
      return fetchJson<T>(path, { ...opts, _retry: true });
    }
    const netErr = err instanceof Error ? err : new Error('Network error');
    globalErrorHandler?.(netErr);
    throw netErr;
  }

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await makeRequest(newToken);
    } else {
      localStorage.removeItem('titan_access_token');
      localStorage.removeItem('titan_refresh_token');
      window.location.href = '/login';
      throw new Error('Session expired. Redirecting to login...');
    }
  }

  if (!res.ok) {
    const text = await res.text();
    const apiErr = new ApiError(res.status, res.statusText, text);
    globalErrorHandler?.(apiErr);
    throw apiErr;
  }
  return res.json() as Promise<T>;
}

export async function fetchRaw(path: string, opts?: RequestInit): Promise<Response> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
    ...opts,
  });
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return fetch(`${API_BASE}${path}`, {
        headers: {
          Authorization: `Bearer ${newToken}`,
          ...(opts?.headers ?? {}),
        },
        ...opts,
      });
    }
    localStorage.removeItem('titan_access_token');
    localStorage.removeItem('titan_refresh_token');
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  return res;
}

/* ── API methods ──────────────────────────────────────────────────── */

export const api = {
  // Agent Profiles
  listAgentProfiles: () => fetchJson<{ items: AgentProfile[] }>('/agent-profiles'),
  listPublicAgentProfiles: () => fetchJson<{ items: AgentProfile[] }>('/agent-profiles/public'),
  createAgentProfile: (body: Record<string, unknown>) =>
    fetchJson<AgentProfile>('/agent-profiles', { method: 'POST', body: JSON.stringify(body) }),
  updateAgentProfile: (id: string, body: Record<string, unknown>) =>
    fetchJson<AgentProfile>(`/agent-profiles/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteAgentProfile: (id: string) =>
    fetchJson<void>(`/agent-profiles/${id}`, { method: 'DELETE' }),

  // Agent Runs
  triggerRun: (agentId: string, body: { prompt: string; maxSteps?: number }) =>
    fetchJson<{ runId: string; jobId: string }>(`/agents/${agentId}/run`, { method: 'POST', body: JSON.stringify(body) }),
  listRuns: (agentId: string, opts?: { limit?: number; offset?: number }) =>
    fetchJson<{ items: ApiRun[]; total: number }>(`/agents/${agentId}/runs?limit=${opts?.limit ?? 20}&offset=${opts?.offset ?? 0}`),
  getRun: (agentId: string, runId: string) =>
    fetchJson<ApiRun>(`/agents/${agentId}/runs/${runId}`),
  getSteps: (agentId: string, runId: string) =>
    fetchJson<{ items: ApiStep[]; total: number }>(`/agents/${agentId}/runs/${runId}/steps`),

  // Queue
  getQueueStats: (name: string) =>
    fetchJson<QueueStats>(`/admin/queues/${name}/stats`),

  // Cron
  listCron: () => fetchJson<{ items: CronJob[]; total: number }>('/cron'),
  createCron: (body: Record<string, unknown>) =>
    fetchJson<CronJob>('/cron', { method: 'POST', body: JSON.stringify(body) }),
  getCron: (id: string) => fetchJson<CronJob>(`/cron/${id}`),
  updateCron: (id: string, body: Record<string, unknown>) =>
    fetchJson<CronJob>(`/cron/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteCron: (id: string) =>
    fetchJson<void>(`/cron/${id}`, { method: 'DELETE' }),

  // Webhooks
  listWebhooks: () => fetchJson<{ items: Webhook[] }>('/webhooks'),
  createWebhook: (body: Record<string, unknown>) =>
    fetchJson<Webhook>('/webhooks', { method: 'POST', body: JSON.stringify(body) }),
  getWebhook: (id: string) => fetchJson<Webhook>(`/webhooks/${id}`),
  updateWebhook: (id: string, body: Record<string, unknown>) =>
    fetchJson<Webhook>(`/webhooks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteWebhook: (id: string) =>
    fetchJson<void>(`/webhooks/${id}`, { method: 'DELETE' }),
  rotateWebhookSecret: (id: string) =>
    fetchJson<{ secret: string }>(`/webhooks/${id}/rotate-secret`, { method: 'POST' }),
  getWebhookDeliveries: (id: string) =>
    fetchJson<{ items: Array<Record<string, unknown>> }>(`/webhooks/${id}/deliveries`),

  // Plugins
  listPlugins: () => fetchJson<{ items: Plugin[] }>('/plugins'),
  getPlugin: (id: string) => fetchJson<Plugin>(`/plugins/${id}`),
  installPlugin: (body: Record<string, unknown>) =>
    fetchJson<Plugin>('/plugins', { method: 'POST', body: JSON.stringify(body) }),
  deletePlugin: (id: string) =>
    fetchJson<void>(`/plugins/${id}`, { method: 'DELETE' }),

  // API Keys
  listApiKeys: () => fetchJson<{ items: ApiKey[] }>('/api-keys'),
  createApiKey: (body: Record<string, unknown>) =>
    fetchJson<ApiKey & { key: string }>('/api-keys', { method: 'POST', body: JSON.stringify(body) }),
  deleteApiKey: (id: string) =>
    fetchJson<void>(`/api-keys/${id}`, { method: 'DELETE' }),

  // User Keys (provider secrets)
  listUserKeys: () => fetchJson<{ items: UserKey[] }>('/user/keys'),
  createUserKey: (body: Record<string, unknown>) =>
    fetchJson<UserKey>('/user/keys', { method: 'POST', body: JSON.stringify(body) }),
  deleteUserKey: (id: string) =>
    fetchJson<void>(`/user/keys/${id}`, { method: 'DELETE' }),

  // Git
  gitPush: (body: Record<string, unknown>) =>
    fetchJson<{ success: boolean; message: string; details: Array<{ command: string; stdout: string; stderr: string; exitCode: number }> }>(
      '/git/push',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  // Swarm
  runSwarm: (body: Record<string, unknown>) =>
    fetchJson<{ taskId: string }>('/swarm/run', { method: 'POST', body: JSON.stringify(body) }),
  listSwarmTasks: () =>
    fetchJson<{ items: Array<Record<string, unknown>> }>('/swarm/tasks'),
  getSwarmTask: (id: string) =>
    fetchJson<Record<string, unknown>>(`/swarm/tasks/${id}`),

  // Workspaces
  listWorkspaces: () => fetchJson<{ items: Workspace[] }>('/workspaces'),
  createWorkspace: (body: Record<string, unknown>) =>
    fetchJson<Workspace>('/workspaces', { method: 'POST', body: JSON.stringify(body) }),
  getWorkspace: (id: string) => fetchJson<Workspace>(`/workspaces/${id}`),
  updateWorkspace: (id: string, body: Record<string, unknown>) =>
    fetchJson<Workspace>(`/workspaces/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteWorkspace: (id: string) =>
    fetchJson<void>(`/workspaces/${id}`, { method: 'DELETE' }),
  getWorkspaceMembers: (id: string) =>
    fetchJson<{ items: Array<Record<string, unknown>> }>(`/workspaces/${id}/members`),
  addWorkspaceMember: (id: string, body: Record<string, unknown>) =>
    fetchJson<void>(`/workspaces/${id}/members`, { method: 'POST', body: JSON.stringify(body) }),
  removeWorkspaceMember: (wsId: string, userId: string) =>
    fetchJson<void>(`/workspaces/${wsId}/members/${userId}`, { method: 'DELETE' }),

  // Auth
  getMe: () =>
    fetchJson<{ userId: string; sessionId: string; permissions: string[] }>('/auth/me'),

  // Compliance / Audit
  getAuditLogs: (params?: string) =>
    fetchJson<{ items: AuditLog[] }>(`/compliance/audit/logs${params ? `?${params}` : ''}`),
  verifyAuditChain: () =>
    fetchJson<{ valid: boolean; brokenAt: string | null; checked: number }>('/compliance/audit/verify'),
  getAuditRetention: () =>
    fetchJson<{ count: number; oldest: string | null; newest: string | null; archiveCount: number }>('/compliance/audit/retention'),
  archiveAuditLogs: (body: Record<string, unknown>) =>
    fetchJson<{ archived: number }>('/compliance/audit/archive', { method: 'POST', body: JSON.stringify(body) }),

  // Files
  listFiles: (path = '/') =>
    fetchJson<{ items: Array<{ name: string; type: string; size: number; modified: string }> }>(`/files?path=${encodeURIComponent(path)}`),
  uploadFile: (path: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return fetchRaw(`/files/upload?path=${encodeURIComponent(path)}`, {
      method: 'POST',
      body: form,
    });
  },
  deleteFile: (path: string) =>
    fetchJson<void>(`/files?path=${encodeURIComponent(path)}`, { method: 'DELETE' }),

  // Logs
  getLogs: (opts?: { limit?: number; offset?: number; level?: string }) =>
    fetchJson<{ items: Array<Record<string, unknown>>; total: number }>(
      `/logs?limit=${opts?.limit ?? 50}&offset=${opts?.offset ?? 0}${opts?.level ? `&level=${opts.level}` : ''}`,
    ),

  // Settings
  getSettings: () => fetchJson<Record<string, unknown>>('/settings'),
  updateSettings: (body: Record<string, unknown>) =>
    fetchJson<Record<string, unknown>>('/settings', { method: 'PATCH', body: JSON.stringify(body) }),
};
