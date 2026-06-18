import { getLogger } from '@titan/logging';
import type { ToolExecutor } from './pipe.js';

const log = getLogger().child({ component: 'tool-parallel' });

export interface ParallelTask {
  toolName: string;
  params: Record<string, unknown>;
  label?: string;
}

export interface ParallelResult {
  success: boolean;
  results: Array<{
    label: string;
    toolName: string;
    success: boolean;
    output: unknown;
    error?: string;
    durationMs: number;
  }>;
  totalDurationMs: number;
}

export async function parallelExec(
  executor: ToolExecutor,
  tasks: ParallelTask[],
): Promise<ParallelResult> {
  const start = performance.now();

  const promises = tasks.map(async (task, i) => {
    const taskStart = performance.now();
    try {
      const result = await executor(task.toolName, task.params);
      return {
        label: task.label ?? `task_${i}`,
        toolName: task.toolName,
        success: result.success,
        output: result.data,
        error: result.error,
        durationMs: Math.round(performance.now() - taskStart),
      };
    } catch (err) {
      return {
        label: task.label ?? `task_${i}`,
        toolName: task.toolName,
        success: false,
        output: null,
        error: err instanceof Error ? err.message : 'Unknown error',
        durationMs: Math.round(performance.now() - taskStart),
      };
    }
  });

  const results = await Promise.all(promises);
  const allSuccess = results.every((r) => r.success);
  const totalDurationMs = Math.round(performance.now() - start);

  log.info({ tasks: tasks.length, success: allSuccess, durationMs: totalDurationMs }, 'parallel execution completed');

  return { success: allSuccess, results, totalDurationMs };
}
