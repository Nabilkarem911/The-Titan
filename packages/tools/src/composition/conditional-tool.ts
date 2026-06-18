import { getLogger } from '@titan/logging';
import type { ToolExecutor } from './pipe.js';
import type { ConditionalBranch } from './types.js';

const log = getLogger().child({ component: 'tool-conditional' });

export interface ConditionalResult {
  branchTaken: string;
  success: boolean;
  output: unknown;
  error?: string;
  durationMs: number;
}

export async function conditionalExec(
  executor: ToolExecutor,
  input: unknown,
  branches: ConditionalBranch[],
  fallback?: { toolName: string; params: Record<string, unknown> },
): Promise<ConditionalResult> {
  const start = performance.now();

  for (const branch of branches) {
    try {
      if (branch.condition(input)) {
        const resolvedParams = resolveInputRefs(branch.params, input);
        const result = await executor(branch.toolName, resolvedParams);

        log.info({ branch: branch.toolName, success: result.success }, 'conditional branch executed');
        return {
          branchTaken: branch.toolName,
          success: result.success,
          output: result.data,
          error: result.error,
          durationMs: Math.round(performance.now() - start),
        };
      }
    } catch (err) {
      log.warn({ branch: branch.toolName, err: err instanceof Error ? err.message : 'Unknown' }, 'branch condition evaluation failed');
    }
  }

  if (fallback) {
    const result = await executor(fallback.toolName, fallback.params);
    return {
      branchTaken: `fallback:${fallback.toolName}`,
      success: result.success,
      output: result.data,
      error: result.error,
      durationMs: Math.round(performance.now() - start),
    };
  }

  return {
    branchTaken: 'none',
    success: false,
    output: null,
    error: 'No branch condition matched and no fallback defined',
    durationMs: Math.round(performance.now() - start),
  };
}

function resolveInputRefs(params: Record<string, unknown>, input: unknown): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(params)) {
    if (val === '$input') {
      resolved[key] = typeof input === 'string' ? input : JSON.stringify(input);
    } else {
      resolved[key] = val;
    }
  }
  return resolved;
}
