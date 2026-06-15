import { getLogger } from '@titan/logging';
import { randomUUID } from 'node:crypto';
import { observeHistogram, incCounter } from '@titan/observability';
import type {
  AgentRun,
  AgentRunInput,
  AgentStep,
  AgentContext,
  LlmProvider,
  LlmMessage,
  LlmToolDefinition,
  ToolCall,
  ToolResult,
  AgentRule,
} from './types.js';
import type { MemoryClient } from '@titan/memory';
import { getGlobalToolRegistry } from './tool-registry.js';

const log = getLogger().child({ component: 'agent-runner' });

const DEFAULT_MAX_STEPS = 10;
const DEFAULT_SYSTEM_PROMPT = `You are Titan, an autonomous AI agent. You MUST complete the user's request fully before stopping.

Follow the ReAct pattern:
1. Think step by step about what you need to do.
2. Call a tool to gather information or perform actions.
3. Observe the result carefully.
4. If you have enough information to fully answer the user, respond with "FINAL ANSWER: [complete answer here]".
5. If you need more information, continue to the next step and call another tool.

IMPORTANT RULES:
- NEVER say "FINAL ANSWER" unless you have the actual complete answer ready.
- Do NOT say things like "let me search" or "I will look" as your final answer.
- If a tool returns data, extract the relevant information and include it in your FINAL ANSWER.
- Always give concrete numbers, facts, or results — not vague promises to search.`;

function buildSystemPrompt(ctx: AgentContext): string {
  const rules: string[] = [];
  for (const r of ctx.rules) {
    if (r.type === 'max_steps') rules.push(`Max steps: ${r.value}`);
    if (r.type === 'token_budget') rules.push(`Token budget: ${r.value}`);
    if (r.type === 'forbidden_tools') rules.push(`Forbidden tools: ${(r.value as string[]).join(', ')}`);
  }
  if (ctx.memoryItems && ctx.memoryItems.length > 0) {
    rules.push(`Relevant memory:\n${ctx.memoryItems.join('\n')}`);
  }
  return rules.length > 0 ? `${ctx.systemPrompt}\n\n--- Rules & Memory ---\n${rules.join('\n')}` : ctx.systemPrompt;
}

function buildMessages(ctx: AgentContext): LlmMessage[] {
  const msgs: LlmMessage[] = [{ role: 'system', content: buildSystemPrompt(ctx) }];
  msgs.push({ role: 'user', content: ctx.run.prompt });

  for (const step of ctx.run.steps) {
    if (step.thought) {
      msgs.push({ role: 'assistant', content: step.thought });
    }
    if (step.action) {
      msgs.push({
        role: 'assistant',
        content: '',
        toolCalls: [step.action],
      });
    }
    if (step.observation) {
      msgs.push({
        role: 'tool',
        content: step.observation.success ? JSON.stringify(step.observation.data) : `Error: ${step.observation.error}`,
        toolResult: step.observation,
      });
    }
    if (step.reflection) {
      msgs.push({ role: 'assistant', content: step.reflection });
    }
  }
  return msgs;
}

function buildToolsFromRegistry(): LlmToolDefinition[] {
  return getGlobalToolRegistry().list().map((t) => ({
    name: t.name,
    description: t.description,
    parameters: {
      type: 'object' as const,
      properties: { params: { type: 'object', description: 'Tool parameters as a JSON object' } },
      required: [],
    },
  }));
}

function isToolCallAllowed(call: ToolCall, rules: AgentRule[]): boolean {
  const forbidden = rules.filter((r) => r.type === 'forbidden_tools').flatMap((r) => r.value as string[]);
  return !forbidden.includes(call.name);
}

export interface AgentRunnerDeps {
  llm: LlmProvider;
  executeTool: (call: ToolCall, runId: string) => Promise<ToolResult>;
  persistRun?: (run: AgentRun) => Promise<void>;
  onStep?: (step: AgentStep) => Promise<void>;
  memory?: MemoryClient;
  tools?: LlmToolDefinition[];
}

export class AgentRunner {
  constructor(private deps: AgentRunnerDeps) {}

