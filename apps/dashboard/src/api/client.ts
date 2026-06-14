const API_BASE = ((import.meta as unknown as { env: Record<string, string> }).env.VITE_API_BASE_URL) ?? '/api/v1';

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

async function fetchJson<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(opts?.headers ?? {}),
    },
    ...opts,
  });
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
