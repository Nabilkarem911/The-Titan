export interface BenchmarkCase {
  id: string;
  prompt: string;
  expectedAnswer?: string;
  expectedToolUse?: string[];
  category: 'accuracy' | 'tool_use' | 'planning' | 'safety';
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface EvalResult {
  caseId: string;
  passed: boolean;
  score: number;
  actualAnswer?: string;
  actualToolsUsed?: string[];
  details: string;
  durationMs: number;
  tokensUsed: number;
}

export interface EvalReport {
  runId: string;
  timestamp: Date;
  totalCases: number;
  passed: number;
  failed: number;
  averageScore: number;
  byCategory: Record<string, { total: number; passed: number; avgScore: number }>;
  results: EvalResult[];
  durationMs: number;
}

export interface CostEntry {
  runId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface CostReport {
  period: { from: Date; to: Date };
  totalCost: number;
  totalTokens: number;
  byModel: Record<string, { cost: number; tokens: number; calls: number }>;
  entries: number;
}

export interface TraceSpan {
  id: string;
  parentId?: string;
  name: string;
  type: 'llm_call' | 'tool_call' | 'memory_access' | 'planning' | 'reflection' | 'custom';
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
  status: 'running' | 'completed' | 'failed';
}

export interface Trace {
  id: string;
  runId: string;
  spans: TraceSpan[];
  startTime: Date;
  endTime?: Date;
  totalDurationMs?: number;
}
