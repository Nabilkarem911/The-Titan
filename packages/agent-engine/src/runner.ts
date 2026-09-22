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
import { TaskDecomposer } from './planner/task-decomposer.js';
import { PlanReviser } from './planner/plan-reviser.js';
import { PlanValidator } from './planner/plan-validator.js';
import { getReadySteps } from './planner/dependency-graph.js';
import { SelfCritic } from './reflection/self-critic.js';
import { ConfidenceScorer } from './reflection/confidence-scorer.js';
import { RetryStrategist } from './reflection/retry-strategist.js';
import { StrategySelector } from './strategies/strategy-selector.js';
import type { StrategyName } from './strategies/types.js';
import type { ExecutionPlan } from './planner/types.js';
import { buildAdaptivePrompt } from './personality/prompt-builder.js';
import type { SelfForge } from './self-forge/self-forge.js';
import type { MetaMonitor } from './metacognition/meta-monitor.js';
import type { SelfImprover } from './metacognition/self-improver.js';
import type { WorldSimulator, EnvironmentGraph } from './world-model/index.js';
import { ContextOptimizer, type ContextOptimizationOptions } from './providers/context-optimizer.js';
import type { AntiSycophancyModule } from './metacognition/anti-sycophancy.js';
import type { DreamMode } from './reasoning/dream-mode.js';
import type { CausalReplay } from './reasoning/causal-replay.js';
import type { MetacognitiveConsolidation } from './metacognition/metacognitive-consolidation.js';
import type { HeuristicExtractor } from './learning/heuristic-extractor.js';
import type { EmotionalIntelligence } from './metacognition/emotional-intelligence.js';
import type { TheoryOfMind } from './metacognition/theory-of-mind.js';
import type { SafetyGuardrail } from './metacognition/safety-guardrail.js';
import type { ExecutionStateMemory } from './reasoning/execution-state-memory.js';
import type { HypothesisTester } from './reasoning/hypothesis-tester.js';
import type { SelfHealingDebugger } from './reasoning/self-healing-debugger.js';
import type { IntrospectiveAwareness } from './introspection/introspective-awareness.js';
import type { InnerMonologueManager } from './mirror/inner-monologue.js';
import type { NormativeAgency } from './mirror/normative-agency.js';
import type { EdgePrivacy } from './learning/edge-privacy.js';
import type { WiredCapabilities } from './capability-wiring.js';

const log = getLogger().child({ component: 'agent-runner' });

const DEFAULT_MAX_STEPS = 10;

function buildSystemPrompt(ctx: AgentContext, userMessage?: string): string {
  if (ctx.systemPrompt && !ctx.systemPrompt.includes('تايتن') && !ctx.systemPrompt.includes('Titan')) {
    // Custom system prompt from agent profile — use it directly with rules/memory
    const sections: string[] = [ctx.systemPrompt];

    if (ctx.memoryItems && ctx.memoryItems.length > 0) {
      sections.push(`--- Relevant Memory ---\n${ctx.memoryItems.join('\n')}`);
    }

    return sections.join('\n\n');
  }

  return buildAdaptivePrompt(ctx, userMessage, ctx.run.locale);
}

