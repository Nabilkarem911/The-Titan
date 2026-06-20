// ── Titan API Client ──────────────────────────────────────────────────────────

export type {
  AgentProfile, ApiRun, ApiStep, QueueStats, QueueJob, CronJob, Webhook,
  Plugin, ApiKey, UserKey, Workspace, WorkspaceMember, AuditLog, FileEntry,
  ChatMessage, HealthStatus, MetricsData, GitRepo, MemoryEntry, SwarmConfig,
  LogEntry, PaginatedResponse, Settings,
} from './types.js';

import type {
  AgentProfile, ApiRun, QueueStats, QueueJob, CronJob, Webhook,
  Plugin, ApiKey, UserKey, Workspace, WorkspaceMember, AuditLog, FileEntry,
  ChatMessage, HealthStatus, MetricsData, GitRepo, MemoryEntry, SwarmConfig,
  LogEntry, PaginatedResponse, Settings,
} from './types.js';

const API_BASE = (import.meta as unknown as Record<string, Record<string, string>>).env?.VITE_API_BASE || '/api/v1';

function getToken(): string | null {
  return localStorage.getItem('titan_token');
}

function setToken(token: string): void {
  localStorage.setItem('titan_token', token);
}

function getRefreshToken(): string | null {
  return localStorage.getItem('titan_refresh_token');
}

// ── Error class ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Global error handler ─────────────────────────────────────────────────────

type ErrorHandler = (error: ApiError) => void;
let _onApiError: ErrorHandler | null = null;

export function onApiError(handler: ErrorHandler): void {
  _onApiError = handler;
}

// ── Token refresh ────────────────────────────────────────────────────────────

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refresh = getRefreshToken();
    if (!refresh) throw new ApiError(401, 'No refresh token');

    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });

    if (!res.ok) {
      localStorage.removeItem('titan_token');
      localStorage.removeItem('titan_refresh_token');
      throw new ApiError(res.status, 'Token refresh failed');
    }

    const data = await res.json();
    setToken(data.access_token);
    if (data.refresh_token) {
      localStorage.setItem('titan_refresh_token', data.refresh_token);
    }
    return data.access_token as string;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

// ── Core fetch ───────────────────────────────────────────────────────────────

async function fetchJson<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && retry) {
    try {
      const newToken = await refreshAccessToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      const retryRes = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      });
      if (!retryRes.ok) {
        const error = new ApiError(retryRes.status, `API error: ${retryRes.statusText}`);
        _onApiError?.(error);
        throw error;
      }
      return retryRes.json();
    } catch (err) {
      if (err instanceof ApiError) {
        _onApiError?.(err);
        throw err;
      }
      const error = new ApiError(401, 'Authentication failed');
      _onApiError?.(error);
      throw error;
    }
  }

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    const msg = typeof body === 'object' && body !== null && 'message' in body
      ? (body as { message: string }).message
      : `API error: ${res.statusText}`;
    const error = new ApiError(res.status, msg, body);
    _onApiError?.(error);
    throw error;
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function fetchRaw(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = new ApiError(res.status, `API error: ${res.statusText}`);
    _onApiError?.(error);
    throw error;
  }

  return res;
}

// ── API Methods ──────────────────────────────────────────────────────────────

