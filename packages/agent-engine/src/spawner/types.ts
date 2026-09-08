import type { AgentRun, LlmToolDefinition } from '../types.js';

type SpawnMode = 'foreground' | 'background';
type ChildStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SpawnRequest {
  name: string;
  prompt: string;
  systemPrompt?: string;
  tools?: LlmToolDefinition[];
  allowedTools?: string[];
  forbiddenTools?: string[];
  maxSteps?: number;
  mode: SpawnMode;
  parentId: string;
  priority?: number;
  timeout?: number;
  onProgress?: (update: ChildUpdate) => void;
}

export interface ChildAgent {
  id: string;
  name: string;
  parentId: string;
  status: ChildStatus;
  mode: SpawnMode;
  prompt: string;
  result?: string;
  error?: string;
  run?: AgentRun;
  tokensUsed: number;
  startedAt: Date;
  completedAt?: Date;
}

export interface ChildUpdate {
  childId: string;
  type: 'started' | 'step' | 'tool_call' | 'completed' | 'failed';
  data?: unknown;
  timestamp: Date;
}

export interface AggregatedResult {
  parentId: string;
  children: Array<{ id: string; name: string; status: ChildStatus; result?: string }>;
  synthesis?: string;
  totalTokens: number;
  totalDurationMs: number;
  allSucceeded: boolean;
}

export interface AgentPoolConfig {
  maxConcurrent: number;
  maxQueueSize: number;
  defaultTimeout: number;
  warmPoolSize: number;
}

export interface DynamicAgentSpec {
  role: string;
  goal: string;
  requiredCapabilities: string[];
  context?: string;
}
