import { loadConfig, loadAuth } from '../config.js';

export interface ChatResponse {
  message: string;
  sessionId: string;
  tokensUsed?: number;
}

export interface StreamToken {
  type: 'token' | 'step' | 'tool_call' | 'tool_result' | 'done' | 'error';
  data: unknown;
}

export class ApiClient {
  private baseUrl: string;
  private token: string | null;

  constructor() {
    const config = loadConfig();
    const auth = loadAuth();
    this.baseUrl = config.serverUrl;
    this.token = auth?.accessToken ?? null;
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }

  async login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
    const res = await this.post<{ accessToken: string; refreshToken: string }>('/api/v1/auth/login', { email, password });
    this.token = res.accessToken;
    return res;
  }

  async chat(message: string, sessionId?: string): Promise<ChatResponse> {
    return this.post<ChatResponse>('/api/v1/chat', { message, sessionId });
  }

  async *streamChat(message: string, sessionId?: string): AsyncGenerator<StreamToken> {
    const response = await this.rawFetch('POST', '/api/v1/agents/default/stream', {
      prompt: message,
      sessionId,
      mode: 'agent',
    });

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              yield { type: 'done', data: null };
              return;
            }
            try {
              yield JSON.parse(data) as StreamToken;
            } catch {
              yield { type: 'token', data };
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async runAgent(prompt: string, agentId = 'default', maxSteps?: number): Promise<unknown> {
    return this.post(`/api/v1/agents/${agentId}/run`, { prompt, maxSteps });
  }

  async health(): Promise<{ status: string }> {
    return this.get('/api/v1/health/live');
  }

  async queueStats(): Promise<unknown> {
    return this.get('/api/v1/queues');
  }

  private async rawFetch(method: string, path: string, body?: unknown): Promise<Response> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const err = await response.text().catch(() => `HTTP ${response.status}`);
      throw new Error(`API Error ${response.status}: ${err}`);
    }

    return response;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.rawFetch('GET', path);
    return res.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.rawFetch('POST', path, body);
    return res.json() as Promise<T>;
  }
}
