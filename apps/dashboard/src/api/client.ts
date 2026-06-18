const _env = (import.meta as unknown as { env: Record<string, string> }).env;
export const API_BASE = _env.VITE_API_BASE_URL ?? '/api/v1';
export const getToken = () => localStorage.getItem('titan_access_token') ?? '';

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
    const data = await res.json() as { accessToken: string; refreshToken?: string };
    localStorage.setItem('titan_access_token', data.accessToken);
    if (data.refreshToken) localStorage.setItem('titan_refresh_token', data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

async function fetchJson<T>(path: string, opts?: RequestInit & { _retry?: boolean }): Promise<T> {
  const makeRequest = (token: string) =>
    fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
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
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
    ...opts,
  });
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return fetch(`${API_BASE}${path}`, {
        headers: {
          'Authorization': `Bearer ${newToken}`,
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

export const api = {
  // Agent runs
  triggerRun: (agentId: string, body: { prompt: string; maxSteps?: number; tokenBudget?: number; forbiddenTools?: string[] }) =>
    fetchJson<{ runId: string; jobId: string; status: string; createdAt: string }>(`/agents/${agentId}/run`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listRuns: (agentId: string, opts?: { limit?: number; offset?: number }) =>
    fetchJson<{ items: ApiRun[]; total: number }>(`/agents/${agentId}/runs?limit=${opts?.limit ?? 20}&offset=${opts?.offset ?? 0}`),

  getRun: (agentId: string, runId: string) =>
    fetchJson<ApiRun>(`/agents/${agentId}/runs/${runId}`),

  getSteps: (agentId: string, runId: string) =>
    fetchJson<{ items: ApiStep[]; total: number }>(`/agents/${agentId}/runs/${runId}/steps`),

  // Queues
  getQueueStats: (queueName: string) =>
    fetchJson<QueueStats>(`/admin/queues/${queueName}/stats`),

  // Agent profiles
  listAgentProfiles: () =>
    fetchJson<{ items: AgentProfile[] }>('/agent-profiles'),

  listPublicAgentProfiles: () =>
    fetchJson<{ items: AgentProfile[] }>('/agent-profiles/public'),

  createAgentProfile: (body: Record<string, unknown>) =>
    fetchJson<AgentProfile>('/agent-profiles', { method: 'POST', body: JSON.stringify(body) }),

  updateAgentProfile: (id: string, body: Record<string, unknown>) =>
    fetchJson<AgentProfile>(`/agent-profiles/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  deleteAgentProfile: (id: string) =>
    fetchJson<Record<string, never>>(`/agent-profiles/${id}`, { method: 'DELETE' }),

  // Health
  getHealth: () =>
    fetchJson<Record<string, unknown>>('/health/dashboard'),

  // Metrics
  getMetrics: () =>
    fetchJson<Record<string, unknown>>('/metrics'),

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
    fetchJson<Record<string, never>>(`/files?path=${encodeURIComponent(path)}`, { method: 'DELETE' }),

  // Cron
  listCron: () =>
    fetchJson<{ items: Array<Record<string, unknown>>; total: number }>('/cron'),

  createCron: (body: Record<string, unknown>) =>
    fetchJson<Record<string, unknown>>('/cron', { method: 'POST', body: JSON.stringify(body) }),

  deleteCron: (id: string) =>
    fetchJson<Record<string, never>>(`/cron/${id}`, { method: 'DELETE' }),

  // Logs
  getLogs: (opts?: { limit?: number; offset?: number; level?: string }) =>
    fetchJson<{ items: Array<Record<string, unknown>>; total: number }>(
      `/logs?limit=${opts?.limit ?? 50}&offset=${opts?.offset ?? 0}${opts?.level ? `&level=${opts.level}` : ''}`,
    ),

  // Webhooks
  listWebhooks: () =>
    fetchJson<{ items: Array<Record<string, unknown>> }>('/webhooks'),

  createWebhook: (body: Record<string, unknown>) =>
    fetchJson<Record<string, unknown>>('/webhooks', { method: 'POST', body: JSON.stringify(body) }),

  deleteWebhook: (id: string) =>
    fetchJson<Record<string, never>>(`/webhooks/${id}`, { method: 'DELETE' }),

  // Settings
  getSettings: () =>
    fetchJson<Record<string, unknown>>('/settings'),

  updateSettings: (body: Record<string, unknown>) =>
    fetchJson<Record<string, unknown>>('/settings', { method: 'PATCH', body: JSON.stringify(body) }),

  // API Keys
  listApiKeys: () =>
    fetchJson<{ items: Array<Record<string, unknown>> }>('/api-keys'),

  createApiKey: (body: Record<string, unknown>) =>
    fetchJson<Record<string, unknown>>('/api-keys', { method: 'POST', body: JSON.stringify(body) }),

  deleteApiKey: (id: string) =>
    fetchJson<Record<string, never>>(`/api-keys/${id}`, { method: 'DELETE' }),

  // Audit Logs
  getAuditLogs: (opts?: { limit?: number; offset?: number }) =>
    fetchJson<{ items: Array<Record<string, unknown>>; total: number }>(
      `/audit?limit=${opts?.limit ?? 50}&offset=${opts?.offset ?? 0}`,
    ),

  // Analytics
  getAnalytics: (type = 'tokens') =>
    fetchJson<Record<string, unknown>>(`/analytics/${type}`),

  // Git
  getGitStatus: () =>
    fetchJson<Record<string, unknown>>('/git/status'),

  gitPush: (body: Record<string, unknown>) =>
    fetchJson<Record<string, unknown>>('/git/push', { method: 'POST', body: JSON.stringify(body) }),

  // Search
  search: (query: string) =>
    fetchJson<{ items: Array<Record<string, unknown>> }>(`/search?q=${encodeURIComponent(query)}`),

  // Integrations
  listIntegrations: () =>
    fetchJson<{ items: Array<Record<string, unknown>> }>('/integrations'),

  // Plugins
  listPlugins: () =>
    fetchJson<{ items: Array<Record<string, unknown>> }>('/plugins'),

  installPlugin: (body: Record<string, unknown>) =>
    fetchJson<Record<string, unknown>>('/plugins', { method: 'POST', body: JSON.stringify(body) }),

  // Teams
  listTeams: () =>
    fetchJson<{ items: Array<Record<string, unknown>> }>('/teams'),

  // Templates
  listTemplates: () =>
    fetchJson<{ items: Array<Record<string, unknown>> }>('/templates'),

  // Projects
  listProjects: () =>
    fetchJson<{ items: Array<Record<string, unknown>> }>('/projects'),

  createProject: (body: Record<string, unknown>) =>
    fetchJson<Record<string, unknown>>('/projects', { method: 'POST', body: JSON.stringify(body) }),

  // User Profile
  getProfile: () =>
    fetchJson<Record<string, unknown>>('/user/profile'),

  updateProfile: (body: Record<string, unknown>) =>
    fetchJson<Record<string, unknown>>('/user/profile', { method: 'PATCH', body: JSON.stringify(body) }),

  // Marketplace
  getMarketplace: () =>
    fetchJson<{ items: Array<Record<string, unknown>> }>('/marketplace'),

  // Notifications
  listNotifications: () =>
    fetchJson<{ items: Array<Record<string, unknown>> }>('/notifications'),

  // Memory
  listMemories: () =>
    fetchJson<{ items: Array<Record<string, unknown>> }>('/memory'),

  // Swarm
  listSwarms: () =>
    fetchJson<{ items: Array<Record<string, unknown>> }>('/swarm'),
};
