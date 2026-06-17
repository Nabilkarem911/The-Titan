import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreateProvider = vi.fn().mockReturnValue({ complete: vi.fn() });

vi.mock('@titan/logging', () => ({
  getLogger: () => ({ child: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }) }),
}));

vi.mock('@titan/agent-engine', () => ({
  AgentRunner: class { run = vi.fn(); constructor(public _opts: unknown) {} },
  createProviderFromEnv: (...args: unknown[]) => mockCreateProvider(...args),
  getGlobalToolRegistry: vi.fn(),
}));

vi.mock('@titan/database', () => ({
  agentRuns: { updateStatus: vi.fn() },
  agentSteps: { create: vi.fn() },
}));

vi.mock('./ws-instance.js', () => ({
  getWsServer: vi.fn().mockReturnValue({ broadcast: vi.fn() }),
}));

import { createRunner, type CreateRunnerOptions } from './create-runner.js';

function baseOpts(overrides?: Partial<CreateRunnerOptions>): CreateRunnerOptions {
  return {
    runId: 'run-1',
    agentId: 'agent-1',
    executeTool: vi.fn().mockResolvedValue({ success: true, data: {} }),
    memory: { search: vi.fn(), upsert: vi.fn() } as unknown as CreateRunnerOptions['memory'],
    ...overrides,
  };
}

describe('createRunner', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns an object with a run method', () => {
    const runner = createRunner(baseOpts());
    expect(runner).toBeDefined();
    expect(typeof runner.run).toBe('function');
  });

  it('calls createProviderFromEnv when no llm provided', () => {
    createRunner(baseOpts());
    expect(mockCreateProvider).toHaveBeenCalled();
  });

  it('does not call createProviderFromEnv when llm is provided', () => {
    const customLlm = { complete: vi.fn() };
    createRunner(baseOpts({ llm: customLlm as unknown as CreateRunnerOptions['llm'] }));
    expect(mockCreateProvider).not.toHaveBeenCalled();
  });

  it('throws if createProviderFromEnv returns null and no llm given', () => {
    mockCreateProvider.mockReturnValueOnce(null);
    expect(() => createRunner(baseOpts())).toThrow();
  });
});
