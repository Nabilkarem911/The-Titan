import type { LlmProvider } from '../types.js';
import { getGlobalToolRegistry } from '../tool-registry.js';
import type { WiredCapabilities } from '../capability-wiring.js';

export function registerMirrorTools(wiring: WiredCapabilities, _llm: LlmProvider): void {
  const registry = getGlobalToolRegistry();

  registry.register({
    name: 'inner_monologue',
    description: 'Get current inner monologue — the agent internal dialogue and reasoning stream',
    tags: ['mirror', 'monologue', 'consciousness'],
    handler: async () => ({ threads: wiring.innerMonologue.getActiveThreads(), threadCount: wiring.innerMonologue.getThreadCount() }),
  });

  registry.register({
    name: 'cognitive_control',
    description: 'Get cognitive controller status — attention management and cognitive resource allocation',
    tags: ['mirror', 'cognitive', 'control'],
    handler: async () => ({ lastNarrative: wiring.cognitiveController.getLastNarrative(), selfModel: wiring.cognitiveController.getLastSelfModel() }),
  });

  registry.register({
    name: 'episodic_buffer',
    description: 'Get episodic buffer contents — short-term episodic memories being processed',
    tags: ['mirror', 'episodic', 'memory'],
    handler: async () => ({ items: wiring.episodicBuffer.getItems(), size: wiring.episodicBuffer.getSize(), capacity: wiring.episodicBuffer.getCapacity() }),
  });

  registry.register({
    name: 'digital_twin_simulate',
    description: 'Simulate a scenario using the digital twin — predict outcomes of actions',
    tags: ['mirror', 'digital-twin', 'simulation'],
    schema: {
      scenario: { type: 'string', description: 'The scenario to simulate' },
    },
    requiredParams: ['scenario'],
    handler: async (params: unknown) => {
      const p = params as { scenario: string };
      return wiring.whatIfEngine.simulate(p.scenario, p.scenario);
    },
  });

  registry.register({
    name: 'normative_check',
    description: 'Check if an action aligns with normative agency — ethical and moral reasoning',
    tags: ['mirror', 'normative', 'ethics'],
    schema: {
      action: { type: 'string', description: 'The action to evaluate ethically' },
    },
    requiredParams: ['action'],
    handler: async (params: unknown) => {
      const p = params as { action: string };
      return wiring.normativeAgency.evaluateAction(p.action);
    },
  });
}
