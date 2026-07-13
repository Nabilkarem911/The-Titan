import type { LlmProvider } from '../types.js';
import { getGlobalToolRegistry } from '../tool-registry.js';
import type { WiredCapabilities } from '../capability-wiring.js';

export function registerCosmicTools(wiring: WiredCapabilities, _llm: LlmProvider): void {
  const registry = getGlobalToolRegistry();

  registry.register({
    name: 'garden_status',
    description: 'Get autonomous gardener status — creative ideas being nurtured and grown',
    tags: ['cosmic', 'garden', 'creative'],
    handler: async () => wiring.autonomousGardener.getStats(),
  });

  registry.register({
    name: 'rl_train',
    description: 'Get reinforcement learning environment stats and training status. Full training requires state and action generators to be configured.',
    tags: ['cosmic', 'rl', 'trading'],
    schema: {
      episodes: { type: 'number', description: 'Number of training episodes (default 10)' },
    },
    handler: async (params: unknown) => {
      const p = params as { episodes?: number };
      const stats = wiring.autonomousTrading.getStats();
      return {
        status: 'available',
        message: 'RL environment ready. Configure state and action generators to enable full training.',
        requestedEpisodes: p.episodes ?? 10,
        environmentStats: stats,
      };
    },
  });

  registry.register({
    name: 'meta_evolve',
    description: 'Run meta-evolution — evolve the evolution process itself for higher-order improvement',
    tags: ['cosmic', 'meta-evolution', 'evolution'],
    handler: async () => wiring.metaEvolution.getStats(),
  });

  registry.register({
    name: 'github_mine',
    description: 'Mine knowledge from GitHub repositories — discover patterns, best practices, and code examples',
    tags: ['cosmic', 'github', 'mining'],
    schema: {
      query: { type: 'string', description: 'Search query for GitHub mining' },
    },
    requiredParams: ['query'],
    handler: async (params: unknown) => {
      const p = params as { query: string };
      return wiring.githubMiner.searchRepositories(p.query);
    },
  });

  registry.register({
    name: 'zero_data_coevolve',
    description: 'Run zero-data co-evolution — evolve solutions without training data through self-play',
    tags: ['cosmic', 'evolution', 'zero-data'],
    handler: async () => wiring.zeroDataCoEvolution.getStats(),
  });

  registry.register({
    name: 'dream_world_explore',
    description: 'Explore the dream world — a creative space for generating novel ideas and connections',
    tags: ['cosmic', 'dream', 'creative'],
    schema: {
      theme: { type: 'string', description: 'Theme to explore in the dream world' },
    },
    handler: async (params: unknown) => {
      const p = params as { theme?: string };
      return wiring.dreamWorld.dream([p.theme ?? 'general exploration']);
    },
  });

  registry.register({
    name: 'swarm_evolve',
    description: 'Run swarm evolution — evolve a population of agents collectively',
    tags: ['cosmic', 'swarm', 'evolution'],
    handler: async () => wiring.swarmEvolution.getStats(),
  });

  registry.register({
    name: 'visual_workflow_build',
    description: 'Build a visual workflow from a description — returns a structured workflow graph',
    tags: ['cosmic', 'workflow', 'visual'],
    schema: {
      description: { type: 'string', description: 'Description of the desired workflow' },
    },
    requiredParams: ['description'],
    handler: async (params: unknown) => {
      const p = params as { description: string };
      const wf = wiring.visualWorkflowBuilder.createWorkflow(p.description);
      const triggerNode = wiring.visualWorkflowBuilder.addNode(wf.id, 'trigger', 'Start', { description: p.description });
      const agentNode = wiring.visualWorkflowBuilder.addNode(wf.id, 'agent', 'AI Agent', { task: p.description });
      wiring.visualWorkflowBuilder.addEdge(wf.id, triggerNode.id, agentNode.id);
      const dag = wiring.visualWorkflowBuilder.exportToDAG(wf.id);
      return { workflowId: wf.id, workflow: wf, dag };
    },
  });
}
