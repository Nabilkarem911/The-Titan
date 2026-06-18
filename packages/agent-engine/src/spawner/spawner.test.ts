import { describe, it, expect, vi } from 'vitest';
import { AgentSpawner } from './agent-spawner.js';
import { AgentPool } from './agent-pool.js';
import { DynamicAgentFactory } from './dynamic-factory.js';
import type { LlmProvider, AgentRun } from '../types.js';

function mockDeps() {
  const llm: LlmProvider = {
    complete: vi.fn().mockResolvedValue({ content: 'Response', tokensUsed: 50, finishReason: 'stop' }),
  };
  const executeTool = vi.fn().mockResolvedValue({ success: true, data: 'tool result' });
  const createAgentRun = vi.fn().mockImplementation(async (input: { prompt: string }) => ({
    id: 'run-1', agentId: 'test', prompt: input.prompt, status: 'completed',
    maxSteps: 10, currentStep: 1, tokensUsed: 100, steps: [],
    finalAnswer: `Result for: ${input.prompt.slice(0, 50)}`,
    createdAt: new Date(), updatedAt: new Date(),
  } as AgentRun));

  return { llm, executeTool, createAgentRun };
}

// ── Agent Spawner ──

describe('AgentSpawner', () => {
  it('spawns a foreground child and waits for result', async () => {
    const deps = mockDeps();
    const spawner = new AgentSpawner(deps);

    const child = await spawner.spawn({
      name: 'researcher',
      prompt: 'Search for TypeScript best practices',
      mode: 'foreground',
      parentId: 'parent-1',
    });

    expect(child.status).toBe('completed');
    expect(child.result).toContain('Result for');
    expect(child.tokensUsed).toBe(100);
  });

  it('spawns multiple children', async () => {
    const deps = mockDeps();
    const spawner = new AgentSpawner(deps);

    const children = await spawner.spawnMany([
      { name: 'search', prompt: 'Search A', mode: 'foreground', parentId: 'p1' },
      { name: 'analyze', prompt: 'Analyze B', mode: 'foreground', parentId: 'p1' },
    ]);

    expect(children.length).toBe(2);
    expect(children.every((c) => c.status === 'completed')).toBe(true);
  });

  it('aggregates results from children', async () => {
    const deps = mockDeps();
    const spawner = new AgentSpawner(deps);

    await spawner.spawn({ name: 'a', prompt: 'Task A', mode: 'foreground', parentId: 'p1' });
    await spawner.spawn({ name: 'b', prompt: 'Task B', mode: 'foreground', parentId: 'p1' });

    const result = await spawner.aggregate('p1');
    expect(result.children.length).toBe(2);
    expect(result.allSucceeded).toBe(true);
    expect(result.totalTokens).toBe(200);
  });

  it('cancels a running child', async () => {
    const deps = mockDeps();
    deps.createAgentRun.mockImplementation(() => new Promise((r) => setTimeout(r, 10000)));

    const spawner = new AgentSpawner(deps);
    // Spawn background (don't await)
    const childPromise = spawner.spawn({ name: 'slow', prompt: 'Slow task', mode: 'background', parentId: 'p1' });
    const child = await childPromise;

    // Cancel
    const cancelled = spawner.cancel(child.id);
    expect(cancelled).toBe(true);
  });

  it('reports status', async () => {
    const deps = mockDeps();
    const spawner = new AgentSpawner(deps);

    await spawner.spawn({ name: 'a', prompt: 'A', mode: 'foreground', parentId: 'p1' });
    const status = spawner.getStatus('p1');
    expect(status.total).toBe(1);
    expect(status.completed).toBe(1);
  });

  it('calls onProgress callback', async () => {
    const deps = mockDeps();
    const spawner = new AgentSpawner(deps);
    const updates: string[] = [];

    await spawner.spawn({
      name: 'tracked',
      prompt: 'Track me',
      mode: 'foreground',
      parentId: 'p1',
      onProgress: (update) => updates.push(update.type),
    });

    expect(updates).toContain('started');
    expect(updates).toContain('completed');
  });
});

// ── Agent Pool ──

describe('AgentPool', () => {
  it('respects concurrency limits', async () => {
    const deps = mockDeps();
    const pool = new AgentPool(deps, { maxConcurrent: 2, maxQueueSize: 10, defaultTimeout: 30000, warmPoolSize: 0 });

    const results = await pool.submitBatch([
      { name: 'a', prompt: 'A', mode: 'foreground', parentId: 'p1' },
      { name: 'b', prompt: 'B', mode: 'foreground', parentId: 'p1' },
      { name: 'c', prompt: 'C', mode: 'foreground', parentId: 'p1' },
    ]);

    expect(results.length).toBe(3);
    expect(results.every((c) => c.status === 'completed')).toBe(true);
  });

  it('reports stats', () => {
    const deps = mockDeps();
    const pool = new AgentPool(deps, { maxConcurrent: 5, maxQueueSize: 20, defaultTimeout: 30000, warmPoolSize: 0 });
    const stats = pool.getStats();
    expect(stats.maxConcurrent).toBe(5);
    expect(stats.active).toBe(0);
  });
});

// ── Dynamic Factory ──

describe('DynamicAgentFactory', () => {
  it('creates agent from spec', async () => {
    const llm: LlmProvider = {
      complete: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          name: 'Security Scanner',
          systemPrompt: 'You scan code for vulnerabilities',
          suggestedTools: ['read_file_content', 'execute_bash'],
          maxSteps: 8,
        }),
        tokensUsed: 30, finishReason: 'stop',
      }),
    };

    const factory = new DynamicAgentFactory(llm, [
      { name: 'read_file_content', description: 'Read file', parameters: { type: 'object', properties: {} } },
      { name: 'execute_bash', description: 'Run bash', parameters: { type: 'object', properties: {} } },
    ]);

    const request = await factory.createAgent(
      { role: 'security-scanner', goal: 'Find vulnerabilities in auth module', requiredCapabilities: ['code', 'security'] },
      'parent-1',
    );

    expect(request.name).toBe('Security Scanner');
    expect(request.maxSteps).toBe(8);
  });

  it('lists available capabilities', () => {
    const factory = new DynamicAgentFactory({ complete: vi.fn() } as unknown as LlmProvider, []);
    const caps = factory.listCapabilities();
    expect(caps).toContain('search');
    expect(caps).toContain('code');
    expect(caps).toContain('devops');
  });

  it('resolves tools from capabilities', () => {
    const factory = new DynamicAgentFactory({ complete: vi.fn() } as unknown as LlmProvider, []);
    const tools = factory.resolveTools(['search', 'code']);
    expect(tools).toContain('brave_search');
    expect(tools).toContain('write_file');
  });
});
