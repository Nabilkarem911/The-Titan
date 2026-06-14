/**
 * Core types for the Agent Engine (Phase 2).
 *
 * ReAct loop:
 *   Prompt → Plan → Action (tool call) → Observation → Reflect → (repeat or finish)
 */

export type StepStatus = 'pending' | 'planning' | 'executing' | 'observing' | 'reflecting' | 'completed' | 'failed';

export type AgentRunStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed';

export interface ToolCall {
  name: string;
  params: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  latencyMs?: number;
}

export interface AgentStep {
  id: string;
  runId: string;
  index: number; // step number in the run
  status: StepStatus;
  thought?: string; // LLM reasoning
  plan?: string; // what the agent intends to do
  action?: ToolCall; // tool call
  observation?: ToolResult; // tool result
  reflection?: string; // self-correction / analysis
  tokensUsed?: number;
  latencyMs?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentRun {
  id: string;
  agentId: string;
  userId?: string;
  workspaceId?: string;
  apiKeyId?: string;
  prompt: string;
  status: AgentRunStatus;
  maxSteps: number;
  currentStep: number;
  tokenBudget?: number;
  tokensUsed: number;
  forbiddenTools?: readonly string[];
  steps: AgentStep[];
  finalAnswer?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentRunInput {
  runId?: string;
  agentId: string;
  prompt: string;
  userId?: string;
  workspaceId?: string;
  apiKeyId?: string;
  maxSteps?: number;
  tokenBudget?: number;
  forbiddenTools?: readonly string[];
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolResult?: ToolResult;
}

export interface LlmCompletion {
  content: string;
  toolCalls?: ToolCall[];
  tokensUsed: number;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
}

/**
 * Abstraction over any LLM provider (OpenAI, Claude, local, mock).
 */
export interface LlmProvider {
  complete(messages: LlmMessage[], opts?: { maxTokens?: number; temperature?: number }): Promise<LlmCompletion>;
  stream?(messages: LlmMessage[], opts?: { maxTokens?: number }): AsyncGenerator<string>;
}

export interface AgentRule {
  type: 'max_steps' | 'token_budget' | 'forbidden_tools' | 'required_tools' | 'timeout_ms';
  value: unknown;
}

export interface AgentContext {
  run: AgentRun;
  memoryItems?: string[];
  systemPrompt: string;
  rules: AgentRule[];
}
