import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry, resetGlobalToolRegistry, getGlobalToolRegistry } from './tool-registry.js';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('registers and executes a tool', async () => {
    registry.register({
      name: 'echo',
      description: 'Echoes the input',
      handler: async (params) => params,
    });

    const result = await registry.execute('echo', { hello: 'world' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ hello: 'world' });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns error for unknown tool', async () => {
    const result = await registry.execute('nonexistent', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown tool');
  });

  it('returns error for failed handler', async () => {
    registry.register({
      name: 'fail',
      description: 'Always fails',
      handler: async () => {
        throw new Error('intentional failure');
      },
    });

    const result = await registry.execute('fail', {});
    expect(result.success).toBe(false);
    expect(result.error).toBe('intentional failure');
  });

  it('unregisters a tool', async () => {
    registry.register({
      name: 'temp',
      description: 'Temp tool',
      handler: async () => 'ok',
    });

    expect(registry.has('temp')).toBe(true);
    const removed = registry.unregister('temp');
    expect(removed).toBe(true);
    expect(registry.has('temp')).toBe(false);
  });

  it('lists registered tools', () => {
    registry.register({
      name: 'alpha',
      description: 'Alpha tool',
      handler: async () => 'a',
      tags: ['test'],
    });
    registry.register({
      name: 'beta',
      description: 'Beta tool',
      handler: async () => 'b',
    });

    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.map((t) => t.name).sort()).toEqual(['alpha', 'beta']);
    expect(list.find((t) => t.name === 'alpha')?.tags).toEqual(['test']);
  });

  it('tracks size', () => {
    expect(registry.size()).toBe(0);
    registry.register({
      name: 'one',
      description: 'One',
      handler: async () => 1,
    });
    expect(registry.size()).toBe(1);
  });

  it('global singleton works', () => {
    resetGlobalToolRegistry();
    const r1 = getGlobalToolRegistry();
    const r2 = getGlobalToolRegistry();
    expect(r1).toBe(r2);
  });
});
