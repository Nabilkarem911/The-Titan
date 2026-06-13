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
  command: z.string().min(1).max(10000),
  args: z.array(z.string().max(1000)).max(256).default([]),
  workingDirectory: z.string().optional(),
  timeoutMs: z.number().int().positive().max(120000).optional(),
});

export const PatchFileInputSchema = z.object({
  filePath: z.string().min(1).max(4096),
  patch: z.string().min(1).max(1000000),
  createBackup: z.boolean().default(true),
});

export const ReadFileAstInputSchema = z.object({
  filePath: z.string().min(1).max(4096),
  includeTokens: z.boolean().default(false),
});

export const FirecrawlScrapeInputSchema = z.object({
  url: z.string().url(),
  formats: z.array(z.enum(['markdown', 'html', 'links'])).default(['markdown']),
  onlyMainContent: z.boolean().default(true),
  timeoutMs: z.number().int().positive().max(60000).optional(),
});

export const DockerOrchestratorInputSchema = z.object({
  command: z.enum(['run', 'build', 'stop', 'remove', 'logs', 'exec']),
  image: z.string().optional(),
  containerName: z.string().optional(),
  args: z.array(z.string()).max(256).optional(),
  workspaceId: z.string().uuid().optional(),
  env: z.record(z.string()).optional(),
  volumes: z.array(z.string()).optional(),
  ports: z.array(z.string()).optional(),
  network: z.string().optional(),
  timeoutMs: z.number().int().positive().max(300000).optional(),
});

export const ToolInputSchema = z.discriminatedUnion('tool', [
  z.object({ tool: z.literal('execute_bash'), params: ExecuteBashInputSchema }),
  z.object({ tool: z.literal('patch_file'), params: PatchFileInputSchema }),
  z.object({ tool: z.literal('read_file_ast'), params: ReadFileAstInputSchema }),
  z.object({ tool: z.literal('firecrawl_scrape'), params: FirecrawlScrapeInputSchema }),
  z.object({ tool: z.literal('docker_orchestrator'), params: DockerOrchestratorInputSchema }),
]);

export type ExecuteBashInput = z.infer<typeof ExecuteBashInputSchema>;
export type PatchFileInput = z.infer<typeof PatchFileInputSchema>;
export type ReadFileAstInput = z.infer<typeof ReadFileAstInputSchema>;
export type FirecrawlScrapeInput = z.infer<typeof FirecrawlScrapeInputSchema>;
export type DockerOrchestratorInput = z.infer<typeof DockerOrchestratorInputSchema>;
export type ToolInput = z.infer<typeof ToolInputSchema>;
