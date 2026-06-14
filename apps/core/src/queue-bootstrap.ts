import { z } from 'zod';
import { getLogger } from '@titan/logging';
import { QUEUE_NAMES, type QueueName } from '@titan/shared';
import {
  registerJobSchema,
  type TitanWorker,
  createWorker,
} from '@titan/queue';
import { AgentRunner, MockLlmProvider, getGlobalToolRegistry, type ToolCall, type ToolResult, type AgentRun, type AgentStep } from '@titan/agent-engine';
import { MemoryClient } from '@titan/memory';
import { agentRuns, agentSteps } from '@titan/database';

const log = getLogger().child({ component: 'queue-bootstrap' });

// === Tool Registry (Phase 9-lite) ===
const registry = getGlobalToolRegistry();

registry.register({
  name: 'execute_bash',
  description: 'Execute a bash command in a sandboxed container',
  handler: async (params: unknown) => {
    const { command } = params as { command: string };
    log.info({ command }, 'tool:execute_bash');
    return { stdout: `mock: ${command}`, stderr: '', exitCode: 0 };
  },
  tags: ['system', 'execution'],
});

registry.register({
  name: 'patch_file',
  description: 'Apply a unified diff patch to a file',
  handler: async (params: unknown) => {
    const { filePath, patch } = params as { filePath: string; patch: string };
    log.info({ filePath, patch }, 'tool:patch_file');
    return { success: true, filePath };
  },
  tags: ['filesystem', 'code'],
});

registry.register({
  name: 'read_file_ast',
  description: 'Read a file and return its AST',
  handler: async (params: unknown) => {
    const { filePath } = params as { filePath: string };
    log.info({ filePath }, 'tool:read_file_ast');
    return { type: 'Program', filePath, body: [] };
  },
  tags: ['filesystem', 'code'],
});

registry.register({
  name: 'firecrawl_scrape',
  description: 'Scrape a URL and return plain text',
  handler: async (params: unknown) => {
    const { url } = params as { url: string };
    log.info({ url }, 'tool:firecrawl_scrape');
    return { url, title: `Title of ${url}`, content: `Mock content from ${url}` };
  },
  tags: ['network', 'web'],
});

async function executeTool(name: string, params: unknown): Promise<ToolResult> {
  return registry.execute(name, params);
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
      persistRun: async (run: AgentRun) => {
        try {
          await agentRuns.updateStatus(runId, run.status, {
            currentStep: run.currentStep,
            tokensUsed: run.tokensUsed,
            finalAnswer: run.finalAnswer ?? undefined,
          });
        } catch (err) {
          log.warn({ err, runId }, 'failed to persist run status');
        }
      },
      onStep: async (step: AgentStep) => {
        try {
          await agentSteps.create({
            runId,
            stepIndex: step.index,
            status: step.status,
            thought: step.thought,
            actionName: step.action?.name,
            actionParams: step.action?.params,
            observationSuccess: step.observation?.success,
            observationData: step.observation?.data as Record<string, unknown> | undefined,
            observationError: step.observation?.error,
            reflection: step.reflection,
            tokensUsed: step.tokensUsed,
            latencyMs: step.latencyMs,
          });
        } catch (err) {
          log.warn({ err, runId }, 'failed to persist step');
        }
      },
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

// Self-executing entry point for worker container
if (import.meta.url === `file://${process.argv[1]}`) {
  registerAllWorkers();

  const gracefulShutdown = async (signal: string) => {
    log.info({ signal }, 'worker shutting down gracefully');
    await closeAllWorkers();
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  log.info('titan worker started');
}