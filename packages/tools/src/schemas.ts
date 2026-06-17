// Re-export all tool schemas from the single source of truth in @titan/shared.
// Do NOT redefine schemas here — keep @titan/shared as the canonical location.
export {
  ExecuteBashInputSchema,
  PatchFileInputSchema,
  ReadFileInputSchema,
  ReadFileAstInputSchema,
  FirecrawlScrapeInputSchema,
  GitPushInputSchema,
  DockerOrchestratorInputSchema,
  ToolInputSchema,
} from '@titan/shared';

export type {
  ExecuteBashInput,
  PatchFileInput,
  ReadFileInput,
  ReadFileAstInput,
  FirecrawlScrapeInput,
  GitPushInput,
  DockerOrchestratorInput,
  ToolInput,
} from '@titan/shared';
