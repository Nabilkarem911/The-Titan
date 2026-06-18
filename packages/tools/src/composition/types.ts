export interface PipelineStep {
  toolName: string;
  params: Record<string, unknown>;
  transformOutput?: (output: unknown) => unknown;
  name?: string;
}

export interface PipelineResult {
  success: boolean;
  steps: Array<{
    toolName: string;
    success: boolean;
    output: unknown;
    error?: string;
    durationMs: number;
  }>;
  finalOutput: unknown;
  totalDurationMs: number;
}

export interface CompositeToolDefinition {
  name: string;
  description: string;
  pipeline: PipelineStep[];
  tags?: string[];
}

export interface ConditionalBranch {
  condition: (input: unknown) => boolean;
  toolName: string;
  params: Record<string, unknown>;
}
