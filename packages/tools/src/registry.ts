import { getLogger } from '@titan/logging';
import { z } from 'zod';
import { executeBash } from './tools/bash.js';
import { patchFile } from './tools/patch.js';
import { readFileContent, readFileAst } from './tools/readFile.js';
import { firecrawlScrape } from './tools/scrape.js';
import { dockerOrchestrate } from './tools/docker.js';
import {
  ExecuteBashInputSchema,
  PatchFileInputSchema,
  ReadFileInputSchema,
  ReadFileAstInputSchema,
  FirecrawlScrapeInputSchema,
  DockerOrchestratorInputSchema,
} from './schemas.js';
const log = getLogger().child({ component: 'tool-registry' });

export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodType<unknown>;
  handler: (params: unknown) => Promise<unknown>;
}

export const toolRegistry = new Map<string, ToolDefinition>([
  [
    'execute_bash',
    {
      name: 'execute_bash',
      description: 'Execute a bash command with sandbox restrictions',
      schema: ExecuteBashInputSchema,
      handler: (params) => executeBash(ExecuteBashInputSchema.parse(params)),
    },
  ],
  [
    'patch_file',
    {
      name: 'patch_file',
      description: 'Apply a unified diff patch to a file',
      schema: PatchFileInputSchema,
      handler: (params) => patchFile(PatchFileInputSchema.parse(params)),
    },
  ],
  [
    'read_file',
    {
      name: 'read_file',
      description: 'Read a file with optional offset and limit',
      schema: ReadFileInputSchema,
      handler: (params) => readFileContent(ReadFileInputSchema.parse(params)),
    },
  ],
  [
    'read_file_ast',
    {
      name: 'read_file_ast',
      description: 'Read a file and return a lightweight AST outline',
      schema: ReadFileAstInputSchema,
      handler: (params) => readFileAst(ReadFileAstInputSchema.parse(params)),
    },
  ],
  [
    'firecrawl_scrape',
    {
      name: 'firecrawl_scrape',
      description: 'Scrape a URL and return plain-text content',
      schema: FirecrawlScrapeInputSchema,
      handler: (params) => firecrawlScrape(FirecrawlScrapeInputSchema.parse(params)),
    },
  ],
  [
    'docker_orchestrator',
    {
      name: 'docker_orchestrator',
      description: 'Run, stop, remove, list, log, or exec Docker containers',
      schema: DockerOrchestratorInputSchema,
      handler: (params) => dockerOrchestrate(DockerOrchestratorInputSchema.parse(params)),
    },
  ],
]);

export function listTools(): { name: string; description: string }[] {
  return Array.from(toolRegistry.values()).map((t) => ({
    name: t.name,
    description: t.description,
  }));
}

export async function executeRegisteredTool(toolName: string, params: unknown): Promise<unknown> {
  const tool = toolRegistry.get(toolName);
  if (!tool) {
    log.warn({ toolName }, 'unknown tool requested');
    throw new Error(`Unknown tool: ${toolName}`);
  }

  const start = performance.now();
  try {
    const validated = tool.schema.parse(params);
    const result = await tool.handler(validated);
    log.info({ toolName, latencyMs: Math.round(performance.now() - start) }, 'tool executed');
    return result;
  } catch (err) {
    log.error({ toolName, err: err instanceof Error ? err.message : 'Unknown' }, 'tool execution failed');
    throw err;
  }
}
