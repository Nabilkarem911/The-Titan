/**
 * Shared factory for creating a configured AgentRunner instance.
 *
 * Eliminates ~500 lines of duplication across chat.ts, agents.ts,
 * telegram.ts, and queue-bootstrap.ts.
 */
import {
  AgentRunner,
  createProviderFromEnv,
  createLlmProvider,
  MultiModelRouter,
  wireCapabilities,
  getGlobalWiring,
  ContextOptimizer,
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
import { getExperienceCollector } from './learning-singleton.js';

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

  /** Optional external step listener — called after internal persistence + broadcast. */
  onStep?: (step: AgentStep) => void | Promise<void>;
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
    const primary = createProviderFromEnv();
    if (!primary) throw new Error('LLM provider not configured — set LLM_PROVIDER_TYPE, LLM_API_KEY, LLM_MODEL');

    // Check for fallback provider — if configured, wrap both in MultiModelRouter
    const fallbackType = process.env['LLM_FALLBACK_PROVIDER_TYPE'] as 'openai' | 'openai-compatible' | 'anthropic' | undefined;
    const fallbackKey = process.env['LLM_FALLBACK_API_KEY'];
    const fallbackModel = process.env['LLM_FALLBACK_MODEL'];

    if (fallbackType && fallbackKey && fallbackModel) {
      try {
        const fallback = createLlmProvider({
          type: fallbackType,
          apiKey: fallbackKey,
          model: fallbackModel,
          baseUrl: process.env['LLM_FALLBACK_BASE_URL'],
        });
        log.info({ primary: process.env['LLM_MODEL'], fallback: fallbackModel }, 'multi-model router enabled with fallback');
        return new MultiModelRouter(
          [
            { name: 'primary', provider: primary, costPer1kTokens: 0.01, maxTokens: 128000, speed: 'medium', capability: 'advanced', priority: 10 },
            { name: 'fallback', provider: fallback, costPer1kTokens: 0.005, maxTokens: 128000, speed: 'fast', capability: 'standard', priority: 5 },
          ],
          { strategy: 'best', fallbackEnabled: true, maxRetries: 2 },
        );
      } catch (err) {
        log.warn({ err }, 'failed to create fallback provider — using primary only');
      }
    }

    return primary;
  })();

  return new AgentRunner({
    llm,
    executeTool: async (call: ToolCall, _runId: string): Promise<ToolResult> => {
      return executeTool(call.name, call.params);
    },
    memory,
    userContextItems,
    enablePlanning: opts.enablePlanning ?? true,
    enableAutoStrategy: opts.enableAutoStrategy ?? true,
    enableSelfCritique: opts.enableSelfCritique ?? true,

    // Context window compression — compact history after every few steps to prevent 400k+ token usage
    contextOptimization: {
      maxContextTokens: 32000,
      maxToolOutputTokens: 2000,
      maxConversationMessages: 6,
      enableToolFiltering: true,
      enableHistoryCompaction: true,
      enableOutputTruncation: true,
    },

    // Wire all cosmic capabilities into the runner
    wiredCapabilities: wireCapabilities(llm),

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

      // Record learning experience when run finishes
      if (run.status === 'completed' || run.status === 'failed') {
        try {
          const toolsUsed = run.steps
            .filter((s) => s.action?.name)
            .map((s) => s.action!.name);
          const durationMs = Date.now() - run.createdAt.getTime();
          getExperienceCollector().record({
            id: run.id,
            runId,
            prompt: run.prompt,
            strategy: 'react',
            toolsUsed,
            success: run.status === 'completed',
            tokensUsed: run.tokensUsed,
            durationMs,
            timestamp: new Date(),
          });
        } catch {
          // learning recording is optional — don't fail the run
        }
      }

      // ESM — mark run completed/failed and log resume info
      const wiring = getGlobalWiring();
      if (wiring?.executionStateMemory) {
        if (run.status === 'completed') {
          wiring.executionStateMemory.markCompleted(runId);
        } else if (run.status === 'failed') {
          wiring.executionStateMemory.markFailed(runId);
          const latestCp = wiring.executionStateMemory.getLatestCheckpoint(runId);
          if (latestCp) {
            log.info({ runId, checkpointId: latestCp.id, stepIndex: latestCp.stepIndex }, 'run failed — ESM checkpoint available for resume');
            sse?.write(`data: ${JSON.stringify({ type: 'esm.checkpoint_available', runId, checkpointId: latestCp.id, stepIndex: latestCp.stepIndex })}\n\n`);
          }
        }
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

      // External step listener (e.g. Telegram progress updates)
      if (opts.onStep) {
        try {
          await opts.onStep(step);
        } catch (err) {
          log.warn({ err, runId }, 'external onStep callback failed');
        }
      }

      // Execution State Memory — auto-checkpoint every 5 steps
      if (step.index > 0 && step.index % 5 === 0) {
        const wiring = getGlobalWiring();
        if (wiring?.executionStateMemory) {
          try {
            wiring.executionStateMemory.checkpoint(runId, step.index, step.index + 1, {
              messages: [{ role: 'system', content: step.thought ?? '' }],
              toolResults: step.observation ? [{ tool: step.action?.name ?? 'unknown', result: step.observation.data }] : [],
              plan: [],
              variables: {},
              intermediateResults: [],
            });
            log.info({ runId, stepIndex: step.index }, 'ESM auto-checkpoint saved');
          } catch (err) {
            log.warn({ err, runId }, 'ESM checkpoint failed');
          }
        }
      }
    },
  });
}
