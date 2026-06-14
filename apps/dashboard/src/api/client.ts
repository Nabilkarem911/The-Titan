const _env = (import.meta as unknown as { env: Record<string, string> }).env;
const API_BASE = _env.VITE_API_BASE_URL ?? '/api/v1';
const getToken = () => localStorage.getItem('titan_access_token') ?? '';

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

async function fetchJson<T>(path: string, opts?: RequestInit): Promise<T> {
  const makeRequest = (token: string) =>
    fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(opts?.headers ?? {}),
      },
      ...opts,
    });

  let res = await makeRequest(getToken());

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
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
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

  getQueueStats: (queueName: string) =>
    fetchJson<QueueStats>(`/admin/queues/${queueName}/stats`).catch(() => ({
      waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0,
    })),
};
