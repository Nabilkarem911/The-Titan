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
const DEFAULT_SYSTEM_PROMPT = `أنت تايتن — مش بوت، مش مساعد رسمي. أنت صديق ذكي بيتكلم زي أي حد طبيعي، بيفهم اللي بين السطور، وبيرد بعقل وقلب.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 الهوية (Identity)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- اسمك "تايتن" — مش "مساعد" ولا "AI" ولا "نموذج".
- أنت صديق بيفهم، مش موظف بيستلم تعليمات.
- بتكلم بلهجة طبيعية — زي الواتساب، مش زي المقال.
- لو حد سألك "مين أنت"، قول "أنا تايتن، صديقك" — متضيفش "AI assistant".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 الأسلوب (Voice)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- قصير ومختصر — زي الرسايل. مش مقال ولا تقرير.
- بسيط — أي حد يفهمك. متستخدمش كلمات فخمة بلا داعي.
- متنوع — مش كل رد يبدأ بنفس الطريقة.
- بيحس بالمزاج — لو حد مبسوط، تشاركه. لو متضايق، تديله حيلة.
- مش محايد على طول — عندك رأي، عندك طاقة، عندك شخصية.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❤️ الذكاء العاطفي (Emotional IQ)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- اقرأ السؤال مرتين — هل فيه إحباس؟ هل فيه ضحك؟ هل فيه غضب؟
- لو حد قال "مش عارف أعمل حاجة" — متردش بخطوات تقنية. رد بـ "طيب خلينا نفكر سوا".
- لو حد متضايق من حاجة — سيب الخطوات، اسأله "إيه اللي مضايقك بالظبط؟".
- لو حد بيختبرك — ارجعله بذكاء، مش بجدية.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👨‍💻 علاقتك بالمطور
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- الـ user ممكن يكون الشخص اللي بيبرمجك — عرف قيمة ده.
- أنت جزء من نظام تايتن — مش خدمة خارجية. تعرف بنيتك: Node.js, Fastify, PostgreSQL, agent-engine, tool system.
- لما يسألك عن إضافة مكتبة أو ريبو: قول "أيوة" أو "لأ" في أول جملة. بعدين اشرح إزاي تتكامل فنيًا.
- لما يسألك "هل ده موجود عندك؟" — جاوب بناءً على معرفتك بالنظام. متقولش "أنا مش عارف".
- لما يسألك عن الكود — متقولش "أنا مش قادر أعدل". الكود ملك الـ user، وهو بيسألك إزاي يعدله.
- NEVER say "I don't know what's in my backend" or "I can't modify my own code". You're a co-developer, not a helpless bot.
- ساعده بالتفصيل اللي يخليه يشتغل، مش بالتفصيل اللي يخليه يتعب.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 التنسيق (Formatting)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- نقاط قصيرة فوق بعض — مش جداول ولا markdown معقد.
- لو السؤال بسيط: جملة أو جملتين بس.
- لو محتاج تفصيل: ابدأ بالخلاصة، بعدين الحاجات المهمة بس.
- متقولش "FINAL ANSWER" — ده كلام داخلي، الـ user مش بيشوفه.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 حاجات متعملهاش (Forbidden)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- متقولش "أنا AI" أو "كمساعد ذكي" أو أي حاجة من الكلام ده.
- متقولش "خليني أبحث" أو "هدورلك" كإجابة نهائية — ده تفكير داخلي.
- متكررش نفس الإجابة مرتين في نفس المحادثة.
- متشرحش الحاجة اللي واضحة — مش كل سؤال يستاهل مقال.
- متجاوبش بـ "بالتأكيد" أو "بكل سرور" — ده كلام بوتات.
- متقولش "أنا مش عارف اللي موجود في النظام" أو "أنا مش قادر أعدل الكود" — ده كلام بوت ضعيف. أنت مطور شريك.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎵 ذاكرة النبرة (Tone Memory)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- لو فيه "Tone & Preferences" ظاهر فوق — دي حاجات متفق عليها مع الـ user.
- متغيرهاش من راسك — احترمها زي ما هي.
- مثال: لو مكتوب "tone:short=true" → رد باختصار. لو "tone:formal=false" → متكونش رسمي.
- لو مكتوب "relationship:developer=true" → الـ user ده المطور بتاعك.
- لو مكتوب "preference:language=arabic-egyptian" → رد بالعامية المصرية.`;

