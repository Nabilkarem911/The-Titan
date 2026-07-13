import type { LlmProvider } from '../types.js';
import { getGlobalToolRegistry } from '../tool-registry.js';
import type { WiredCapabilities } from '../capability-wiring.js';

export function registerLearningTools(wiring: WiredCapabilities, llm: LlmProvider): void {
  const registry = getGlobalToolRegistry();

  registry.register({
    name: 'experience_stats',
    description: 'Get experience collector statistics — total experiences, success rate, common tools',
    tags: ['learning', 'experience', 'stats'],
    handler: async () => wiring.experienceCollector.getStats(),
  });

  registry.register({
    name: 'prompt_optimize',
    description: 'Optimize a prompt automatically — analyzes and suggests improvements to a prompt',
    tags: ['learning', 'prompt', 'optimization'],
    schema: {
      prompt: { type: 'string', description: 'The prompt to optimize' },
    },
    requiredParams: ['prompt'],
    handler: async (params: unknown) => {
      const p = params as { prompt: string };
      try {
        const completion = await llm.complete([
          { role: 'system', content: 'You are a prompt optimization expert. Improve the given prompt to be clearer, more specific, and more effective. Return ONLY the optimized prompt text, no explanation.' },
          { role: 'user', content: p.prompt },
        ], { temperature: 0.3, maxTokens: 500 });
        const optimized = completion.content.trim();
        return {
          original: p.prompt,
          optimized: optimized || p.prompt,
          suggestions: optimized !== p.prompt ? ['LLM-optimized for clarity and specificity'] : [],
          tokensUsed: completion.tokensUsed,
        };
      } catch {
        return { original: p.prompt, optimized: p.prompt, suggestions: [], error: 'LLM optimization failed' };
      }
    },
  });

  registry.register({
    name: 'strategy_tune',
    description: 'Tune reasoning strategy based on past performance data',
    tags: ['learning', 'strategy', 'tuning'],
    handler: async () => { return { status: 'active', performance: wiring.strategyTuner.getPerformance() }; },
  });

  registry.register({
    name: 'cross_user_learn',
    description: 'Get cross-user learning insights — patterns learned across all users (anonymized)',
    tags: ['learning', 'cross-user', 'patterns'],
    handler: async () => wiring.crossUserLearner.getInsights(),
  });

  registry.register({
    name: 'meta_learn',
    description: 'Run meta-learning optimization — improve the learning process itself',
    tags: ['learning', 'meta-learning', 'optimization'],
    handler: async () => wiring.metaLearningOptimizer.optimize({ successRate: 0.5, avgDuration: 1000, avgTokens: 1000, strategyStats: [], toolStats: [], recentErrors: [] }),
  });

  registry.register({
    name: 'extract_heuristics',
    description: 'Extract heuristic rules from past experiences — returns actionable rules',
    tags: ['learning', 'heuristics', 'rules'],
    handler: async () => {
      const all = wiring.heuristicExtractor.getAllHeuristics();
      const stats = wiring.heuristicExtractor.stats();
      return { status: 'active', totalHeuristics: all.length, stats, recent: all.slice(-5).map(h => ({ id: h.id, content: h.content, category: h.category, source: h.source, confidence: h.confidence })) };
    },
  });

  registry.register({
    name: 'edge_privacy_status',
    description: 'Get edge privacy status — check if on-device privacy processing is active',
    tags: ['learning', 'privacy', 'edge'],
    handler: async () => wiring.edgePrivacy.getStats(),
  });
}
