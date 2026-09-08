import type {
  LlmProvider,
  LlmToolDefinition,
  AgentRun,
  AgentStep,
  ToolCall,
  ToolResult,
} from '../types.js';
import type { ContextOptimizer } from '../providers/context-optimizer.js';

export type StrategyName = 'react' | 'chain-of-thought' | 'tree-of-thought' | 'debate' | 'hypothesis-testing';

export interface StrategyResult {
  steps: AgentStep[];
  finalAnswer?: string;
  tokensUsed: number;
  strategyUsed: StrategyName;
  metadata?: Record<string, unknown>;
}

export interface ReasoningStrategy {
  name: StrategyName;
  execute(ctx: StrategyContext): Promise<StrategyResult>;
}

export interface StrategyContext {
  run: AgentRun;
  systemPrompt: string;
  memoryItems?: string[];
  tools: LlmToolDefinition[];
  llm: LlmProvider;
  executeTool: (call: ToolCall, runId: string) => Promise<ToolResult>;
  onStep?: (step: AgentStep) => Promise<void>;
  contextOptimizer?: ContextOptimizer;
}

export interface ThoughtBranch {
  id: string;
  parentId?: string;
  thought: string;
  score: number;
  depth: number;
  children: ThoughtBranch[];
  isTerminal: boolean;
  answer?: string;
}

export interface DebatePerspective {
  role: string;
  position: string;
  arguments: string[];
  confidence: number;
}

export interface DebateRound {
  roundNumber: number;
  perspectives: DebatePerspective[];
  consensus?: string;
}

export interface TaskClassification {
  type: 'simple_qa' | 'complex_reasoning' | 'creative' | 'analytical' | 'multi_step' | 'controversial' | 'debugging' | 'ambiguous' | 'code_review';
  confidence: number;
  recommendedStrategy: StrategyName;
  reasoning: string;
}
