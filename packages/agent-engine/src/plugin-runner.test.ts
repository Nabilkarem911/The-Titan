import { describe, it, expect, beforeEach } from 'vitest';
import { PluginRunner, getGlobalPluginRunner, resetGlobalPluginRunner } from './plugin-runner.js';
import { getGlobalToolRegistry, resetGlobalToolRegistry } from './tool-registry.js';

describe('PluginRunner', () => {
  let runner: PluginRunner;

  beforeEach(() => {
    runner = new PluginRunner();
    resetGlobalPluginRunner();
    resetGlobalToolRegistry();
  });

  it('loads a plugin manifest', async () => {
    await runner.load({
      name: 'math-plugin',
      version: '1.0.0',
      tools: [
        {
          name: 'add',
          description: 'Add two numbers',
          tags: ['math'],
        },
      ],
    });

    expect(runner.isLoaded('math-plugin')).toBe(true);
    expect(runner.getLoaded()).toEqual(['math-plugin']);
  });

  it('unloads a plugin', async () => {
    await runner.load({
      name: 'temp-plugin',
      version: '1.0.0',
      tools: [],
    });

    expect(runner.unload('temp-plugin')).toBe(true);
    expect(runner.isLoaded('temp-plugin')).toBe(false);
  });

  it('reloads a plugin (overwrite)', async () => {
    await runner.load({
      name: 'reload-test',
      version: '1.0.0',
      tools: [{ name: 'old', description: 'Old' }],
    });

    await runner.load({
      name: 'reload-test',
      version: '2.0.0',
      tools: [{ name: 'new', description: 'New' }],
    });

    const tools = runner.getTools('reload-test');
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('new');
  });

  it('gets all tools across plugins', async () => {
    await runner.load({
      name: 'plugin-a',
      version: '1.0.0',
      tools: [{ name: 'tool-a1', description: 'A1' }],
    });
    await runner.load({
      name: 'plugin-b',
      version: '1.0.0',
      tools: [{ name: 'tool-b1', description: 'B1' }],
    });

    const all = runner.getAllTools();
    expect(all).toHaveLength(2);
    expect(all.map((t) => t.plugin).sort()).toEqual(['plugin-a', 'plugin-b']);
  });

  it('registers plugin meta in ToolRegistry manually', async () => {
    await runner.load({
      name: 'registry-test',
      version: '1.0.0',
      tools: [{ name: 'echo', description: 'Echo' }],
    });

    const registry = getGlobalToolRegistry();
    const tools = runner.getTools('registry-test');
    for (const tool of tools) {
      registry.register({
        name: tool.name,
        description: tool.description,
        handler: async (params: unknown) => params,
        tags: ['plugin', 'registry-test'],
      });
    }

    const result = await registry.execute('echo', { hello: 'world' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ hello: 'world' });
  });

  it('global singleton works', () => {
    const r1 = getGlobalPluginRunner();
    const r2 = getGlobalPluginRunner();
    expect(r1).toBe(r2);
  });
});
