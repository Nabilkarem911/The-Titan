import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

const log = getLogger().child({ component: 'execution-state-memory' });

export interface ExecutionCheckpoint {
  id: string;
  runId: string;
  stepIndex: number;
  stepCount: number;
  state: {
    messages: Array<{ role: string; content: string }>;
    toolResults: Array<{ tool: string; result: unknown }>;
    plan: string[];
    variables: Record<string, unknown>;
    intermediateResults: unknown[];
  };
  status: 'running' | 'paused' | 'resumed' | 'completed' | 'failed';
  createdAt: Date;
  resumedAt: Date | null;
  metadata: Record<string, unknown>;
}

export interface ExecutionStateStats {
  totalCheckpoints: number;
  activeRuns: number;
  completedRuns: number;
  resumedRuns: number;
  avgStepsPerRun: number;
  byStatus: Array<{ status: string; count: number }>;
}

export class ExecutionStateMemory extends EventEmitter {
  private checkpoints: Map<string, ExecutionCheckpoint> = new Map();
  private runCheckpoints: Map<string, string[]> = new Map();
  private maxCheckpoints = 500;

  constructor() {
    super();
  }

  checkpoint(
    runId: string,
    stepIndex: number,
    stepCount: number,
    state: ExecutionCheckpoint['state'],
    metadata?: Record<string, unknown>,
  ): ExecutionCheckpoint {
    const id = randomUUID().slice(0, 8);
    const cp: ExecutionCheckpoint = {
      id,
      runId,
      stepIndex,
      stepCount,
      state: {
        messages: [...state.messages],
        toolResults: [...state.toolResults],
        plan: [...state.plan],
        variables: { ...state.variables },
        intermediateResults: [...state.intermediateResults],
      },
      status: 'running',
      createdAt: new Date(),
      resumedAt: null,
      metadata: metadata ?? {},
    };

    this.checkpoints.set(id, cp);
    const cps = this.runCheckpoints.get(runId) ?? [];
    cps.push(id);
    this.runCheckpoints.set(runId, cps);

    if (this.checkpoints.size > this.maxCheckpoints) {
      const oldest = this.checkpoints.keys().next().value;
      if (oldest) this.checkpoints.delete(oldest);
    }

    incCounter('esm_checkpoint', 'Execution checkpoints', 1);
    this.emit('checkpoint', cp);
    log.info({ id, runId, stepIndex, stepCount }, 'checkpoint saved');
    return cp;
  }

  resume(checkpointId: string): ExecutionCheckpoint | null {
    const cp = this.checkpoints.get(checkpointId);
    if (!cp) return null;

    cp.status = 'resumed';
    cp.resumedAt = new Date();

    incCounter('esm_resume', 'Execution resumes', 1);
    this.emit('resume', cp);
    log.info({ id: checkpointId, runId: cp.runId, stepIndex: cp.stepIndex }, 'execution resumed');
    return cp;
  }

  getCheckpoint(id: string): ExecutionCheckpoint | null {
    return this.checkpoints.get(id) ?? null;
  }

  getRunCheckpoints(runId: string): ExecutionCheckpoint[] {
    const ids = this.runCheckpoints.get(runId);
    if (!ids) return [];
    return ids.map((id) => this.checkpoints.get(id)).filter(Boolean) as ExecutionCheckpoint[];
  }

  getLatestCheckpoint(runId: string): ExecutionCheckpoint | null {
    const cps = this.getRunCheckpoints(runId);
    if (cps.length === 0) return null;
    return cps[cps.length - 1];
  }

  markCompleted(runId: string): void {
    const cps = this.getRunCheckpoints(runId);
    for (const cp of cps) {
      cp.status = 'completed';
    }
    incCounter('esm_completed', 'Execution completed', 1);
    this.emit('completed', { runId });
    log.info({ runId }, 'run marked completed');
  }

  markFailed(runId: string): void {
    const cps = this.getRunCheckpoints(runId);
    for (const cp of cps) {
      cp.status = 'failed';
    }
    this.emit('failed', { runId });
    log.info({ runId }, 'run marked failed');
  }

  getActiveRuns(): string[] {
    const active = new Set<string>();
    for (const cp of this.checkpoints.values()) {
      if (cp.status === 'running' || cp.status === 'paused') {
        active.add(cp.runId);
      }
    }
    return Array.from(active);
  }

  deleteRun(runId: string): void {
    const ids = this.runCheckpoints.get(runId);
    if (ids) {
      for (const id of ids) this.checkpoints.delete(id);
      this.runCheckpoints.delete(runId);
    }
  }

  stats(): ExecutionStateStats {
    const all = Array.from(this.checkpoints.values());
    const byStatusMap = new Map<string, number>();
    let completed = 0;
    let resumed = 0;
    const runStepCounts = new Map<string, number>();

    for (const cp of all) {
      byStatusMap.set(cp.status, (byStatusMap.get(cp.status) ?? 0) + 1);
      if (cp.status === 'completed') completed++;
      if (cp.status === 'resumed') resumed++;
      runStepCounts.set(cp.runId, Math.max(runStepCounts.get(cp.runId) ?? 0, cp.stepCount));
    }

    const avgSteps = runStepCounts.size > 0
      ? Math.round((Array.from(runStepCounts.values()).reduce((s, c) => s + c, 0) / runStepCounts.size) * 100) / 100
      : 0;

    return {
      totalCheckpoints: all.length,
      activeRuns: this.getActiveRuns().length,
      completedRuns: completed,
      resumedRuns: resumed,
      avgStepsPerRun: avgSteps,
      byStatus: Array.from(byStatusMap.entries()).map(([status, count]) => ({ status, count })),
    };
  }

  clear(): void {
    this.checkpoints.clear();
    this.runCheckpoints.clear();
  }
}
