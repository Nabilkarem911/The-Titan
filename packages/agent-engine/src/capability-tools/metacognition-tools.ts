import type { LlmProvider } from '../types.js';
import { getGlobalToolRegistry } from '../tool-registry.js';
import type { WiredCapabilities } from '../capability-wiring.js';

export function registerMetacognitionTools(wiring: WiredCapabilities, _llm: LlmProvider): void {
  const registry = getGlobalToolRegistry();

  registry.register({
    name: 'meta_monitor_stats',
    description: 'Get metacognitive monitor statistics — self-awareness metrics, performance tracking',
    tags: ['metacognition', 'monitoring'],
    handler: async () => {
      const archive = wiring.selfImprover.getArchive();
      return {
        status: 'active',
        pendingProposals: archive.proposals.length,
        appliedProposals: archive.applied.length,
        rejectedProposals: archive.rejected.length,
        recentProposals: wiring.selfImprover.getRecentProposals(5).map(p => ({
          id: p.id,
          category: p.category,
          description: p.description,
          confidence: p.confidence,
        })),
      };
    },
  });

  registry.register({
    name: 'self_improve',
    description: 'Run self-improvement cycle — analyze past performance and generate improvement suggestions',
    tags: ['metacognition', 'self-improvement'],
    handler: async () => {
      const archive = wiring.selfImprover.getArchive();
      return {
        status: 'active',
        totalProposals: archive.proposals.length + archive.applied.length + archive.rejected.length,
        pending: archive.proposals.length,
        applied: archive.applied.length,
        rejected: archive.rejected.length,
        recent: wiring.selfImprover.getRecentProposals(5).map(p => ({
          id: p.id,
          category: p.category,
          description: p.description,
          suggestedChange: p.suggestedChange,
          expectedBenefit: p.expectedBenefit,
          confidence: p.confidence,
        })),
      };
    },
  });

  registry.register({
    name: 'curiosity_explore',
    description: 'Explore a topic with curiosity-driven discovery — generates questions and exploration paths',
    tags: ['metacognition', 'curiosity', 'exploration'],
    schema: {
      topic: { type: 'string', description: 'Topic to explore' },
    },
    requiredParams: ['topic'],
    handler: async (params: unknown) => {
      const p = params as { topic: string };
      return wiring.curiosityEngine.exploreTopic(p.topic);
    },
  });

  registry.register({
    name: 'emotion_analyze',
    description: 'Analyze emotional content of text — returns dominant emotion, valence, arousal, empathy score',
    tags: ['metacognition', 'emotion', 'empathy'],
    schema: {
      text: { type: 'string', description: 'Text to analyze emotionally' },
    },
    requiredParams: ['text'],
    handler: async (params: unknown) => {
      const p = params as { text: string };
      return wiring.emotionalIntelligence.analyze(p.text);
    },
  });

  registry.register({
    name: 'theory_of_mind',
    description: 'Model the mental state of a user based on their messages — beliefs, intentions, knowledge',
    tags: ['metacognition', 'theory-of-mind', 'user-modeling'],
    schema: {
      userMessages: { type: 'string', description: 'JSON array of user messages' },
    },
    requiredParams: ['userMessages'],
    handler: async (params: unknown) => {
      const p = params as { userMessages: string };
      const messages = JSON.parse(p.userMessages) as string[];
      return wiring.theoryOfMind.analyze('user', {
        entityType: 'user',
        messages: messages.map((m) => ({ role: 'user', content: m })),
      });
    },
  });

  registry.register({
    name: 'meta_consolidate',
    description: 'Run metacognitive consolidation — synthesize knowledge from recent cognitive activities',
    tags: ['metacognition', 'consolidation'],
    handler: async () => wiring.metacognitiveConsolidation.consolidate(),
  });

  registry.register({
    name: 'safety_check',
    description: 'Check if an action is safe using safety guardrails — returns whether action is allowed and why',
    tags: ['metacognition', 'safety', 'guardrail'],
    schema: {
      action: { type: 'string', description: 'The action to check' },
      context: { type: 'string', description: 'Additional context (optional)' },
    },
    requiredParams: ['action'],
    handler: async (params: unknown) => {
      const p = params as { action: string; context?: string };
      return wiring.safetyGuardrail.check(p.action, p.context ?? '');
    },
  });

  registry.register({
    name: 'safety_memory',
    description: 'Get safety memory — past safety incidents and learned safety patterns',
    tags: ['metacognition', 'safety', 'memory'],
    handler: async () => wiring.safetyMemory.stats(),
  });

  registry.register({
    name: 'anti_sycophancy_check',
    description: 'Check if a response is sycophantic (excessively agreeable) — returns sycophancy score and assessment',
    tags: ['metacognition', 'sycophancy', 'honesty'],
    schema: {
      userPrompt: { type: 'string', description: 'The user prompt' },
      agentResponse: { type: 'string', description: 'The agent response to check' },
    },
    requiredParams: ['userPrompt', 'agentResponse'],
    handler: async (params: unknown) => {
      const p = params as { userPrompt: string; agentResponse: string };
      return wiring.antiSycophancy.assess({
        id: `run-${Date.now()}`,
        agentId: 'chat',
        prompt: p.userPrompt,
        status: 'completed',
        currentStep: 0,
        maxSteps: 0,
        tokensUsed: 0,
        steps: [],
        finalAnswer: p.agentResponse,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Parameters<typeof wiring.antiSycophancy.assess>[0]);
    },
  });

  registry.register({
    name: 'introspect',
    description: 'Run introspection — self-examine current cognitive state, biases, and reasoning quality',
    tags: ['metacognition', 'introspection', 'self-awareness'],
    handler: async () => {
      return wiring.introspection.stats();
    },
  });

  registry.register({
    name: 'guardrail_check',
    description: 'Check an action against safety guardrails before execution — returns proceed, refuse, or update',
    tags: ['metacognition', 'guardrail', 'safety'],
    schema: { action: { type: 'string', description: 'The action to check' }, context: { type: 'string', description: 'Additional context' } },
    requiredParams: ['action'],
    handler: async (params: unknown) => {
      const p = params as { action: string; context?: string };
      return wiring.safetyGuardrail.check(p.action, p.context ?? '');
    },
  });
}
