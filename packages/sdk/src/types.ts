export interface TitanClientConfig {
  baseUrl: string;
  apiKey?: string;
  token?: string;
  timeout?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AgentRunRequest {
  prompt: string;
  agentId?: string;
  maxSteps?: number;
  tokenBudget?: number;
  forbiddenTools?: string[];
  strategy?: 'react' | 'chain-of-thought' | 'tree-of-thought' | 'debate';
}

export interface AgentRunResponse {
  runId: string;
  status: string;
  finalAnswer?: string;
  steps: AgentStepResponse[];
  tokensUsed: number;
}

interface AgentStepResponse {
  id: string;
  index: number;
  status: string;
  thought?: string;
  action?: { name: string; params: Record<string, unknown> };
  observation?: { success: boolean; data?: unknown; error?: string };
  reflection?: string;
  tokensUsed?: number;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  message: string;
  sessionId: string;
  tokensUsed: number;
}

export interface SwarmRequest {
  description: string;
  prompt: string;
  agents?: Array<{ role: string; name: string; description: string; maxSteps?: number }>;
}

export interface SwarmResponse {
  taskId: string;
  status: string;
  finalAnswer?: string;
  subTasks: Array<{ role: string; status: string; result?: string }>;
}

export interface StreamEvent {
  type: 'token' | 'step' | 'tool_call' | 'tool_result' | 'done' | 'error';
  data: unknown;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}
