import { z } from 'zod';
import { PERMISSIONS } from './constants.js';

const PermissionEnum = z.enum(
  Object.values(PERMISSIONS) as [string, ...string[]],
);

export const LoginInputSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(256),
});

export const RegisterInputSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(256),
  name: z.string().min(1).max(100),
});

export const RefreshInputSchema = z.object({
  refreshToken: z.string().min(1),
});

export const CreateApiKeyInputSchema = z.object({
  name: z.string().min(1).max(100),
  workspaceId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
  scopes: z.array(PermissionEnum).max(50).default([]),
});

export const CreateWorkspaceInputSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric and hyphens'),
  description: z.string().max(500).optional(),
});

export const UpdateWorkspaceInputSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

export const AddMemberInputSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
});

export const PaginationInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
    total: z.number().int().nonnegative(),
  });

export const UuidSchema = z.string().uuid();

export const IsoDateSchema = z.string().datetime();

export const ExecuteBashInputSchema = z.object({
  command: z.string().min(1).max(4000),
  cwd: z.string().max(500).optional(),
  timeoutMs: z.number().int().min(100).max(60_000).optional().default(10_000),
  env: z.record(z.string()).optional(),
  useSandbox: z.boolean().optional(),
});

export const PatchFileInputSchema = z.object({
  filePath: z.string().min(1).max(500),
  patch: z.string().min(1).max(50_000),
});

export const ReadFileInputSchema = z.object({
  filePath: z.string().min(1).max(500),
  offset: z.number().int().min(0).optional().default(0),
  limit: z.number().int().min(1).max(10_000).optional().default(500),
});

export const ReadFileAstInputSchema = z.object({
  filePath: z.string().min(1).max(500),
});

export const FirecrawlScrapeInputSchema = z.object({
  url: z.string().url(),
  timeoutMs: z.number().int().min(100).max(30_000).optional().default(10_000),
  headers: z.record(z.string()).optional(),
});

export const GitPushInputSchema = z.object({
  cwd: z.string().min(1).max(500),
  commitMessage: z.string().min(1).max(1000).optional(),
  remote: z.string().max(100).optional(),
  branch: z.string().max(100).optional(),
  addAll: z.boolean().optional(),
  files: z.array(z.string().max(500)).optional(),
  skipCommit: z.boolean().optional(),
  skipPush: z.boolean().optional(),
  createTag: z.string().max(200).optional(),
});

export const DockerOrchestratorInputSchema = z.object({
  action: z.enum(['run', 'stop', 'remove', 'list', 'logs', 'exec']),
  containerName: z.string().max(200).optional(),
  image: z.string().max(200).optional(),
  command: z.string().max(2000).optional(),
  env: z.record(z.string()).optional(),
  ports: z.record(z.string()).optional(),
  volumes: z.array(z.string().max(500)).optional(),
});

export const ToolInputSchema = z.discriminatedUnion('tool', [
  z.object({ tool: z.literal('execute_bash'), params: ExecuteBashInputSchema }),
  z.object({ tool: z.literal('patch_file'), params: PatchFileInputSchema }),
  z.object({ tool: z.literal('read_file'), params: ReadFileInputSchema }),
  z.object({ tool: z.literal('read_file_ast'), params: ReadFileAstInputSchema }),
  z.object({ tool: z.literal('firecrawl_scrape'), params: FirecrawlScrapeInputSchema }),
  z.object({ tool: z.literal('docker_orchestrator'), params: DockerOrchestratorInputSchema }),
  z.object({ tool: z.literal('git_push'), params: GitPushInputSchema }),
]);

export type ExecuteBashInput = z.infer<typeof ExecuteBashInputSchema>;
export type PatchFileInput = z.infer<typeof PatchFileInputSchema>;
export type ReadFileInput = z.infer<typeof ReadFileInputSchema>;
export type ReadFileAstInput = z.infer<typeof ReadFileAstInputSchema>;
export type FirecrawlScrapeInput = z.infer<typeof FirecrawlScrapeInputSchema>;
export type GitPushInput = z.infer<typeof GitPushInputSchema>;
export type DockerOrchestratorInput = z.infer<typeof DockerOrchestratorInputSchema>;
export type ToolInput = z.infer<typeof ToolInputSchema>;
