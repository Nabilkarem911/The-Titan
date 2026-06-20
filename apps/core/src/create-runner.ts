/**
 * Shared factory for creating a configured AgentRunner instance.
 *
 * Eliminates ~500 lines of duplication across chat.ts, agents.ts,
 * telegram.ts, and queue-bootstrap.ts.
 */
import {
  AgentRunner,
  createProviderFromEnv,
  type LlmProvider,
  type ToolCall,
  type ToolResult,
  type AgentRun,
  type AgentStep,
} from '@titan/agent-engine';
import type { MemoryClient } from '@titan/memory';
import { agentRuns, agentSteps } from '@titan/database';
import { getLogger } from '@titan/logging';
import { getWsServer } from './ws-instance.js';

const log = getLogger().child({ component: 'create-runner' });

/* ------------------------------------------------------------------ */
/*  SSE writer abstraction — thin wrapper around raw response          */
/* ------------------------------------------------------------------ */
export interface SseWriter {
  write(data: string): void;
}

/* ------------------------------------------------------------------ */
/*  Factory options                                                    */
/* ------------------------------------------------------------------ */
export interface CreateRunnerOptions {
  /** Database run id — every callback uses this as the primary key. */
  runId: string;

  /** Agent id — used for WS broadcast topic namespacing. */
  agentId: string;

  /** Tool executor — typically `registry.execute(name, params)`. */
  executeTool: (name: string, params: unknown) => Promise<ToolResult>;

  /** Memory client (vector search, upsert). */
  memory: MemoryClient;

  /** Pre-loaded user context facts (Smart Memory). Optional. */
  userContextItems?: Record<string, string>;

  /**
   * Provide a pre-built LlmProvider to skip `createProviderFromEnv()`.
   * Useful in the swarm path where the provider is already created.
   */
  llm?: LlmProvider;

  /**
   * Optional SSE writer for streaming updates to the HTTP response.
   * When omitted, SSE writes are simply skipped.
   */
  sse?: SseWriter;

  /**
   * Whether to broadcast run/step updates over the WebSocket server.
   * Defaults to `true`.
   */
  broadcastWs?: boolean;

  /** Enable advanced planning for complex tasks. */
  enablePlanning?: boolean;

  /** Enable auto strategy selection based on task classification. */
  enableAutoStrategy?: boolean;

  /** Enable self-critique of final answers. */
  enableSelfCritique?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Factory                                                            */
/* ------------------------------------------------------------------ */
export function createRunner(opts: CreateRunnerOptions): AgentRunner {
  const {
    runId,
    agentId,
    executeTool,
    memory,
    userContextItems,
    sse,
    broadcastWs = true,
  } = opts;

  const llm: LlmProvider = opts.llm ?? (() => {
    const p = createProviderFromEnv();
    if (!p) throw new Error('LLM provider not configured — set LLM_PROVIDER_TYPE, LLM_API_KEY, LLM_MODEL');
    return p;
  })();

  return new AgentRunner({
    llm,
    executeTool: async (call: ToolCall, _runId: string): Promise<ToolResult> => {
      return executeTool(call.name, call.params);
    },
    memory,
    userContextItems,
    enablePlanning: opts.enablePlanning,
    enableAutoStrategy: opts.enableAutoStrategy,
    enableSelfCritique: opts.enableSelfCritique,

    /* ----- persistRun ------------------------------------------------ */
    persistRun: async (run: AgentRun) => {
      try {
        await agentRuns.updateStatus(runId, run.status, {
          currentStep: run.currentStep,
          tokensUsed: run.tokensUsed,
          finalAnswer: run.finalAnswer ?? undefined,
        });
      } catch (err) {
        log.warn({ err, runId }, 'failed to persist run');
      }

      sse?.write(`data: ${JSON.stringify({
        type: 'run.updated',
        runId,
        status: run.status,
        currentStep: run.currentStep,
        tokensUsed: run.tokensUsed,
      })}\n\n`);

      if (broadcastWs) {
        getWsServer()?.broadcast('agent.run.updated', {
          runId,
          agentId,
          status: run.status,
          currentStep: run.currentStep,
          tokensUsed: run.tokensUsed,
          finalAnswer: run.finalAnswer ?? null,
        });
      }
    },

    /* ----- onStep ---------------------------------------------------- */
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

      sse?.write(`data: ${JSON.stringify({
        type: 'step',
        runId,
        step: {
          index: step.index,
          status: step.status,
          thought: step.thought,
          actionName: step.action?.name,
          actionParams: step.action?.params,
          observationSuccess: step.observation?.success,
          observationData: step.observation?.data,
          observationError: step.observation?.error,
          reflection: step.reflection,
          tokensUsed: step.tokensUsed,
          latencyMs: step.latencyMs,
        },
      })}\n\n`);

      if (broadcastWs) {
        getWsServer()?.broadcast('agent.step', {
          runId,
          agentId,
          step: {
            index: step.index,
            status: step.status,
            thought: step.thought,
            actionName: step.action?.name,
            reflection: step.reflection,
            tokensUsed: step.tokensUsed,
            latencyMs: step.latencyMs,
          },
        });
      }
    },
  });
}