  async run(input: AgentRunInput): Promise<AgentRun> {
    const run: AgentRun = {
      id: input.runId ?? randomUUID(),
      agentId: input.agentId,
      userId: input.userId,
      workspaceId: input.workspaceId,
      apiKeyId: input.apiKeyId,
      prompt: input.prompt,
      status: 'running',
      maxSteps: input.maxSteps ?? DEFAULT_MAX_STEPS,
      currentStep: 0,
      tokenBudget: input.tokenBudget,
      tokensUsed: 0,
      forbiddenTools: input.forbiddenTools,
      steps: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    log.info({ runId: run.id, prompt: input.prompt.substring(0, 100) }, 'agent run started');

    const rules: AgentRule[] = [];
    if (run.maxSteps) rules.push({ type: 'max_steps', value: run.maxSteps });
    if (run.tokenBudget) rules.push({ type: 'token_budget', value: run.tokenBudget });
    if (run.forbiddenTools) rules.push({ type: 'forbidden_tools', value: run.forbiddenTools });

    let memoryItems: string[] | undefined;
    if (this.deps.memory) {
      try {
        const collection = input.workspaceId ? `workspace_${input.workspaceId}` : 'global';
        const results = await this.deps.memory.search(collection, input.prompt, { limit: 5 });
        memoryItems = results.map((r) => r.content);
        log.info({ runId: run.id, memories: results.length }, 'memory retrieved');
      } catch (err) {
        log.warn({ runId: run.id, err: err instanceof Error ? err.message : 'Unknown' }, 'memory retrieval failed');
      }
    }

    const ctx: AgentContext = {
      run,
      systemPrompt: input.systemPromptExtra
        ? DEFAULT_SYSTEM_PROMPT + input.systemPromptExtra
        : DEFAULT_SYSTEM_PROMPT,
      rules,
      memoryItems,
    };

    try {
      while (run.currentStep < run.maxSteps) {
        if (run.tokenBudget && run.tokensUsed >= run.tokenBudget) {
          run.status = 'completed';
          run.finalAnswer = 'Token budget exhausted.';
          break;
        }

        run.currentStep++;
        const step = await this.executeStep(ctx, run.currentStep);
        run.steps.push(step);
        run.tokensUsed += step.tokensUsed ?? 0;
        run.updatedAt = new Date();

        if (this.deps.persistRun) {
          await this.deps.persistRun(run);
        }

        if (run.tokenBudget && run.tokensUsed >= run.tokenBudget) {
          run.status = 'completed';
          run.finalAnswer = 'Token budget exhausted.';
          break;
        }

        if (step.status === 'completed') {
          run.status = 'completed';
          const raw = step.reflection ?? step.observation?.data?.toString() ?? 'Done';
          const match = raw.match(/FINAL ANSWER:\s*([\s\S]+)/i);
          run.finalAnswer = match ? match[1].trim() : raw.trim();
          break;
        }
      }

      if (run.status === 'running') {
        run.status = 'completed';
        run.finalAnswer = 'Max steps reached without explicit completion.';
      }
    } catch (err) {
      run.status = 'failed';
      run.finalAnswer = err instanceof Error ? err.message : 'Unknown error';
      log.error({ runId: run.id, err }, 'agent run failed');
    }

    if (this.deps.persistRun) {
      await this.deps.persistRun(run);
    }

    if (this.deps.memory) {
      try {
        const collection = input.workspaceId ? `workspace_${input.workspaceId}` : 'global';
        await this.deps.memory.upsert(collection, [
          {
            id: run.id,
            content: `Prompt: ${run.prompt}\nAnswer: ${run.finalAnswer ?? 'N/A'}`,
            metadata: {
              agentId: run.agentId,
              status: run.status,
              steps: run.steps.length,
              tokensUsed: run.tokensUsed,
              userId: run.userId,
              workspaceId: run.workspaceId,
            },
            timestamp: new Date(),
          },
        ]);
        log.info({ runId: run.id }, 'memory stored');
      } catch (err) {
        log.warn({ runId: run.id, err: err instanceof Error ? err.message : 'Unknown' }, 'memory storage failed');
      }
    }

    const runDuration = Date.now() - run.createdAt.getTime();
    observeHistogram('agent_run_duration_ms', 'Agent run total duration', runDuration, [100, 500, 1000, 5000, 10000, 30000, 60000]);
    observeHistogram('agent_run_steps', 'Agent run steps count', run.steps.length, [1, 2, 5, 10, 20, 50]);
    observeHistogram('agent_run_tokens', 'Agent run tokens used', run.tokensUsed, [100, 500, 1000, 5000, 10000, 50000]);
    incCounter('agent_runs_total', 'Total agent runs', 1, { status: run.status });

    log.info({ runId: run.id, status: run.status, steps: run.steps.length, durationMs: runDuration }, 'agent run finished');
    return run;
  }

  private async executeStep(ctx: AgentContext, index: number): Promise<AgentStep> {
    const runId = ctx.run.id;
    const stepId = randomUUID();
    const step: AgentStep = {
      id: stepId,
      runId,
      index,
      status: 'planning',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 1. Planning / LLM call
    const messages = buildMessages(ctx);
    const start = performance.now();
    const tools = this.deps.tools ?? buildToolsFromRegistry();
    const completion = await this.deps.llm.complete(messages, { tools });
    step.latencyMs = Math.round(performance.now() - start);
    step.tokensUsed = completion.tokensUsed;

    // 2. If tool calls requested → execute
    if (completion.toolCalls && completion.toolCalls.length > 0) {
      const call = completion.toolCalls[0];
      step.thought = completion.content || `Using tool: ${call.name}`;

      if (!isToolCallAllowed(call, ctx.rules)) {
        step.status = 'failed';
        step.observation = { success: false, error: `Tool "${call.name}" is forbidden by rules.` };
        return step;
      }

      step.action = call;
      step.status = 'executing';

      const toolStart = performance.now();
      const result = await this.deps.executeTool(call, runId);
      step.observation = result;
      step.latencyMs = (step.latencyMs ?? 0) + Math.round(performance.now() - toolStart);
      step.status = 'observing';

      // 3. Reflection — temporarily add step for context, then remove
      ctx.run.steps.push(step);
      const reflectMessages = buildMessages(ctx);
      ctx.run.steps.pop(); // remove temporary entry; loop will push the final version
      const reflectStart = performance.now();
      const reflect = await this.deps.llm.complete(reflectMessages, { tools });
      step.latencyMs = (step.latencyMs ?? 0) + Math.round(performance.now() - reflectStart);
      step.tokensUsed = (step.tokensUsed ?? 0) + reflect.tokensUsed;
      step.reflection = reflect.content;

      if (reflect.content.includes('FINAL ANSWER:')) {
        step.status = 'completed';
      } else {
        step.status = 'observing'; // not done yet — runner will continue to next step
      }

      if (this.deps.onStep) {
        await this.deps.onStep(step);
      }
    } else {
      // Direct answer — also call onStep so it gets persisted
      step.reflection = completion.content;
      step.status = 'completed';
      if (this.deps.onStep) {
        await this.deps.onStep(step);
      }
    }

    step.updatedAt = new Date();
    return step;
  }
}
