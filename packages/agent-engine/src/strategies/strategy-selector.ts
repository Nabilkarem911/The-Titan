import { getLogger } from '@titan/logging';
import type { LlmProvider } from '../types.js';
import type { StrategyName, ReasoningStrategy, TaskClassification } from './types.js';
import { ChainOfThoughtStrategy } from './chain-of-thought.js';
import { TreeOfThoughtStrategy } from './tree-of-thought.js';
import { DebateStrategy } from './debate.js';
import { HypothesisTestingStrategy } from './hypothesis-testing.js';

const log = getLogger().child({ component: 'strategy-selector' });

const CLASSIFY_PROMPT = `Classify this task into exactly one category:

- simple_qa: Direct factual question with a clear answer
- complex_reasoning: Requires multi-step logical reasoning
- creative: Open-ended creative task (writing, brainstorming)
- analytical: Data analysis, comparison, or evaluation
- multi_step: Task requiring multiple sequential actions (build, deploy, fix)
- controversial: Topic with multiple valid viewpoints or trade-offs
- debugging: Investigating an error, bug, crash, or unexpected behavior
- ambiguous: Vague or unclear request that needs clarification (e.g., "do something useful", "اعمل حاجة مفيدة")
- code_review: User provided code and asked for a review (e.g., "code review", "راجع الكود", "افحص الكود")

Respond ONLY with JSON:
{ "type": "...", "confidence": 0-100, "reasoning": "..." }`;

const STRATEGY_MAP: Record<string, StrategyName> = {
  simple_qa: 'chain-of-thought',
  complex_reasoning: 'tree-of-thought',
  creative: 'chain-of-thought',
  analytical: 'tree-of-thought',
  multi_step: 'chain-of-thought',
  controversial: 'debate',
  debugging: 'hypothesis-testing',
  ambiguous: 'chain-of-thought',
  code_review: 'chain-of-thought',
};

export class StrategySelector {
  private strategies: Map<StrategyName, ReasoningStrategy>;

  constructor(private llm?: LlmProvider) {
    this.strategies = new Map<StrategyName, ReasoningStrategy>();
    this.strategies.set('chain-of-thought', new ChainOfThoughtStrategy());
    this.strategies.set('tree-of-thought', new TreeOfThoughtStrategy());
    this.strategies.set('debate', new DebateStrategy());
    this.strategies.set('hypothesis-testing', new HypothesisTestingStrategy());
  }

