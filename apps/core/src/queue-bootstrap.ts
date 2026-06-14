import { z } from 'zod';
import { getLogger } from '@titan/logging';
import { QUEUE_NAMES, type QueueName } from '@titan/shared';
import {
  registerJobSchema,
  type TitanWorker,
  createWorker,
} from '@titan/queue';
import { AgentRunner, MockLlmProvider, type ToolCall, type ToolResult } from '@titan/agent-engine';
import { MemoryClient } from '@titan/memory';

const log = getLogger().child({ component: 'queue-bootstrap' });

// === Tool Registry (Phase 3) ===
type ToolName = 'execute_bash' | 'patch_file' | 'read_file_ast' | 'firecrawl_scrape';

const tools: Record<ToolName, (params: unknown) => Promise<unknown>> = {
  execute_bash: async (params: any) => {
    const { command } = params;
    log.info({ command }, 'tool:execute_bash');
    return { stdout: `mock: ${command}`, stderr: '', exitCode: 0 };
  },
  patch_file: async (params: any) => {
    const { filePath, patch } = params;
    log.info({ filePath, patch }, 'tool:patch_file');
    return { success: true, filePath };
  },
  read_file_ast: async (params: any) => {
    const { filePath } = params;
    log.info({ filePath }, 'tool:read_file_ast');
    return { type: 'Program', filePath, body: [] };
  },
  firecrawl_scrape: async (params: any) => {
    const { url } = params;
    log.info({ url }, 'tool:firecrawl_scrape');
    return { url, title: `Title of ${url}`, content: `Mock content from ${url}` };
  },
};

async function executeTool(name: string, params: unknown): Promise<unknown> {
  const handler = tools[name as ToolName];
  if (!handler) throw new Error(`Unknown tool: ${name}`);
  return handler(params);
}

const agentExecuteSchema = z.object({
  runId: z.string().uuid(),
  agentId: z.string(),
  prompt: z.string().min(1).max(1_000_000),
  workspaceId: z.string().uuid().optional(),
  apiKeyId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
}).passthrough();

const toolExecuteSchema = z.object({
  toolName: z.string().min(1).max(200),
  input: z.unknown(),
  workspaceId: z.string().uuid().optional(),
  apiKeyId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
}).passthrough();

const memoryIndexSchema = z.object({
  sourceId: z.string().uuid(),
  content: z.string().min(1).max(10_000_000),
  workspaceId: z.string().uuid().optional(),
}).passthrough();

const memoryRetrieveSchema = z.object({
  query: z.string().min(1).max(10_000),
  workspaceId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(1000).optional(),
}).passthrough();

const sandboxExecSchema = z.object({
  sandboxId: z.string().uuid(),
  command: z.string().min(1).max(10_000),
  args: z.array(z.string()).max(256).optional(),
  workspaceId: z.string().uuid().optional(),
}).passthrough();

const monitoringCheckSchema = z.object({
  target: z.string().min(1).max(2000),
  checkType: z.enum(['http', 'tcp', 'ping', 'custom']),
}).passthrough();

const auditWriteSchema = z.object({
  actorId: z.string().uuid().nullable(),
  action: z.string().min(1).max(200),
  resource: z.string().max(200).nullable().optional(),
  resourceId: z.string().max(200).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
}).passthrough();

const webhookDeliverSchema = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
  workspaceId: z.string().uuid().optional(),
}).passthrough();

const SCHEMAS: Array<[QueueName, z.ZodType<unknown>]> = [
  [QUEUE_NAMES.AGENT_EXECUTE, agentExecuteSchema],
  [QUEUE_NAMES.TOOL_EXECUTE, toolExecuteSchema],
  [QUEUE_NAMES.MEMORY_INDEX, memoryIndexSchema],
  [QUEUE_NAMES.MEMORY_RETRIEVE, memoryRetrieveSchema],
  [QUEUE_NAMES.SANDBOX_EXEC, sandboxExecSchema],
  [QUEUE_NAMES.MONITORING_CHECK, monitoringCheckSchema],
  [QUEUE_NAMES.AUDIT_WRITE, auditWriteSchema],
  [QUEUE_NAMES.WEBHOOK_DELIVER, webhookDeliverSchema],
];

