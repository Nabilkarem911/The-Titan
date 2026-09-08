import { describe, it, expect, vi } from 'vitest';
import { pipe } from './pipe.js';
import { parallelExec } from './parallel-exec.js';
import { conditionalExec } from './conditional-tool.js';
import { MacroBuilder } from './macro-builder.js';
import type { ToolExecutor } from './pipe.js';

const mockExecutor: ToolExecutor = vi.fn().mockImplementation(async (name: string, params: unknown) => {
  const p = params as Record<string, unknown>;
  switch (name) {
    case 'search': return { success: true, data: `Results for: ${p.q}` };
    case 'summarize': return { success: true, data: `Summary of: ${p.text}` };
    case 'translate': return { success: true, data: `Translated: ${p.text}` };
    case 'fail_tool': return { success: false, error: 'Tool failed' };
    case 'uppercase': return { success: true, data: String(p.text).toUpperCase() };
    default: return { success: true, data: `${name} result` };
  }
});

// ── Pipeline ──

describe('ToolPipeline', () => {
  it('chains tools sequentially', async () => {
    const result = await pipe(mockExecutor)
      .pipe('search', { q: 'TypeScript' })
      .pipe('summarize', { text: '$input' })
      .run();

    expect(result.success).toBe(true);
    expect(result.steps.length).toBe(2);
    expect(result.finalOutput).toContain('Summary of');
  });

  it('stops on failure', async () => {
    const result = await pipe(mockExecutor)
      .pipe('search', { q: 'test' })
      .pipe('fail_tool', {})
      .pipe('summarize', { text: '$input' })
      .run();

    expect(result.success).toBe(false);
    expect(result.steps.length).toBe(2);
  });

  it('passes initial input', async () => {
    const localExec: ToolExecutor = vi.fn().mockResolvedValue({ success: true, data: 'ok' });
    const result = await pipe(localExec)
      .pipe('summarize', { text: '$input' })
      .run('Initial data');

    expect(result.success).toBe(true);
    expect((localExec as ReturnType<typeof vi.fn>).mock.calls[0][1]).toEqual({ text: 'Initial data' });
  });

  it('applies transform functions', async () => {
    const result = await pipe(mockExecutor)
      .pipe('search', { q: 'test' }, (output) => String(output).toUpperCase())
      .run();

    expect(result.success).toBe(true);
    expect(result.finalOutput).toBe('RESULTS FOR: TEST');
  });

  it('handles transform errors', async () => {
    const result = await pipe(mockExecutor)
      .pipe('search', { q: 'test' }, () => { throw new Error('Transform boom'); })
      .run();

    expect(result.success).toBe(false);
  });

  it('reports total duration', async () => {
    const result = await pipe(mockExecutor)
      .pipe('search', { q: 'test' })
      .run();

    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });
});

// ── Parallel Execution ──

describe('parallelExec', () => {
  it('runs multiple tools in parallel', async () => {
    const result = await parallelExec(mockExecutor, [
      { toolName: 'search', params: { q: 'A' }, label: 'search_a' },
      { toolName: 'search', params: { q: 'B' }, label: 'search_b' },
      { toolName: 'search', params: { q: 'C' }, label: 'search_c' },
    ]);

    expect(result.success).toBe(true);
    expect(result.results.length).toBe(3);
    expect(result.results[0].label).toBe('search_a');
  });

  it('reports partial failure', async () => {
    const result = await parallelExec(mockExecutor, [
      { toolName: 'search', params: { q: 'A' } },
      { toolName: 'fail_tool', params: {} },
    ]);

    expect(result.success).toBe(false);
    expect(result.results[0].success).toBe(true);
    expect(result.results[1].success).toBe(false);
  });

  it('auto-labels tasks', async () => {
    const result = await parallelExec(mockExecutor, [
      { toolName: 'search', params: { q: 'test' } },
    ]);

    expect(result.results[0].label).toBe('task_0');
  });
});

// ── Conditional Execution ──

describe('conditionalExec', () => {
  it('takes matching branch', async () => {
    const result = await conditionalExec(
      mockExecutor,
      'hello world',
      [
        { condition: (input) => String(input).includes('hello'), toolName: 'translate', params: { text: '$input' } },
        { condition: () => true, toolName: 'summarize', params: { text: '$input' } },
      ],
    );

    expect(result.branchTaken).toBe('translate');
    expect(result.success).toBe(true);
  });

  it('uses fallback when no branch matches', async () => {
    const result = await conditionalExec(
      mockExecutor,
      'xyz',
      [
        { condition: (input) => String(input).includes('hello'), toolName: 'translate', params: {} },
      ],
      { toolName: 'search', params: { q: 'fallback' } },
    );

    expect(result.branchTaken).toContain('fallback');
    expect(result.success).toBe(true);
  });

  it('returns error when no match and no fallback', async () => {
    const result = await conditionalExec(
      mockExecutor,
      'xyz',
      [
        { condition: () => false, toolName: 'search', params: {} },
      ],
    );

    expect(result.success).toBe(false);
    expect(result.branchTaken).toBe('none');
  });
});

// ── Macro Builder ──

describe('MacroBuilder', () => {
  it('defines and executes a macro', async () => {
    const builder = new MacroBuilder();
    builder.define({
      name: 'search_summarize',
      description: 'Search and summarize',
      pipeline: [
        { toolName: 'search', params: { q: '$input' } },
        { toolName: 'summarize', params: { text: '$input' } },
      ],
    });

    const result = await builder.execute('search_summarize', mockExecutor, 'TypeScript');
    expect(result).toContain('Summary');
  });

  it('throws for unknown macro', async () => {
    const builder = new MacroBuilder();
    await expect(builder.execute('nonexistent', mockExecutor)).rejects.toThrow('not found');
  });

  it('lists defined macros', () => {
    const builder = new MacroBuilder();
    builder.define({ name: 'a', description: 'A', pipeline: [] });
    builder.define({ name: 'b', description: 'B', pipeline: [] });
    expect(builder.list().length).toBe(2);
  });

  it('removes a macro', () => {
    const builder = new MacroBuilder();
    builder.define({ name: 'temp', description: 'Temp', pipeline: [] });
    expect(builder.remove('temp')).toBe(true);
    expect(builder.get('temp')).toBeUndefined();
  });

  it('converts macro to tool handler', async () => {
    const builder = new MacroBuilder();
    builder.define({
      name: 'my_macro',
      description: 'Test',
      pipeline: [{ toolName: 'uppercase', params: { text: '$input' } }],
    });

    const handler = builder.toToolHandler('my_macro', mockExecutor);
    expect(handler).toBeDefined();
    const result = await handler!('hello');
    expect(result).toBe('HELLO');
  });

  it('has pre-built macros', () => {
    expect(MacroBuilder.searchAndSummarize().name).toBe('search_and_summarize');
    expect(MacroBuilder.fetchAndParse().name).toBe('fetch_and_parse');
    expect(MacroBuilder.readAnalyzeFile().name).toBe('read_analyze_file');
  });
});
