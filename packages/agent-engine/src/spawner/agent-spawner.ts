import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';
import type { AgentRun, AgentRunInput, LlmProvider, ToolCall, ToolResult } from '../types.js';
import type { SpawnRequest, ChildAgent, ChildUpdate, AggregatedResult } from './types.js';

const log = getLogger().child({ component: 'agent-spawner' });

export interface AgentSpawnerDeps {
  llm: LlmProvider;
  executeTool: (call: ToolCall, runId: string) => Promise<ToolResult>;
  createAgentRun: (input: AgentRunInput) => Promise<AgentRun>;
}

export class AgentSpawner {
  private children: Map<string, ChildAgent> = new Map();
  private deps: AgentSpawnerDeps;

  constructor(deps: AgentSpawnerDeps) {
    this.deps = deps;
  }

  async spawn(request: SpawnRequest): Promise<ChildAgent> {
    const child: ChildAgent = {
      id: randomUUID(),
      name: request.name,
      parentId: request.parentId,
      status: 'pending',
      mode: request.mode,
      prompt: request.prompt,
      tokensUsed: 0,
      startedAt: new Date(),
    };

    this.children.set(child.id, child);
    log.info({ childId: child.id, name: child.name, mode: child.mode, parentId: child.parentId }, 'child agent spawned');

    this.notifyParent(request, { childId: child.id, type: 'started', timestamp: new Date() });

    if (request.mode === 'foreground') {
      await this.executeChild(child, request);
    } else {
      // Background — fire and forget
      this.executeChild(child, request).catch((err) => {
        child.status = 'failed';
        child.error = err instanceof Error ? err.message : 'Unknown error';
      });
    }

    return child;
  }

  async spawnMany(requests: SpawnRequest[]): Promise<ChildAgent[]> {
    const foreground = requests.filter((r) => r.mode === 'foreground');
    const background = requests.filter((r) => r.mode === 'background');

    // Start background agents first (fire and forget)
    const bgChildren = background.map((r) => this.spawn(r));

    // Run foreground agents in parallel and wait
    const fgChildren = await Promise.all(foreground.map((r) => this.spawn(r)));

    return [...fgChildren, ...(await Promise.all(bgChildren))];
  }

  async waitForAll(parentId: string, timeoutMs = 300000): Promise<ChildAgent[]> {
    const deadline = Date.now() + timeoutMs;
    const children = this.getChildren(parentId);

    while (Date.now() < deadline) {
      const pending = children.filter((c) => c.status === 'pending' || c.status === 'running');
      if (pending.length === 0) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    // Timeout remaining
    for (const child of children) {
      if (child.status === 'pending' || child.status === 'running') {
        child.status = 'cancelled';
        child.error = 'Timeout waiting for completion';
      }
    }

    return children;
  }

  async aggregate(parentId: string): Promise<AggregatedResult> {
    const children = this.getChildren(parentId);
    const totalTokens = children.reduce((s, c) => s + c.tokensUsed, 0);
    const allSucceeded = children.every((c) => c.status === 'completed');

    let synthesis: string | undefined;
    if (children.length > 1 && children.some((c) => c.result)) {
      synthesis = await this.synthesizeResults(children);
    }

    const earliest = children.reduce((min, c) => c.startedAt < min ? c.startedAt : min, new Date());
    const latest = children.reduce((max, c) => {
      const t = c.completedAt ?? new Date();
      return t > max ? t : max;
    }, earliest);

    return {
      parentId,
      children: children.map((c) => ({ id: c.id, name: c.name, status: c.status, result: c.result })),
      synthesis,
      totalTokens,
      totalDurationMs: latest.getTime() - earliest.getTime(),
      allSucceeded,
    };
  }

  cancel(childId: string): boolean {
    const child = this.children.get(childId);
    if (!child || child.status === 'completed' || child.status === 'failed') return false;

    child.status = 'cancelled';
    child.completedAt = new Date();
    log.info({ childId }, 'child agent cancelled');
    return true;
  }

  cancelAll(parentId: string): number {
    let count = 0;
    for (const child of this.getChildren(parentId)) {
      if (this.cancel(child.id)) count++;
    }
    return count;
  }

  getChild(childId: string): ChildAgent | undefined {
    return this.children.get(childId);
  }

  getChildren(parentId: string): ChildAgent[] {
    return Array.from(this.children.values()).filter((c) => c.parentId === parentId);
  }

  getStatus(parentId: string): { total: number; completed: number; failed: number; running: number } {
    const children = this.getChildren(parentId);
    return {
      total: children.length,
      completed: children.filter((c) => c.status === 'completed').length,
      failed: children.filter((c) => c.status === 'failed').length,
      running: children.filter((c) => c.status === 'running' || c.status === 'pending').length,
    };
  }

  private async executeChild(child: ChildAgent, request: SpawnRequest): Promise<void> {
    child.status = 'running';

    try {
      const run = await this.deps.createAgentRun({
        agentId: `child_${child.name}`,
        prompt: request.prompt,
        maxSteps: request.maxSteps ?? 10,
        systemPromptExtra: request.systemPrompt,
        forbiddenTools: request.forbiddenTools ? [...request.forbiddenTools] : undefined,
      });

      child.run = run;
      child.result = run.finalAnswer;
      child.tokensUsed = run.tokensUsed;
      child.status = run.status === 'failed' ? 'failed' : 'completed';
      if (run.status === 'failed') child.error = run.finalAnswer;

      this.notifyParent(request, {
        childId: child.id,
        type: child.status === 'completed' ? 'completed' : 'failed',
        data: child.result,
        timestamp: new Date(),
      });

      log.info({ childId: child.id, status: child.status, tokens: child.tokensUsed }, 'child agent finished');
    } catch (err) {
      child.status = 'failed';
      child.error = err instanceof Error ? err.message : 'Unknown error';

      this.notifyParent(request, {
        childId: child.id,
        type: 'failed',
        data: child.error,
        timestamp: new Date(),
      });
    }

    child.completedAt = new Date();
  }

  private async synthesizeResults(children: ChildAgent[]): Promise<string> {
    const results = children
      .filter((c) => c.result)
      .map((c) => `[${c.name}]: ${c.result!.slice(0, 1500)}`);

    try {
      const completion = await this.deps.llm.complete([
        { role: 'system', content: 'Combine these sub-agent results into a single coherent response. Be concise.' },
        { role: 'user', content: results.join('\n\n') },
      ]);
      return completion.content;
    } catch {
      return results.join('\n\n---\n\n');
    }
  }

  private notifyParent(request: SpawnRequest, update: ChildUpdate): void {
    if (request.onProgress) {
      try { request.onProgress(update); } catch { /* ignore callback errors */ }
    }
  }
}
