import { z } from 'zod';

export const ExecuteBashInputSchema = z.object({
  command: z.string().min(1).max(4000),
  cwd: z.string().max(500).optional(),
  timeoutMs: z.number().int().min(100).max(60_000).optional().default(10_000),
  env: z.record(z.string()).optional(),
});

export type ExecuteBashInput = z.infer<typeof ExecuteBashInputSchema>;

export const PatchFileInputSchema = z.object({
  filePath: z.string().min(1).max(500),
  patch: z.string().min(1).max(50_000),
});

export type PatchFileInput = z.infer<typeof PatchFileInputSchema>;

export const ReadFileInputSchema = z.object({
  filePath: z.string().min(1).max(500),
  offset: z.number().int().min(0).optional().default(0),
  limit: z.number().int().min(1).max(10_000).optional().default(500),
});

export type ReadFileInput = z.infer<typeof ReadFileInputSchema>;

export const ReadFileAstInputSchema = z.object({
  filePath: z.string().min(1).max(500),
});

export type ReadFileAstInput = z.infer<typeof ReadFileAstInputSchema>;

export const FirecrawlScrapeInputSchema = z.object({
  url: z.string().url(),
  timeoutMs: z.number().int().min(100).max(30_000).optional().default(10_000),
  headers: z.record(z.string()).optional(),
});

export type FirecrawlScrapeInput = z.infer<typeof FirecrawlScrapeInputSchema>;

export const DockerOrchestratorInputSchema = z.object({
  action: z.enum(['run', 'stop', 'remove', 'list', 'logs', 'exec']),
  containerName: z.string().max(200).optional(),
  image: z.string().max(200).optional(),
  command: z.string().max(2000).optional(),
  env: z.record(z.string()).optional(),
  ports: z.record(z.string()).optional(),
  volumes: z.array(z.string().max(500)).optional(),
});

export type DockerOrchestratorInput = z.infer<typeof DockerOrchestratorInputSchema>;

export const ToolInputSchema = z.discriminatedUnion('tool', [
  z.object({ tool: z.literal('execute_bash'), params: ExecuteBashInputSchema }),
  z.object({ tool: z.literal('patch_file'), params: PatchFileInputSchema }),
  z.object({ tool: z.literal('read_file'), params: ReadFileInputSchema }),
  z.object({ tool: z.literal('read_file_ast'), params: ReadFileAstInputSchema }),
  z.object({ tool: z.literal('firecrawl_scrape'), params: FirecrawlScrapeInputSchema }),
  z.object({ tool: z.literal('docker_orchestrator'), params: DockerOrchestratorInputSchema }),
]);

export type ToolInput = z.infer<typeof ToolInputSchema>;
