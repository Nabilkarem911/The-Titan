import type { LlmProvider, AgentStep, AgentRun } from '../types.js';

export interface CriticResult {
  approved: boolean;
  issues: CriticIssue[];
  suggestions: string[];
  revisedAnswer?: string;
}

export interface CriticIssue {
  severity: 'critical' | 'warning' | 'info';
  description: string;
  stepIndex?: number;
}

export interface ConfidenceScore {
  overall: number;
  dimensions: {
    factualAccuracy: number;
    completeness: number;
    relevance: number;
    coherence: number;
  };
  explanation: string;
}

export interface ErrorAnalysis {
  errorType: 'tool_failure' | 'reasoning_error' | 'context_missing' | 'timeout' | 'unknown';
  rootCause: string;
  suggestedFix: string;
  retryable: boolean;
  adjustedParams?: Record<string, unknown>;
}

export interface RetryStrategy {
  shouldRetry: boolean;
  method: 'same_tool' | 'alternative_tool' | 'rephrase' | 'decompose' | 'skip';
  alternativeTool?: string;
  adjustedPrompt?: string;
  maxAdditionalRetries: number;
}

export interface ReflectionDeps {
  llm: LlmProvider;
}