export const api = {
  // Auth
  login: (credentials: { username: string; password: string }) =>
    fetchJson<{ access_token: string; refresh_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  logout: () => fetchJson<void>('/auth/logout', { method: 'POST' }),

  getProfile: () => fetchJson<{ id: string; username: string; email: string; role: string }>('/auth/profile'),

  // Agents
  getAgents: () => fetchJson<AgentProfile[]>('/agents'),
  getAgent: (id: string) => fetchJson<AgentProfile>(`/agents/${id}`),
  createAgent: (data: Partial<AgentProfile>) =>
    fetchJson<AgentProfile>('/agents', { method: 'POST', body: JSON.stringify(data) }),
  updateAgent: (id: string, data: Partial<AgentProfile>) =>
    fetchJson<AgentProfile>(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAgent: (id: string) =>
    fetchJson<void>(`/agents/${id}`, { method: 'DELETE' }),

  // Runs
  getRuns: (params?: { agent_id?: string; status?: string; page?: number; per_page?: number }) => {
    const query = new URLSearchParams();
    if (params?.agent_id) query.set('agent_id', params.agent_id);
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    if (params?.per_page) query.set('per_page', String(params.per_page));
    const qs = query.toString();
    return fetchJson<PaginatedResponse<ApiRun>>(`/runs${qs ? `?${qs}` : ''}`);
  },
  getRun: (id: string) => fetchJson<ApiRun>(`/runs/${id}`),
  createRun: (data: { agent_id: string; input: string }) =>
    fetchJson<ApiRun>('/runs', { method: 'POST', body: JSON.stringify(data) }),
  cancelRun: (id: string) =>
    fetchJson<void>(`/runs/${id}/cancel`, { method: 'POST' }),

  // Chat
  sendMessage: (agentId: string, message: string, conversationId?: string) =>
    fetchJson<{ message: ChatMessage; conversation_id: string }>('/chat', {
      method: 'POST',
      body: JSON.stringify({ agent_id: agentId, message, conversation_id: conversationId }),
    }),
  getChatHistory: (conversationId: string) =>
    fetchJson<ChatMessage[]>(`/chat/${conversationId}`),

  streamChat: (agentId: string, message: string, conversationId?: string): EventSource => {
    const token = getToken();
    const params = new URLSearchParams({
      agent_id: agentId,
      message,
      ...(conversationId ? { conversation_id: conversationId } : {}),
      ...(token ? { token } : {}),
    });
    return new EventSource(`${API_BASE}/chat/stream?${params}`);
  },

  // Queue
  getQueueStats: () => fetchJson<QueueStats>('/queue/stats'),
  getQueueJobs: (status?: string) => {
    const qs = status ? `?status=${status}` : '';
    return fetchJson<QueueJob[]>(`/queue/jobs${qs}`);
  },
  retryJob: (id: string) =>
    fetchJson<void>(`/queue/jobs/${id}/retry`, { method: 'POST' }),
  cancelJob: (id: string) =>
    fetchJson<void>(`/queue/jobs/${id}/cancel`, { method: 'POST' }),

  // Cron
  getCronJobs: () => fetchJson<CronJob[]>('/cron'),
  createCronJob: (data: Partial<CronJob>) =>
    fetchJson<CronJob>('/cron', { method: 'POST', body: JSON.stringify(data) }),
  updateCronJob: (id: string, data: Partial<CronJob>) =>
    fetchJson<CronJob>(`/cron/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCronJob: (id: string) =>
    fetchJson<void>(`/cron/${id}`, { method: 'DELETE' }),
  toggleCronJob: (id: string, enabled: boolean) =>
    fetchJson<CronJob>(`/cron/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),

  // Webhooks
  getWebhooks: () => fetchJson<Webhook[]>('/webhooks'),
  createWebhook: (data: Partial<Webhook>) =>
    fetchJson<Webhook>('/webhooks', { method: 'POST', body: JSON.stringify(data) }),
  updateWebhook: (id: string, data: Partial<Webhook>) =>
    fetchJson<Webhook>(`/webhooks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWebhook: (id: string) =>
    fetchJson<void>(`/webhooks/${id}`, { method: 'DELETE' }),
  testWebhook: (id: string) =>
    fetchJson<{ success: boolean; status_code: number }>(`/webhooks/${id}/test`, { method: 'POST' }),

  // Plugins
  getPlugins: () => fetchJson<Plugin[]>('/plugins'),
  installPlugin: (data: { name: string; version?: string }) =>
    fetchJson<Plugin>('/plugins/install', { method: 'POST', body: JSON.stringify(data) }),
  uninstallPlugin: (id: string) =>
    fetchJson<void>(`/plugins/${id}`, { method: 'DELETE' }),
  togglePlugin: (id: string, enabled: boolean) =>
    fetchJson<Plugin>(`/plugins/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),

  // API Keys
  getApiKeys: () => fetchJson<ApiKey[]>('/api-keys'),
  createApiKey: (data: { name: string; permissions: string[] }) =>
    fetchJson<ApiKey & { key: string }>('/api-keys', { method: 'POST', body: JSON.stringify(data) }),
  deleteApiKey: (id: string) =>
    fetchJson<void>(`/api-keys/${id}`, { method: 'DELETE' }),

  // User Keys (provider API keys)
  getUserKeys: () => fetchJson<UserKey[]>('/user-keys'),
  setUserKey: (provider: string, key: string) =>
    fetchJson<UserKey>('/user-keys', { method: 'POST', body: JSON.stringify({ provider, key }) }),
  deleteUserKey: (id: string) =>
    fetchJson<void>(`/user-keys/${id}`, { method: 'DELETE' }),

  // Files
  listFiles: (path?: string) => {
    const qs = path ? `?path=${encodeURIComponent(path)}` : '';
    return fetchJson<FileEntry[]>(`/files${qs}`);
  },
  readFile: (path: string) =>
    fetchJson<{ content: string; mime_type: string }>(`/files/read?path=${encodeURIComponent(path)}`),
  writeFile: (path: string, content: string) =>
    fetchJson<void>('/files/write', { method: 'POST', body: JSON.stringify({ path, content }) }),
  deleteFile: (path: string) =>
    fetchJson<void>(`/files?path=${encodeURIComponent(path)}`, { method: 'DELETE' }),
  uploadFile: (path: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);
    return fetchRaw('/files/upload', { method: 'POST', body: formData });
  },

  // Health
  getHealth: () => fetchJson<HealthStatus>('/health'),

  // Metrics
  getMetrics: () => fetchJson<MetricsData>('/metrics'),
  getMetricsHistory: (period: string) =>
    fetchJson<Array<MetricsData & { timestamp: string }>>(`/metrics/history?period=${period}`),

  // Logs
  getLogs: (params?: { level?: string; source?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.level) query.set('level', params.level);
    if (params?.source) query.set('source', params.source);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return fetchJson<LogEntry[]>(`/logs${qs ? `?${qs}` : ''}`);
  },

  // Settings
  getSettings: () => fetchJson<Settings>('/settings'),
  updateSettings: (data: Partial<Settings>) =>
    fetchJson<Settings>('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Audit Logs
  getAuditLogs: (params?: { page?: number; per_page?: number; action?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.per_page) query.set('per_page', String(params.per_page));
    if (params?.action) query.set('action', params.action);
    const qs = query.toString();
    return fetchJson<PaginatedResponse<AuditLog>>(`/audit-logs${qs ? `?${qs}` : ''}`);
  },

  // Workspaces
  getWorkspaces: () => fetchJson<Workspace[]>('/workspaces'),
  getWorkspace: (id: string) => fetchJson<Workspace>(`/workspaces/${id}`),
  createWorkspace: (data: Partial<Workspace>) =>
    fetchJson<Workspace>('/workspaces', { method: 'POST', body: JSON.stringify(data) }),
  updateWorkspace: (id: string, data: Partial<Workspace>) =>
    fetchJson<Workspace>(`/workspaces/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWorkspace: (id: string) =>
    fetchJson<void>(`/workspaces/${id}`, { method: 'DELETE' }),
  getWorkspaceMembers: (id: string) =>
    fetchJson<WorkspaceMember[]>(`/workspaces/${id}/members`),
  addWorkspaceMember: (id: string, data: { email: string; role: string }) =>
    fetchJson<WorkspaceMember>(`/workspaces/${id}/members`, { method: 'POST', body: JSON.stringify(data) }),
  removeWorkspaceMember: (workspaceId: string, memberId: string) =>
    fetchJson<void>(`/workspaces/${workspaceId}/members/${memberId}`, { method: 'DELETE' }),

  // Git
  getRepos: () => fetchJson<GitRepo[]>('/git/repos'),
  getRepoStatus: (name: string) => fetchJson<GitRepo>(`/git/repos/${name}`),
  gitPull: (name: string) =>
    fetchJson<{ message: string }>(`/git/repos/${name}/pull`, { method: 'POST' }),
  gitPush: (name: string) =>
    fetchJson<{ message: string }>(`/git/repos/${name}/push`, { method: 'POST' }),

  // Swarm
  getSwarms: () => fetchJson<SwarmConfig[]>('/swarms'),
  getSwarm: (id: string) => fetchJson<SwarmConfig>(`/swarms/${id}`),
  createSwarm: (data: Partial<SwarmConfig>) =>
    fetchJson<SwarmConfig>('/swarms', { method: 'POST', body: JSON.stringify(data) }),
  updateSwarm: (id: string, data: Partial<SwarmConfig>) =>
    fetchJson<SwarmConfig>(`/swarms/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSwarm: (id: string) =>
    fetchJson<void>(`/swarms/${id}`, { method: 'DELETE' }),
  runSwarm: (id: string, input: string) =>
    fetchJson<ApiRun>(`/swarms/${id}/run`, { method: 'POST', body: JSON.stringify({ input }) }),

  // Memory
  getMemories: (namespace?: string) => {
    const qs = namespace ? `?namespace=${encodeURIComponent(namespace)}` : '';
    return fetchJson<MemoryEntry[]>(`/memory${qs}`);
  },
  setMemory: (data: { key: string; value: string; namespace?: string }) =>
    fetchJson<MemoryEntry>('/memory', { method: 'POST', body: JSON.stringify(data) }),
  deleteMemory: (id: string) =>
    fetchJson<void>(`/memory/${id}`, { method: 'DELETE' }),
  searchMemory: (query: string) =>
    fetchJson<MemoryEntry[]>(`/memory/search?q=${encodeURIComponent(query)}`),
};
