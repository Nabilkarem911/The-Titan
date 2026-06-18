import { getLogger } from '@titan/logging';
import type { CompositeToolDefinition, PipelineStep } from './types.js';
import { ToolPipeline, type ToolExecutor } from './pipe.js';

const log = getLogger().child({ component: 'macro-builder' });

export class MacroBuilder {
  private macros: Map<string, CompositeToolDefinition> = new Map();

  define(macro: CompositeToolDefinition): void {
    this.macros.set(macro.name, macro);
    log.info({ name: macro.name, steps: macro.pipeline.length }, 'macro defined');
  }

  remove(name: string): boolean {
    return this.macros.delete(name);
  }

  get(name: string): CompositeToolDefinition | undefined {
    return this.macros.get(name);
  }

  list(): CompositeToolDefinition[] {
    return Array.from(this.macros.values());
  }

  async execute(name: string, executor: ToolExecutor, input?: unknown): Promise<unknown> {
    const macro = this.macros.get(name);
    if (!macro) {
      throw new Error(`Macro "${name}" not found`);
    }

    const pipeline = new ToolPipeline(executor);
    for (const step of macro.pipeline) {
      pipeline.pipe(step.toolName, step.params, step.transformOutput);
    }

    const result = await pipeline.run(input);
    if (!result.success) {
      const failedStep = result.steps.find((s) => !s.success);
      throw new Error(`Macro "${name}" failed at step "${failedStep?.toolName}": ${failedStep?.error}`);
    }

    return result.finalOutput;
  }

  toToolHandler(name: string, executor: ToolExecutor): ((params: unknown) => Promise<unknown>) | undefined {
    const macro = this.macros.get(name);
    if (!macro) return undefined;

    return async (params: unknown) => {
      return this.execute(name, executor, params);
    };
  }

  // ── Pre-built macros ──

  static searchAndSummarize(): CompositeToolDefinition {
    return {
      name: 'search_and_summarize',
      description: 'Search the web and summarize the results',
      tags: ['macro', 'search', 'summarize'],
      pipeline: [
        { toolName: 'brave_search', params: { q: '$input' } },
        { toolName: 'http_request', params: { url: '$input', method: 'GET' }, transformOutput: (o) => typeof o === 'string' ? o.slice(0, 5000) : String(o).slice(0, 5000) },
      ],
    };
  }

  static fetchAndParse(): CompositeToolDefinition {
    return {
      name: 'fetch_and_parse',
      description: 'Fetch a URL and parse its content',
      tags: ['macro', 'fetch', 'parse'],
      pipeline: [
        { toolName: 'http_request', params: { url: '$input', method: 'GET' } },
        { toolName: 'html_to_text', params: { html: '$input' } },
      ],
    };
  }

  static readAnalyzeFile(): CompositeToolDefinition {
    return {
      name: 'read_analyze_file',
      description: 'Read a file and analyze its contents',
      tags: ['macro', 'file', 'analyze'],
      pipeline: [
        { toolName: 'read_file_content', params: { path: '$input' } },
        { toolName: 'text_stats', params: { text: '$input' } },
      ],
    };
  }
}
