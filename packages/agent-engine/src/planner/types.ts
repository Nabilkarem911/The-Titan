import type { LlmProvider, ToolCall } from '../types.js';

export interface PlanStep {
  id: string;
  description: string;
  toolHint?: string;
  dependsOn: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  result?: string;
  error?: string;
  retries: number;
}

export interface ExecutionPlan {
  id: string;
  goal: string;
  steps: PlanStep[];
  currentStepIndex: number;
  status: 'draft' | 'active' | 'completed' | 'failed' | 'revised';
  revisionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanRevision {
  reason: string;
  failedStepId: string;
  originalPlan: ExecutionPlan;
  revisedPlan: ExecutionPlan;
  timestamp: Date;
}

export interface TaskDecomposerDeps {
  llm: LlmProvider;
}

export interface PlanValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DependencyNode {
  stepId: string;
  dependsOn: string[];
  dependedBy: string[];
  depth: number;
}
