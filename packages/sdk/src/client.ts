import type {
  TitanClientConfig,
  AuthTokens,
  AgentRunRequest,
  AgentRunResponse,
  ChatResponse,
  SwarmRequest,
  SwarmResponse,
  StreamEvent,
  ApiError,
} from './types.js';
import { parseSSEStream } from './streaming.js';

const DEFAULT_TIMEOUT = 30000;

export class TitanClient {
  private config: TitanClientConfig;
  private tokens?: AuthTokens;

  constructor(config: TitanClientConfig) {
    this.config = {
      timeout: DEFAULT_TIMEOUT,
      ...config,
    };
  }

  // ── Auth ──

  async login(email: string, password: string): Promise<AuthTokens> {
    const data = await this.post<AuthTokens>('/api/v1/auth/login', { email, password });
    this.tokens = data;
    return data;
  }

  async register(email: string, password: string, name?: string): Promise<AuthTokens> {
    const data = await this.post<AuthTokens>('/api/v1/auth/register', { email, password, name });
    this.tokens = data;
    return data;
  }

  async refreshToken(): Promise<AuthTokens> {
    if (!this.tokens?.refreshToken) throw new Error('No refresh token available');
    const data = await this.post<AuthTokens>('/api/v1/auth/refresh', { refreshToken: this.tokens.refreshToken });
    this.tokens = data;
    return data;
  }

  // ── Agents ──

  async runAgent(request: AgentRunRequest): Promise<AgentRunResponse> {
    const agentId = request.agentId ?? 'default';
    return this.post<AgentRunResponse>(`/api/v1/agents/${agentId}/run`, request);
  }

  async *streamAgent(request: AgentRunRequest): AsyncGenerator<StreamEvent> {
    const agentId = request.agentId ?? 'default';
    const response = await this.rawRequest('POST', `/api/v1/agents/${agentId}/stream`, request);
    yield* parseSSEStream(response);
  }

  async getRunStatus(agentId: string, runId: string): Promise<AgentRunResponse> {
    return this.get<AgentRunResponse>(`/api/v1/agents/${agentId}/runs/${runId}`);
  }

  async listRuns(agentId: string): Promise<AgentRunResponse[]> {
    return this.get<AgentRunResponse[]>(`/api/v1/agents/${agentId}/runs`);
  }

  // ── Chat ──

  async chat(message: string, sessionId?: string): Promise<ChatResponse> {
    return this.post<ChatResponse>('/api/v1/chat', { message, sessionId });
  }

  async *streamChat(message: string, sessionId?: string): AsyncGenerator<StreamEvent> {
    const response = await this.rawRequest('POST', '/api/v1/chat/stream', { message, sessionId });
    yield* parseSSEStream(response);
  }

  async getChatHistory(sessionId: string): Promise<Array<{ role: string; content: string }>> {
    return this.get(`/api/v1/chat/history?sessionId=${sessionId}`);
  }

  // ── Swarm ──

  async runSwarm(request: SwarmRequest): Promise<SwarmResponse> {
    return this.post<SwarmResponse>('/api/v1/swarm/run', request);
  }

  async getSwarmStatus(taskId: string): Promise<SwarmResponse> {
    return this.get<SwarmResponse>(`/api/v1/swarm/${taskId}`);
  }

  // ── Files ──

  async uploadFile(file: Blob, filename: string): Promise<{ fileId: string }> {
    const formData = new FormData();
    formData.append('file', file, filename);

    const response = await this.rawRequest('POST', '/api/v1/files/upload', formData, true);
    return response.json() as Promise<{ fileId: string }>;
  }

  async listFiles(): Promise<Array<{ id: string; name: string; size: number }>> {
    return this.get('/api/v1/files');
  }

  // ── Health ──

  async health(): Promise<{ status: string }> {
    return this.get('/api/v1/health/live');
  }

  // ── Internal HTTP ──

  private getAuthHeader(): string | undefined {
    if (this.config.apiKey) return `Bearer ${this.config.apiKey}`;
    if (this.config.token) return `Bearer ${this.config.token}`;
    if (this.tokens?.accessToken) return `Bearer ${this.tokens.accessToken}`;
    return undefined;
  }

  private async rawRequest(method: string, path: string, body?: unknown, isFormData = false): Promise<Response> {
    const headers: Record<string, string> = {};
    const auth = this.getAuthHeader();
    if (auth) headers['Authorization'] = auth;
    if (!isFormData) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method,
      headers,
      body: body
        ? isFormData ? (body as FormData) : JSON.stringify(body)
        : undefined,
      signal: AbortSignal.timeout(this.config.timeout ?? DEFAULT_TIMEOUT),
    });

    if (!response.ok) {
      let error: ApiError;
      try {
        error = await response.json() as ApiError;
      } catch {
        error = { statusCode: response.status, error: response.statusText, message: `HTTP ${response.status}` };
      }
      throw new TitanApiError(error.statusCode, error.message);
    }

    return response;
  }

  private async get<T>(path: string): Promise<T> {
    const response = await this.rawRequest('GET', path);
    return response.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await this.rawRequest('POST', path, body);
    return response.json() as Promise<T>;
  }
}

export class TitanApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'TitanApiError';
  }
}