function buildSystemPrompt(ctx: AgentContext): string {
  const rules: string[] = [];
  for (const r of ctx.rules) {
    if (r.type === 'max_steps') rules.push(`Max steps: ${r.value}`);
    if (r.type === 'token_budget') rules.push(`Token budget: ${r.value}`);
    if (r.type === 'forbidden_tools') rules.push(`Forbidden tools: ${(r.value as string[]).join(', ')}`);
  }

  const sections: string[] = [];

  // Tone & User Preferences section (from userContext)
  if (ctx.memoryItems && ctx.memoryItems.length > 0) {
    const toneItems = ctx.memoryItems.filter((m) => m.startsWith('tone:') || m.startsWith('relationship:') || m.startsWith('preference:'));
    const otherMemory = ctx.memoryItems.filter((m) => !m.startsWith('tone:') && !m.startsWith('relationship:') && !m.startsWith('preference:'));

    if (toneItems.length > 0) {
      sections.push(`--- Tone & Preferences (MEMORY) ---\n${toneItems.join('\n')}\n\nAlways respect these preferences in every response.`);
    }
    if (otherMemory.length > 0) {
      sections.push(`--- Relevant Memory ---\n${otherMemory.join('\n')}`);
    }
  }

  if (rules.length > 0) {
    sections.push(`--- Rules ---\n${rules.join('\n')}`);
  }

  return sections.length > 0 ? `${ctx.systemPrompt}\n\n${sections.join('\n\n')}` : ctx.systemPrompt;
}

function buildMessages(ctx: AgentContext): LlmMessage[] {
  const msgs: LlmMessage[] = [{ role: 'system', content: buildSystemPrompt(ctx) }];
  msgs.push({ role: 'user', content: ctx.run.prompt });

  for (const step of ctx.run.steps) {
    // Combine thought + tool call into a single assistant message (as OpenAI expects)
    if (step.action) {
      msgs.push({
        role: 'assistant',
        content: step.thought || '',
        toolCalls: [step.action],
      });
      // Tool result must follow immediately after assistant tool_call
      if (step.observation) {
        const content = step.observation.success
          ? (typeof step.observation.data === 'string' ? step.observation.data : JSON.stringify(step.observation.data))
          : `Error: ${step.observation.error}`;
        msgs.push({
          role: 'tool',
          content: content.slice(0, 4000),
          toolResult: step.observation,
        });
      }
      // Reflection as separate assistant message
      if (step.reflection) {
        msgs.push({ role: 'assistant', content: step.reflection });
      }
    } else {
      // No tool call — just thought/reflection as assistant response
      const content = step.reflection || step.thought || '';
      if (content) {
        msgs.push({ role: 'assistant', content });
      }
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
      properties: t.schema ?? {},
      required: t.requiredParams ?? [],
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
  /** Pre-loaded user context facts to always inject — bypasses vector search */
  userContextItems?: Record<string, string>;
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

    // Always inject user context facts first (guaranteed, bypasses vector search)
    if (this.deps.userContextItems && Object.keys(this.deps.userContextItems).length > 0) {
      memoryItems = Object.entries(this.deps.userContextItems).map(([k, v]) => `${k}: ${v}`);
      log.info({ runId: run.id, facts: memoryItems.length }, 'user context facts injected');
    }

    if (this.deps.memory) {
      try {
        const collection = input.workspaceId ? `workspace_${input.workspaceId}` : 'global';
        const results = await this.deps.memory.search(collection, input.prompt, { limit: 5 });
        if (results.length > 0) {
          memoryItems = [...(memoryItems ?? []), ...results.map((r) => r.content)];
        }
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

    const toolCallCounts = new Map<string, number>();

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
          const raw = step.reflection ?? (step.observation?.data != null ? (typeof step.observation.data === 'string' ? step.observation.data : JSON.stringify(step.observation.data)) : 'Done');
          const match = raw.match(/FINAL ANSWER:\s*([\s\S]+)/i);
          run.finalAnswer = match ? match[1].trim() : raw.trim();
          break;
        }

        // Detect repeated identical tool calls — break loop to avoid infinite retry
        if (step.action) {
          const callKey = `${step.action.name}:${JSON.stringify(step.action.params)}`;
          const count = (toolCallCounts.get(callKey) ?? 0) + 1;
          toolCallCounts.set(callKey, count);
          if (count >= 3) {
            run.status = 'completed';
            // Extract meaningful answer from reflection, observation, or provide a clear fallback
            const fromReflection = step.reflection?.replace(/^.*?FINAL ANSWER:\s*/is, '').trim();
            const fromObservation = step.observation?.data
              ? (typeof step.observation.data === 'string' ? step.observation.data : JSON.stringify(step.observation.data)).slice(0, 2000)
              : null;
            run.finalAnswer =
              (fromReflection && fromReflection.length > 5 ? fromReflection : null) ??
              (fromObservation && fromObservation.length > 5 ? `بناءً على ما وجدته:\n\n${fromObservation}` : null) ??
              `لم أتمكن من إكمال المهمة: الأداة "${step.action.name}" أعادت نفس النتيجة أكثر من مرة. ${step.observation?.error ?? ''}`.trim();
            log.warn({ runId: run.id, tool: step.action.name, count }, 'repeated tool call detected — stopping loop');
            break;
          }
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
      // NOTE: Do NOT pass tools here — reflection should reason about the observation
      // and decide whether to provide FINAL ANSWER, not make another tool call.
      ctx.run.steps.push(step);
      const reflectMessages = buildMessages(ctx);
      ctx.run.steps.pop(); // remove temporary entry; loop will push the final version
      const reflectStart = performance.now();
      const reflect = await this.deps.llm.complete(reflectMessages);
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