  getStrategy(name: StrategyName): ReasoningStrategy {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      log.warn({ name }, 'unknown strategy — falling back to chain-of-thought');
      return this.strategies.get('chain-of-thought')!;
    }
    return strategy;
  }

  async autoSelect(prompt: string): Promise<{ strategy: ReasoningStrategy; classification: TaskClassification }> {
    const classification = this.llm
      ? await this.classifyWithLlm(prompt)
      : this.classifyWithHeuristics(prompt);

    const strategy = this.getStrategy(classification.recommendedStrategy);
    log.info({ type: classification.type, strategy: classification.recommendedStrategy, confidence: classification.confidence }, 'strategy selected');

    return { strategy, classification };
  }

  classifyWithHeuristics(prompt: string): TaskClassification {
    const lower = prompt.toLowerCase();
    const wordCount = prompt.split(/\s+/).length;

    // Code review detection — must come BEFORE debugging so review requests aren't misclassified
    const codeReviewKeywords = ['code review', 'review the code', 'review my code', 'راجع الكود', 'افحص الكود', 'راجع الكود ده', 'code quality'];
    const hasCodeReviewKeyword = codeReviewKeywords.some(kw => lower.includes(kw));
    const hasCodeInMessage = /(```|def |function |class |import |const |let |var |public |private |return |if \(|for \(|while \(|print\(|console\.log)/.test(prompt);
    if (hasCodeReviewKeyword && hasCodeInMessage) {
      return { type: 'code_review', confidence: 95, recommendedStrategy: 'chain-of-thought', reasoning: 'Code review request with code provided — review inline, no external tools needed' };
    }

    // Debugging keywords (English + Arabic) → hypothesis-testing
    if (lower.match(/\b(error|bug|crash|exception|stack trace|debug|not working|broken|fails?|failing|issue|traceback|undefined|null pointer)\b/) ||
        lower.match(/(مشكلة|مشكله|بترجع|بتطلع|بيرجع|بيطلع|بيفشل|بيفشل|مش شغال|مش بتشتغل|خطأ|خلل|عطل|بيهنج|بيعلق|بيعمل مشكلة|فيير|error|bug)/)) {
      return { type: 'debugging', confidence: 85, recommendedStrategy: 'hypothesis-testing', reasoning: 'Debugging task — systematic hypothesis testing needed' };
    }

    if (lower.match(/\b(what is|who is|when did|where is|how many|define)\b/) && wordCount < 20) {
      return { type: 'simple_qa', confidence: 80, recommendedStrategy: 'chain-of-thought', reasoning: 'Short factual question' };
    }

    if (lower.match(/\b(pros and cons|compare|versus|vs\.|trade.?off|should we|debate|argue)\b/)) {
      return { type: 'controversial', confidence: 75, recommendedStrategy: 'debate', reasoning: 'Task involves multiple viewpoints' };
    }

    if (lower.match(/\b(analyze|evaluate|assess|measure|calculate|statistics)\b/)) {
      return { type: 'analytical', confidence: 70, recommendedStrategy: 'tree-of-thought', reasoning: 'Analytical task requiring structured reasoning' };
    }

    if (lower.match(/\b(build|create|deploy|install|setup|fix|implement|write code)\b/) && wordCount > 15) {
      return { type: 'multi_step', confidence: 70, recommendedStrategy: 'chain-of-thought', reasoning: 'Multi-step technical task' };
    }

    if (lower.match(/\b(why|explain|reason|because|prove|logic)\b/) && wordCount > 20) {
      return { type: 'complex_reasoning', confidence: 65, recommendedStrategy: 'tree-of-thought', reasoning: 'Complex reasoning required' };
    }

    if (lower.match(/\b(write|story|poem|creative|brainstorm|imagine|design)\b/)) {
      return { type: 'creative', confidence: 70, recommendedStrategy: 'chain-of-thought', reasoning: 'Creative/generative task' };
    }

    // Ambiguous / vague requests — ask for clarification instead of guessing
    if (lower.match(/\b(do something|something useful|anything|whatever|help me with|just do)\b/) ||
        lower.match(/(اعمل حاجة|اعمل اي حاجة|حاجة مفيدة|حاجة مفيدة|اي حاجة|عمل أي حاجة|بلاش|مش عارف|مش عارفة|اعمل اللي|شوف يعني)/) ||
        (wordCount <= 5 && lower.match(/\b(something|anything|whatever|useful|interesting)\b/))) {
      return { type: 'ambiguous', confidence: 90, recommendedStrategy: 'chain-of-thought', reasoning: 'Vague request — needs clarification before proceeding' };
    }

    return { type: 'simple_qa', confidence: 50, recommendedStrategy: 'chain-of-thought', reasoning: 'Default classification' };
  }

  private async classifyWithLlm(prompt: string): Promise<TaskClassification> {
    if (!this.llm) return this.classifyWithHeuristics(prompt);

    try {
      const completion = await this.llm.complete([
        { role: 'system', content: CLASSIFY_PROMPT },
        { role: 'user', content: prompt },
      ], { temperature: 0, maxTokens: 200 });

      const match = completion.content.match(/\{[\s\S]*\}/);
      if (!match) return this.classifyWithHeuristics(prompt);

      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      const type = String(parsed.type ?? 'simple_qa');
      const validTypes = Object.keys(STRATEGY_MAP);

      if (!validTypes.includes(type)) return this.classifyWithHeuristics(prompt);

      // Expensive-strategy guard: short conversational/opinion prompts (greetings,
      // "what do you think of X", chit-chat) must NOT run multi-round strategies
      // like debate — the LLM classifier over-labels casual chat as
      // 'controversial'/'creative', costing 60k+ tokens for a one-liner.
      const wordCount = prompt.trim().split(/\s+/).length;
      const expensiveType = type === 'controversial' || type === 'creative' || type === 'complex_reasoning';
      if (expensiveType && wordCount <= 15 && !/```|https?:\/\//.test(prompt)) {
        return {
          type: 'simple_qa',
          confidence: 70,
          recommendedStrategy: 'chain-of-thought',
          reasoning: 'Short conversational prompt — downgraded from expensive strategy',
        };
      }

      return {
        type: type as TaskClassification['type'],
        confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 50)),
        recommendedStrategy: STRATEGY_MAP[type] ?? 'chain-of-thought',
        reasoning: String(parsed.reasoning ?? ''),
      };
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : 'Unknown' }, 'LLM classification failed — using heuristics');
      return this.classifyWithHeuristics(prompt);
    }
  }
}