export function registerAllQueueSchemas(): void {
  for (const [q, s] of SCHEMAS) {
    registerJobSchema(q, s);
  }
  log.info({ queues: SCHEMAS.map(([q]) => q) }, 'queue schemas registered');
}

// Processor implementations
const processors: Record<QueueName, (job: any) => Promise<any>> = {
  [QUEUE_NAMES.AGENT_EXECUTE]: async (job) => {
    const { prompt, runId, agentId, workspaceId, userId, apiKeyId, maxSteps, tokenBudget, forbiddenTools } = job;
    log.info({ jobId: job.id, runId, agentId, prompt: prompt?.substring(0, 100) }, 'executing agent');

    const memory = new MemoryClient();
    await memory.initialize();

    const runner = new AgentRunner({
      llm: new MockLlmProvider(),
      executeTool: async (call: ToolCall, _runId: string): Promise<ToolResult> => {
        try {
          const data = await executeTool(call.name, call.params);
          return { success: true, data };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'Tool execution failed' };
        }
      },
      memory,
    });

    const result = await runner.run({
      agentId: agentId ?? 'default-agent',
      prompt: prompt ?? '',
      userId,
      workspaceId,
      apiKeyId,
      maxSteps,
      tokenBudget,
      forbiddenTools,
    });

    return {
      runId: result.id,
      status: result.status,
      finalAnswer: result.finalAnswer,
      steps: result.steps.length,
      tokensUsed: result.tokensUsed,
    };
  },
  [QUEUE_NAMES.TOOL_EXECUTE]: async (job) => {
    const { toolName, input } = job;
    log.info({ jobId: job.id, toolName }, 'tool:execute');
    const result = await executeTool(toolName, input);
    return result;
  },
  [QUEUE_NAMES.MEMORY_INDEX]: async (job) => {
    const { sourceId, content, workspaceId } = job;
    log.info({ jobId: job.id, sourceId, contentLength: content?.length, workspaceId }, 'indexing memory');
    // Mock: just acknowledge
    return { indexed: true, sourceId };
  },
  [QUEUE_NAMES.MEMORY_RETRIEVE]: async (job) => {
    const { query, limit } = job;
    log.info({ jobId: job.id, query, limit }, 'retrieving memory');
    // Mock: return empty results
    return { results: [], query };
  },
  [QUEUE_NAMES.SANDBOX_EXEC]: async (job) => {
    const { sandboxId, command, args } = job;
    log.info({ jobId: job.id, sandboxId, command, args }, 'executing in sandbox');
    // Mock: return fake output
    return {
      stdout: `mock output for command: ${command}`,
      stderr: '',
      exitCode: 0,
      sandboxId,
    };
  },
  [QUEUE_NAMES.MONITORING_CHECK]: async (job) => {
    const { target, checkType } = job;
    log.info({ jobId: job.id, target, checkType }, 'running monitoring check');
    // Mock: always healthy
    return { status: 'ok', target, checkType, timestamp: new Date().toISOString() };
  },
  [QUEUE_NAMES.AUDIT_WRITE]: async (job) => {
    const { actorId, action } = job;
    log.info({ jobId: job.id, actorId, action }, 'writing audit log');
    // We could write to audit here, but we already have audit.writeChained in auth routes.
    // For now, just acknowledge.
    return { written: true, actorId, action };
  },
  [QUEUE_NAMES.WEBHOOK_DELIVER]: async (job) => {
    const { url, method } = job;
    log.info({ jobId: job.id, url, method }, 'delivering webhook');
    // Mock: just log
    return { delivered: true, url, method, statusCode: 200 };
  },
};

const workers: TitanWorker[] = [];

export function registerAllWorkers(): void {
  for (const [q] of SCHEMAS) {
    const processor = processors[q];
    const w = createWorker({
      queueName: q,
      processor,
      enableValidation: true,
      enableDLQ: true,
    });
    workers.push(w);
  }
  log.info({ workers: workers.length }, 'queue workers instantiated');
}

export async function closeAllWorkers(): Promise<void> {
  for (const w of workers) {
    try { await w.close(); } catch (err) { log.error({ err }, 'worker close failed'); }
  }
  workers.length = 0;
}