function buildMessages(ctx: AgentContext): LlmMessage[] {
  const msgs: LlmMessage[] = [{ role: 'system', content: buildSystemPrompt(ctx, ctx.run.prompt) }];

  if (ctx.conversationHistory && ctx.conversationHistory.length > 0) {
    for (const msg of ctx.conversationHistory) {
      msgs.push({ role: msg.role, content: msg.content });
    }
  }

  msgs.push({ role: 'user', content: ctx.run.prompt });

  for (const step of ctx.run.steps) {
    // Combine thought + tool call into a single assistant message (as OpenAI expects)
    if (step.action) {
      msgs.push({
        role: 'assistant',
        content: step.thought || '',
        toolCalls: [step.action],
        reasoningContent: step.reasoningContent,
      });
      // Tool result must follow immediately after assistant tool_call
      if (step.observation) {
        const rawContent = step.observation.success
          ? (typeof step.observation.data === 'string' ? step.observation.data : JSON.stringify(step.observation.data))
          : `Error: ${step.observation.error}`;
        const content = rawContent.slice(0, 4000);
        msgs.push({
          role: 'tool',
          content,
          toolResult: step.observation,
        });
      }
      // Reflection as separate assistant message
      if (step.reflection) {
        msgs.push({ role: 'assistant', content: step.reflection, reasoningContent: step.reasoningContent });
      }
    } else {
      // No tool call — just thought/reflection as assistant response
      const content = step.reflection || step.thought || '';
      if (content) {
        msgs.push({ role: 'assistant', content, reasoningContent: step.reasoningContent });
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

/**
 * حقن حقايق المستخدم في البرومبت — بسقف وأولويات.
 *
 * ⚠️ السبب (مقاس 2026-09): الحقايق كانت بتتحقن كاملة وبلا سقف، وده بيتكرر
 * مع كل خطوة → البرومبت بيتضخم والتكلفة بتزيد. إضافة لمفاتيح داخلية
 * (_identity_*_json) مش محتاجة في المحادثة.
 *
 * الترتيب: الحقايق الجوهرية الأول، وبعدين الباقي لحد السقف.
 */
const USER_CONTEXT_MAX_CHARS = 1_200;
const USER_CONTEXT_SKIP = /^_|^(telegram_screenshots|call_name|favorite_project)$/;
const USER_CONTEXT_CORE = ['name', 'city', 'job', 'role', 'style', 'son', 'wife', 'age', 'prefers', 'dislikes'];

export function buildUserContextItems(items: Record<string, string>): string[] {
  const entries = Object.entries(items).filter(([k, v]) => !!v && !!v.trim() && !USER_CONTEXT_SKIP.test(k));
  entries.sort(([a], [b]) => {
    const ra = USER_CONTEXT_CORE.indexOf(a), rb = USER_CONTEXT_CORE.indexOf(b);
    return (ra === -1 ? 999 : ra) - (rb === -1 ? 999 : rb);
  });
  const out: string[] = [];
  let used = 0;
  for (const [k, v] of entries) {
    const line = `${k}: ${v}`;
    if (used + line.length > USER_CONTEXT_MAX_CHARS) continue;
    out.push(line);
    used += line.length;
  }
  return out;
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
  /** Enable advanced planning for complex tasks */
  enablePlanning?: boolean;
  /** Enable self-critique of final answers */
  enableSelfCritique?: boolean;
  /** Force a specific reasoning strategy instead of auto-selection */
  strategy?: StrategyName;
  /** Enable auto strategy selection based on task classification */
  enableAutoStrategy?: boolean;
  /** Self-Forge: agent can write its own tools when it detects a capability gap */
  selfForge?: SelfForge;
  /** Metacognition: monitor reasoning quality and switch strategies when confidence is low */
  metaMonitor?: MetaMonitor;
  /** Self-Improver: analyze runs after completion and propose improvements */
  selfImprover?: SelfImprover;
  /** World Model: simulate actions before executing dangerous tool calls */
  worldSimulator?: WorldSimulator;
  /** Environment Graph: records entities, relations, and events for the world model */
  environmentGraph?: EnvironmentGraph;
  /** Context Optimizer: reduce token usage by filtering tools, compacting history, truncating outputs */
  contextOptimizer?: ContextOptimizer;
  /** Context optimization options (used if contextOptimizer not provided) */
  contextOptimization?: ContextOptimizationOptions;
  /** Anti-Sycophancy: detect and correct sycophantic behavior in agent responses */
  antiSycophancy?: AntiSycophancyModule;
  /** Dream Mode: consolidate memories in background after runs */
  dreamMode?: DreamMode;
  /** Causal Replay: analyze which step caused a failure */
  causalReplay?: CausalReplay;
  /** Metacognitive Consolidation: 3-level hierarchical memory consolidation */
  metacognitiveConsolidation?: MetacognitiveConsolidation;
  /** Heuristic Extractor: extract transferable heuristics from runs */
  heuristicExtractor?: HeuristicExtractor;
  /** Emotional Intelligence: detect user emotions and adapt response */
  emotionalIntelligence?: EmotionalIntelligence;
  /** Theory of Mind: model user beliefs and desires */
  theoryOfMind?: TheoryOfMind;
  /** Safety Guardrail: TRIAD safety checks before tool execution */
  safetyGuardrail?: SafetyGuardrail;
  /** Execution State Memory: checkpoint/resume for long tasks */
  executionStateMemory?: ExecutionStateMemory;
  /** Hypothesis Tester: scientific method for debugging */
  hypothesisTester?: HypothesisTester;
  /** Self-Healing Debugger: multi-agent debugging pipeline */
  selfHealingDebugger?: SelfHealingDebugger;
  /** Introspective Awareness: self-model with bias detection */
  introspectiveAwareness?: IntrospectiveAwareness;
  /** Inner Monologue: MIRROR consciousness thought tracking */
  innerMonologue?: InnerMonologueManager;
  /** Normative Agency: commitments and conflict detection */
  normativeAgency?: NormativeAgency;
  /** Edge Privacy: route to local models for sensitive data */
  edgePrivacy?: EdgePrivacy;
  /** Full capability wiring — wires all cosmic modules at once */
  wiredCapabilities?: WiredCapabilities;
}

export class AgentRunner {
  private planner?: TaskDecomposer;
  private planReviser?: PlanReviser;
  private planValidator?: PlanValidator;
  private critic?: SelfCritic;
  private confidenceScorer?: ConfidenceScorer;
  private retryStrategist?: RetryStrategist;
  private strategySelector?: StrategySelector;
  private selfForge?: SelfForge;
  private metaMonitor?: MetaMonitor;
  private selfImprover?: SelfImprover;
  private worldSimulator?: WorldSimulator;
  private environmentGraph?: EnvironmentGraph;
  private contextOptimizer?: ContextOptimizer;
  private antiSycophancy?: AntiSycophancyModule;
  private dreamMode?: DreamMode;
  private causalReplay?: CausalReplay;
  private metacognitiveConsolidation?: MetacognitiveConsolidation;
  private heuristicExtractor?: HeuristicExtractor;
  private emotionalIntelligence?: EmotionalIntelligence;
  private theoryOfMind?: TheoryOfMind;
  private safetyGuardrail?: SafetyGuardrail;
  private executionStateMemory?: ExecutionStateMemory;
  private hypothesisTester?: HypothesisTester;
  private selfHealingDebugger?: SelfHealingDebugger;
  private introspectiveAwareness?: IntrospectiveAwareness;
  private innerMonologue?: InnerMonologueManager;
  private normativeAgency?: NormativeAgency;
  private edgePrivacy?: EdgePrivacy;

  constructor(private deps: AgentRunnerDeps) {
    if (deps.enablePlanning) {
      this.planner = new TaskDecomposer({ llm: deps.llm });
      this.planReviser = new PlanReviser(deps.llm);
      this.planValidator = new PlanValidator(deps.llm);
    }
    if (deps.enableSelfCritique) {
      this.critic = new SelfCritic(deps.llm);
      this.confidenceScorer = new ConfidenceScorer(deps.llm);
    }
    if (deps.enableAutoStrategy || deps.strategy) {
      this.strategySelector = new StrategySelector(deps.enableAutoStrategy ? deps.llm : undefined);
      this.retryStrategist = new RetryStrategist(deps.llm);
    }
    this.selfForge = deps.selfForge;
    this.metaMonitor = deps.metaMonitor;
    this.selfImprover = deps.selfImprover;
    this.worldSimulator = deps.worldSimulator;
    this.environmentGraph = deps.environmentGraph;
    this.contextOptimizer = deps.contextOptimizer ?? (deps.contextOptimization ? new ContextOptimizer(deps.contextOptimization) : undefined);
    this.antiSycophancy = deps.antiSycophancy;
    // Wire extended capabilities (either individually or via full wiring)
    if (deps.wiredCapabilities) {
      const wc = deps.wiredCapabilities;
      this.dreamMode = wc.dreamMode;
      this.causalReplay = wc.causalReplay;
      this.metacognitiveConsolidation = wc.metacognitiveConsolidation;
      this.heuristicExtractor = wc.heuristicExtractor;
      this.emotionalIntelligence = wc.emotionalIntelligence;
      this.theoryOfMind = wc.theoryOfMind;
      this.safetyGuardrail = wc.safetyGuardrail;
      this.executionStateMemory = wc.executionStateMemory;
      this.hypothesisTester = wc.hypothesisTester;
      this.selfHealingDebugger = wc.selfHealingDebugger;
      this.introspectiveAwareness = wc.introspectiveAwareness;
      this.innerMonologue = wc.innerMonologue;
      this.normativeAgency = wc.normativeAgency;
      this.edgePrivacy = wc.edgePrivacy;
      // Also wire the base modules if not already provided
      this.selfForge ??= wc.selfForge;
      this.metaMonitor ??= wc.metaMonitor;
      this.selfImprover ??= wc.selfImprover;
      this.worldSimulator ??= wc.worldSimulator;
      this.environmentGraph ??= wc.environmentGraph;
      this.antiSycophancy ??= wc.antiSycophancy;
    } else {
      this.dreamMode = deps.dreamMode;
      this.causalReplay = deps.causalReplay;
      this.metacognitiveConsolidation = deps.metacognitiveConsolidation;
      this.heuristicExtractor = deps.heuristicExtractor;
      this.emotionalIntelligence = deps.emotionalIntelligence;
      this.theoryOfMind = deps.theoryOfMind;
      this.safetyGuardrail = deps.safetyGuardrail;
      this.executionStateMemory = deps.executionStateMemory;
      this.hypothesisTester = deps.hypothesisTester;
      this.selfHealingDebugger = deps.selfHealingDebugger;
      this.introspectiveAwareness = deps.introspectiveAwareness;
      this.innerMonologue = deps.innerMonologue;
      this.normativeAgency = deps.normativeAgency;
      this.edgePrivacy = deps.edgePrivacy;
    }
  }

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
      locale: input.locale,
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
      // سقف + أولويات — بدل الحقن الكامل اللي كان بيضخّم البرومبت مع كل خطوة
      memoryItems = buildUserContextItems(this.deps.userContextItems);
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
      systemPrompt: input.systemPromptExtra ?? '',
      rules,
      memoryItems,
      conversationHistory: input.conversationHistory,
    };

    const toolCallCounts = new Map<string, number>();

    // --- Strategy-based execution ---
    if (this.strategySelector && (this.deps.strategy || this.deps.enableAutoStrategy)) {
      try {
        const tools = this.deps.tools ?? buildToolsFromRegistry();
        const strategyCtx = {
          run,
          systemPrompt: buildSystemPrompt(ctx, run.prompt),
          memoryItems: ctx.memoryItems,
          tools,
          llm: this.deps.llm,
          executeTool: this.deps.executeTool,
          onStep: this.deps.onStep,
          contextOptimizer: this.contextOptimizer,
        };

        let strategy;
        let classification;
        if (this.deps.strategy) {
          strategy = this.strategySelector.getStrategy(this.deps.strategy);
        } else {
          const selected = await this.strategySelector.autoSelect(input.prompt);
          strategy = selected.strategy;
          classification = selected.classification;
          log.info({ runId: run.id, strategy: selected.classification.recommendedStrategy, type: selected.classification.type }, 'auto-selected strategy');
        }

        // Ambiguous request — ask for clarification instead of guessing.
        // BUT never short-circuit when we hold user context/memory: a vague message
        // from a known user should be answered from context (persona + facts), not
        // met with a canned "what do you want?" wall.
        const hasUserContext = !!this.deps.userContextItems && Object.keys(this.deps.userContextItems).length > 0;
        if (classification?.type === 'ambiguous' && !hasUserContext) {
          const isArabic = /[\u0600-\u06FF]/.test(input.prompt);
          const clarification = isArabic
            ? 'مش متأكد تمامًا إيه اللي تحتاجه بالظبط. ممكن توضح أكتر؟ يعني مثلاً:\n- عايز أساعدك في كود أو مشروع؟\n- عايز معلومات عن حاجة معينة؟\n- عايز أحلل داتا أو ملف؟\n- ولا حاجة تانية خالص؟\n\nقولي بالظبط وأنا أنفذ.'
            : 'I\'m not entirely sure what you need. Could you clarify? For example:\n- Do you want help with code or a project?\n- Do you need information about something specific?\n- Do you want me to analyze data or a file?\n- Or something else entirely?\n\nJust tell me specifically and I\'ll get it done.';

          const step: AgentStep = {
            id: randomUUID(),
            runId: run.id,
            index: 1,
            status: 'completed',
            thought: 'Ambiguous request detected — asking for clarification',
            reflection: clarification,
            tokensUsed: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          run.steps = [step];
          run.finalAnswer = clarification;
          run.status = 'completed';
          run.currentStep = 1;
          if (this.deps.onStep) await this.deps.onStep(step);
          log.info({ runId: run.id }, 'ambiguous request — returned clarification');
          return run;
        }

        // Use strategy only for non-react strategies; react falls through to classic loop
        if (strategy.name !== 'react') {
          const result = await strategy.execute(strategyCtx);
          run.steps = result.steps;
          run.tokensUsed = result.tokensUsed;
          run.currentStep = result.steps.length;
          run.finalAnswer = result.finalAnswer;
          run.status = 'completed';

          // Self-critique if enabled
          if (this.critic && run.finalAnswer) {
            const critique = await this.critic.quickCheck(run.finalAnswer, run.prompt);
            if (!critique.pass && critique.reason) {
              log.info({ runId: run.id, reason: critique.reason }, 'self-critique failed — requesting revision');
              const fullCritique = await this.critic.critique(run);
              if (fullCritique.revisedAnswer) {
                run.finalAnswer = fullCritique.revisedAnswer;
              }
            }
          }

          // Confidence scoring
          if (this.confidenceScorer) {
            const score = this.confidenceScorer.heuristicScore(run);
            log.info({ runId: run.id, confidence: score.overall }, 'confidence score');
          }

          return this.finishRun(run, input);
        }
      } catch (err) {
        log.warn({ runId: run.id, err: err instanceof Error ? err.message : 'Unknown' }, 'strategy execution failed — falling back to classic ReAct');
      }
    }

    // --- Plan-and-Execute mode ---
    if (this.planner && this.planner.isComplexTask(input.prompt)) {
      try {
        const tools = this.deps.tools ?? buildToolsFromRegistry();
        const plan = await this.planner.decompose(input.prompt, tools);
        log.info({ runId: run.id, planId: plan.id, steps: plan.steps.length }, 'plan created for complex task');
        return this.executePlan(run, plan, ctx, input);
      } catch (err) {
        log.warn({ runId: run.id, err: err instanceof Error ? err.message : 'Unknown' }, 'planning failed — falling back to classic ReAct');
      }
    }

    // --- Classic ReAct loop ---
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
          const raw = step.reflection ?? step.thought ?? '';
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
            const isArabic = run.locale === 'ar';
            run.finalAnswer =
              (fromReflection && fromReflection.length > 5 ? fromReflection : null) ??
              (fromObservation && fromObservation.length > 5
                ? (isArabic ? `بناءً على ما وجدته:\n\n${fromObservation}` : `Based on what I found:\n\n${fromObservation}`)
                : null) ??
              (isArabic
                ? `لم أتمكن من إكمال المهمة: الأداة "${step.action.name}" أعادت نفس النتيجة أكثر من مرة. ${step.observation?.error ?? ''}`.trim()
                : `Unable to complete the task: tool "${step.action.name}" returned the same result multiple times. ${step.observation?.error ?? ''}`.trim());
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

    // Self-critique (classic ReAct path)
    if (this.critic && run.finalAnswer && run.status === 'completed') {
      try {
        const critique = await this.critic.quickCheck(run.finalAnswer, run.prompt);
        if (!critique.pass && critique.reason) {
          const fullCritique = await this.critic.critique(run);
          if (fullCritique.revisedAnswer) {
            run.finalAnswer = fullCritique.revisedAnswer;
            log.info({ runId: run.id }, 'answer revised after self-critique');
          }
        }
      } catch {
        // critique is optional — don't fail the run
      }
    }

    // Confidence scoring (classic ReAct path)
    if (this.confidenceScorer && run.finalAnswer) {
      try {
        const score = await this.confidenceScorer.score(run);
        log.info({ runId: run.id, confidence: score.overall, dimensions: score.dimensions }, 'confidence scored');
        incCounter('agent_low_confidence', 'Runs with confidence below 50', 1, { below: score.overall < 50 ? 'true' : 'false' });
      } catch {
        // scoring is optional
      }
    }

    // Metacognition: assess reasoning quality (classic ReAct path)
    if (this.metaMonitor && run.steps.length > 0) {
      try {
        const assessment = await this.metaMonitor.assess(run);
        log.info({ runId: run.id, metaConfidence: assessment.overallConfidence, recommendation: assessment.recommendation }, 'metacognitive assessment');
        incCounter('meta_monitor_run', 'Metacognitive run assessments', 1, { recommendation: assessment.recommendation });
      } catch {
        // metacognition is optional
      }
    }

    // Self-Improver: analyze run and propose improvements (classic ReAct path)
    if (this.selfImprover && run.steps.length > 0) {
      try {
        const proposals = await this.selfImprover.analyzeRun(run);
        if (proposals.length > 0) {
          log.info({ runId: run.id, proposals: proposals.length }, 'self-improver generated proposals');
        }
      } catch {
        // self-improvement is optional
      }
    }

    // Anti-Sycophancy: detect and flag sycophantic behavior (classic ReAct path)
    if (this.antiSycophancy && run.finalAnswer) {
      try {
        const assessment = this.antiSycophancy.assessQuick(run.finalAnswer, run.prompt);
        if (assessment.isSycophantic) {
          log.info({ runId: run.id, level: assessment.level, dissent: assessment.dissentRecommended }, 'sycophantic behavior detected');
        }
      } catch {
        // anti-sycophancy is optional
      }
    }

    // Emotional Intelligence: detect user emotion from prompt
    if (this.emotionalIntelligence && run.prompt) {
      try {
        const emotion = await this.emotionalIntelligence.analyze(run.prompt);
        log.info({ runId: run.id, emotion: emotion.dominantUserEmotion, valence: emotion.valence }, 'emotional intelligence detected user emotion');
        incCounter('emotion_detected', 'User emotions detected', 1, { emotion: emotion.dominantUserEmotion });
      } catch {
        // emotional intelligence is optional
      }
    }

    // Theory of Mind: model user beliefs
    if (this.theoryOfMind && run.prompt) {
      try {
        const model = await this.theoryOfMind.analyze('user', { entityType: 'user', messages: [{ role: 'user', content: run.prompt }] });
        log.info({ runId: run.id, predictedAction: model.predictedNextAction }, 'theory of mind modeled user');
      } catch {
        // theory of mind is optional
      }
    }

    // Safety Guardrail: check final answer for safety
    if (this.safetyGuardrail && run.finalAnswer) {
      try {
        const check = await this.safetyGuardrail.check(run.finalAnswer, run.prompt);
        if (check.decision !== 'proceed') {
          log.warn({ runId: run.id, decision: check.decision }, 'safety guardrail flagged response');
          incCounter('safety_guardrail_flagged', 'Responses flagged by safety guardrail', 1);
        }
      } catch {
        // safety guardrail is optional
      }
    }

    // Heuristic Extractor: extract transferable heuristics from run
    if (this.heuristicExtractor && run.steps.length > 0) {
      try {
        const trajectory = run.steps.map(s => s.thought || s.action?.name || '').join(' -> ');
        const result = await this.heuristicExtractor.extract(run.id, run.status === 'completed' ? 'success' : 'failure', trajectory);
        log.info({ runId: run.id, heuristics: result.extractedHeuristics.length }, 'heuristic extractor extracted transferable rules');
      } catch {
        // heuristic extraction is optional
      }
    }

    // Metacognitive Consolidation: consolidate memory after run
    if (this.metacognitiveConsolidation && run.steps.length > 0) {
      try {
        await this.metacognitiveConsolidation.consolidate();
        log.info({ runId: run.id }, 'metacognitive consolidation completed');
      } catch {
        // consolidation is optional
      }
    }

    // Introspective Awareness: self-reflect on the run
    if (this.introspectiveAwareness && run.steps.length > 0) {
      try {
        const reflection = await this.introspectiveAwareness.introspect(`Run ${run.id} with status ${run.status}`);
        log.info({ runId: run.id, confidence: reflection.confidenceLevel }, 'introspective awareness completed');
      } catch {
        // introspection is optional
      }
    }

    // Inner Monologue: record thought trace
    if (this.innerMonologue && run.steps.length > 0) {
      try {
        for (const step of run.steps) {
          if (step.thought) {
            this.innerMonologue.addThread('reasoning', step.thought);
          }
        }
      } catch {
        // inner monologue is optional
      }
    }

    // Causal Replay: if run failed, analyze root cause
    if (this.causalReplay && run.status === 'failed' && run.steps.length > 0) {
      try {
        const analysis = await this.causalReplay.analyzeRun(run);
        log.info({ runId: run.id, rootCause: analysis.rootCause }, 'causal replay identified root cause');
      } catch {
        // causal replay is optional
      }
    }

    // Dream Mode: trigger background consolidation after run
    if (this.dreamMode && run.steps.length > 0) {
      try {
        this.dreamMode.start();
        log.debug({ runId: run.id }, 'dream mode started for background consolidation');
      } catch {
        // dream mode is optional
      }
    }

    // Edge Privacy: log if sensitive data was detected
    if (this.edgePrivacy && run.prompt) {
      try {
        const isSensitive = this.edgePrivacy.isPrivacyMode();
        if (isSensitive) {
          log.info({ runId: run.id }, 'edge privacy mode active — local model recommended');
          incCounter('edge_privacy_sensitive', 'Sensitive prompts detected', 1);
        }
      } catch {
        // edge privacy is optional
      }
    }

    return this.finishRun(run, input);
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
    let messages = buildMessages(ctx);
    let tools = this.deps.tools ?? buildToolsFromRegistry();

    // Apply context optimization if enabled
    if (this.contextOptimizer) {
      const originalTokens = this.contextOptimizer.estimateTokens(messages, tools);

      // Compact conversation history
      const compacted = this.contextOptimizer.compactHistory(messages, ctx.run.steps);
      messages = compacted.messages;

      // Filter tools based on usage and prompt relevance
      const filtered = this.contextOptimizer.optimizeTools(tools, ctx.run.steps, ctx.run.prompt);
      tools = filtered.tools;

      const optimizedTokens = this.contextOptimizer.estimateTokens(messages, tools);
      const saved = originalTokens - optimizedTokens;
      if (saved > 0) {
        this.contextOptimizer.recordOptimization(saved);
        log.debug({ runId, step: index, tokensSaved: saved }, 'context optimized');
      }
    }

    const start = performance.now();
    const completion = await this.deps.llm.complete(messages, { tools });
    step.latencyMs = Math.round(performance.now() - start);
    step.tokensUsed = completion.tokensUsed;
    step.reasoningContent = completion.reasoningContent;

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

      // World Model: simulate action before executing dangerous tools
      if (this.worldSimulator) {
        try {
          const sim = await this.worldSimulator.simulate(call.name, call.name, call.params);
          if (!sim.shouldProceed) {
            log.warn({ runId, tool: call.name, risks: sim.risks }, 'world model blocked dangerous action');
            step.status = 'failed';
            step.observation = {
              success: false,
              error: `Action blocked by world model simulator: ${sim.risks.join(', ')}. Recommendations: ${sim.recommendations.join('; ')}`,
            };
            return step;
          }
        } catch {
          // simulation is optional — proceed on failure
        }
      }

      const toolStart = performance.now();
      let result = await this.deps.executeTool(call, runId);

      // Record event in environment graph
      if (this.environmentGraph) {
        this.environmentGraph.recordEvent({
          actor: call.name,
          action: call.name,
          target: String(call.params?.['target'] ?? call.params?.['path'] ?? 'unknown'),
          result: result.success ? 'success' : 'failure',
          durationMs: Math.round(performance.now() - toolStart),
          context: call.params as Record<string, unknown>,
        });
      }

      // Self-Forge: if tool is unknown and self-forge is enabled, try to create it
      if (!result.success && result.error?.includes('Unknown tool') && this.selfForge) {
        log.info({ runId, toolName: call.name }, 'self-forge: attempting to create missing tool');
        try {
          const forgeResult = await this.selfForge.forgeTool(
            `Tool named "${call.name}" with params: ${JSON.stringify(call.params)}`,
            `Agent tried to call "${call.name}" but it does not exist in the registry`,
          );
          if (forgeResult.success && forgeResult.toolName) {
            log.info({ runId, toolName: forgeResult.toolName }, 'self-forge: tool created — retrying execution');
            // Rebuild tools list and retry with the newly forged tool
            result = await this.deps.executeTool({ ...call, name: forgeResult.toolName }, runId);
          }
        } catch (forgeErr) {
          log.warn({ runId, err: forgeErr instanceof Error ? forgeErr.message : 'Unknown' }, 'self-forge: failed to create tool');
        }
      }

      step.observation = result;
      step.latencyMs = (step.latencyMs ?? 0) + Math.round(performance.now() - toolStart);
      step.status = 'observing';

      // 3. After observing tool result, let the loop continue naturally.
      // The NEXT iteration's planning phase will see the tool result and decide:
      // use another tool, or provide final answer.
      // No separate reflection LLM call — saves tokens and avoids forcing premature answers.
      step.status = 'observing';

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

  private async executePlan(run: AgentRun, plan: ExecutionPlan, ctx: AgentContext, input: AgentRunInput): Promise<AgentRun> {
    if (this.planValidator) {
      const validation = this.planValidator.validateStructure(plan);
      if (!validation.valid) {
        log.warn({ runId: run.id, errors: validation.errors }, 'plan validation failed before execution');
        run.finalAnswer = `Plan validation failed: ${validation.errors.join('; ')}`;
        run.status = 'failed';
        return run;
      }
      if (validation.warnings.length > 0) {
        log.info({ runId: run.id, warnings: validation.warnings }, 'plan validation warnings');
      }
    }

    plan.status = 'active';
    const maxPlanSteps = Math.min(plan.steps.length * 2, run.maxSteps);

    try {
      while (run.currentStep < maxPlanSteps) {
        const readySteps = getReadySteps(plan.steps);
        if (readySteps.length === 0) {
          const pending = plan.steps.filter((s) => s.status === 'pending');
          if (pending.length === 0) break;
          log.warn({ runId: run.id }, 'no ready steps but pending remain — possible deadlock');
          break;
        }

        for (const planStep of readySteps) {
          planStep.status = 'in_progress';
          run.currentStep++;

          const stepPrompt = planStep.toolHint
            ? `${planStep.description}\n\nHint: use the "${planStep.toolHint}" tool.`
            : planStep.description;

          const agentStep = await this.executeStep(
            { ...ctx, run: { ...ctx.run, prompt: stepPrompt, steps: run.steps } },
            run.currentStep,
          );

          run.steps.push(agentStep);
          run.tokensUsed += agentStep.tokensUsed ?? 0;

          if (agentStep.status === 'completed' || agentStep.observation?.success) {
            planStep.status = 'completed';
            planStep.result = agentStep.reflection || agentStep.observation?.data?.toString() || 'Done';
          } else {
            planStep.status = 'failed';
            planStep.error = agentStep.observation?.error || 'Step failed';
            planStep.retries++;

            // Try to revise the plan
            if (this.planReviser && this.planReviser.canRevise(plan)) {
              const revision = await this.planReviser.revise(plan, planStep.id, planStep.error);
              if (revision) {
                plan.steps = revision.revisedPlan.steps;
                plan.revisionCount = revision.revisedPlan.revisionCount;
                log.info({ runId: run.id, revision: plan.revisionCount }, 'plan revised after failure');
                continue;
              }
            }
          }

          if (this.deps.persistRun) await this.deps.persistRun(run);

          if (run.tokenBudget && run.tokensUsed >= run.tokenBudget) {
            run.finalAnswer = 'Token budget exhausted during plan execution.';
            run.status = 'completed';
            return this.finishRun(run, input);
          }
        }
      }

      // Synthesize results from all completed plan steps
      const completedResults = plan.steps
        .filter((s) => s.status === 'completed' && s.result)
        .map((s) => s.result as string);

      if (completedResults.length > 0) {
        run.finalAnswer = completedResults.length === 1
          ? completedResults[0]
          : await this.synthesizePlanResults(run.prompt, completedResults);
      } else {
        run.finalAnswer = 'Plan execution completed with no results.';
      }

      run.status = 'completed';
    } catch (err) {
      run.status = 'failed';
      run.finalAnswer = err instanceof Error ? err.message : 'Plan execution failed';
      log.error({ runId: run.id, err }, 'plan execution failed');
    }

    // Self-critique the final result
    if (this.critic && run.finalAnswer) {
      try {
        const critique = await this.critic.quickCheck(run.finalAnswer, run.prompt);
        if (!critique.pass && critique.reason) {
          const fullCritique = await this.critic.critique(run);
          if (fullCritique.revisedAnswer) {
            run.finalAnswer = fullCritique.revisedAnswer;
            log.info({ runId: run.id }, 'answer revised after self-critique');
          }
        }
      } catch {
        log.warn({ runId: run.id }, 'self-critique failed — keeping original answer');
      }
    }

    // Confidence scoring (plan execution path)
    if (this.confidenceScorer && run.finalAnswer) {
      try {
        const score = await this.confidenceScorer.score(run);
        log.info({ runId: run.id, confidence: score.overall, dimensions: score.dimensions }, 'confidence scored (plan)');
      } catch {
        // scoring is optional
      }
    }

    return this.finishRun(run, input);
  }

  private async synthesizePlanResults(prompt: string, results: string[]): Promise<string> {
    try {
      const completion = await this.deps.llm.complete([
        { role: 'system', content: 'Combine the following step results into a single coherent answer. Be concise.' },
        { role: 'user', content: `Original question: ${prompt}\n\nStep results:\n${results.map((r, i) => `${i + 1}. ${r}`).join('\n')}` },
      ]);
      return completion.content;
    } catch {
      return results.join('\n\n');
    }
  }

  private async finishRun(run: AgentRun, input: AgentRunInput): Promise<AgentRun> {
    if (this.deps.persistRun) {
      await this.deps.persistRun(run);
    }

    if (this.deps.memory) {
      try {
        const collection = input.workspaceId ? `workspace_${input.workspaceId}` : 'global';
        const baseMeta = {
          agentId: run.agentId,
          status: run.status,
          steps: run.steps.length,
          tokensUsed: run.tokensUsed,
          userId: run.userId,
          workspaceId: run.workspaceId,
        };
        const answer = (run.finalAnswer ?? 'N/A').trim();
        // ⚠️ بنخزّن السؤال والإجابة كعناصر مستقلة كمان، وليس النص الملزوق فقط.
        // السبب: البحث الدلالي بيقارن سؤال قصير بنصوص قصيرة أدق بكتير من نص طويل
        // مخلوط (المقاس الفعلي على ذاكرة نبيل: 0.68-0.75 → دلوقتي أدق).
        await this.deps.memory.upsert(collection, [
          {
            id: run.id,
            content: `Prompt: ${run.prompt}\nAnswer: ${answer}`,
            metadata: { ...baseMeta, derived: 'turn' },
            timestamp: new Date(),
          },
          {
            id: `${run.id}:q`,
            content: `سؤال: ${run.prompt}`,
            metadata: { ...baseMeta, derived: 'prompt', parentId: run.id },
            timestamp: new Date(),
          },
          {
            id: `${run.id}:a`,
            content: `إجابة: ${answer.slice(0, 600)}`,
            metadata: { ...baseMeta, derived: 'answer', parentId: run.id },
            timestamp: new Date(),
          },
        ]);
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
}
