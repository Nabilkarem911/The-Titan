import { getLogger } from '@titan/logging';
import type { PipelineStep, PipelineResult } from './types.js';

const log = getLogger().child({ component: 'tool-pipe' });

export type ToolExecutor = (name: string, params: unknown) => Promise<{ success: boolean; data?: unknown; error?: string }>;

export class ToolPipeline {
  private steps: PipelineStep[] = [];
  private executor: ToolExecutor;

  constructor(executor: ToolExecutor) {
    this.executor = executor;
  }

  pipe(toolName: string, params: Record<string, unknown>, transform?: (output: unknown) => unknown): this {
    this.steps.push({ toolName, params, transformOutput: transform });
    return this;
  }

  async run(initialInput?: unknown): Promise<PipelineResult> {
    const stepResults: PipelineResult['steps'] = [];
    let currentInput = initialInput;
    const totalStart = performance.now();

    for (const step of this.steps) {
      const start = performance.now();

      const resolvedParams = this.resolveParams(step.params, currentInput);
      const result = await this.executor(step.toolName, resolvedParams);
      const durationMs = Math.round(performance.now() - start);

      if (!result.success) {
        stepResults.push({ toolName: step.toolName, success: false, output: null, error: result.error, durationMs });
        log.warn({ tool: step.toolName, error: result.error }, 'pipeline step failed');

        return {
          success: false,
          steps: stepResults,
          finalOutput: null,
          totalDurationMs: Math.round(performance.now() - totalStart),
        };
      }

      let output = result.data;
      if (step.transformOutput) {
        try {
          output = step.transformOutput(output);
        } catch (err) {
          const error = err instanceof Error ? err.message : 'Transform failed';
          stepResults.push({ toolName: step.toolName, success: false, output: null, error, durationMs });
          return { success: false, steps: stepResults, finalOutput: null, totalDurationMs: Math.round(performance.now() - totalStart) };
        }
      }

      stepResults.push({ toolName: step.toolName, success: true, output, durationMs });
      currentInput = output;
    }

    log.info({ steps: this.steps.length, durationMs: Math.round(performance.now() - totalStart) }, 'pipeline completed');

    return {
      success: true,
      steps: stepResults,
      finalOutput: currentInput,
      totalDurationMs: Math.round(performance.now() - totalStart),
    };
  }

  private resolveParams(params: Record<string, unknown>, input: unknown): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(params)) {
      if (val === '$input') {
        resolved[key] = typeof input === 'string' ? input : JSON.stringify(input);
      } else if (typeof val === 'string' && val.startsWith('$input.')) {
        const path = val.slice(7);
        resolved[key] = input && typeof input === 'object' ? (input as Record<string, unknown>)[path] : val;
      } else {
        resolved[key] = val;
      }
    }
    return resolved;
  }
}

export function pipe(executor: ToolExecutor): ToolPipeline {
  return new ToolPipeline(executor);
}
