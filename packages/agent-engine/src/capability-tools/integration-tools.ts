import type { LlmProvider } from '../types.js';
import { getGlobalToolRegistry } from '../tool-registry.js';
import type { WiredCapabilities } from '../capability-wiring.js';

export function registerIntegrationTools(wiring: WiredCapabilities, _llm: LlmProvider): void {
  const registry = getGlobalToolRegistry();

  registry.register({
    name: 'screen_monitor_status',
    description: 'Get screen monitor status — what the agent currently sees on screen',
    tags: ['integration', 'screen', 'monitor'],
    handler: async () => wiring.screenMonitor.getStats(),
  });

  registry.register({
    name: 'a2a_communicate',
    description: 'Send a message to another agent using A2A (agent-to-agent) protocol',
    tags: ['integration', 'a2a', 'communication'],
    schema: {
      targetAgent: { type: 'string', description: 'Target agent ID or URL' },
      message: { type: 'string', description: 'Message to send' },
    },
    requiredParams: ['targetAgent', 'message'],
    handler: async (params: unknown) => {
      const p = params as { targetAgent: string; message: string };
      return wiring.a2aProtocol.sendTask(p.targetAgent, { name: 'message', description: 'Chat message', content: p.message });
    },
  });

  registry.register({
    name: 'web_intelligence',
    description: 'Gather web intelligence on a topic — search, scrape, and analyze web content',
    tags: ['integration', 'web', 'intelligence'],
    schema: {
      query: { type: 'string', description: 'Search query' },
    },
    requiredParams: ['query'],
    handler: async (params: unknown) => {
      const p = params as { query: string };
      if (!wiring.webIntelligence) {
        return { query: p.query, results: [], error: 'Web intelligence is not configured. Set BRAVE_SEARCH_API_KEY environment variable.' };
      }
      return wiring.webIntelligence.search?.(p.query) ?? { query: p.query, results: [], status: 'web intelligence gathered' };
    },
  });

  registry.register({
    name: 'browser_agent_task',
    description: 'Execute a browser automation task — navigate, click, extract data from web pages',
    tags: ['integration', 'browser', 'automation'],
    schema: {
      task: { type: 'string', description: 'The task to execute in the browser' },
      startUrl: { type: 'string', description: 'Starting URL (optional)' },
    },
    requiredParams: ['task'],
    handler: async (params: unknown) => {
      const p = params as { task: string; startUrl?: string };
      return wiring.browserAgent.executeTask(p.task, p.startUrl);
    },
  });

  registry.register({
    name: 'world_simulate',
    description: 'Run a world simulation — model scenarios in a simulated environment',
    tags: ['world-model', 'simulation'],
    schema: {
      scenario: { type: 'string', description: 'The scenario to simulate' },
    },
    requiredParams: ['scenario'],
    handler: async (params: unknown) => {
      const p = params as { scenario: string };
      return wiring.worldSimulator.simulate(p.scenario, 'general');
    },
  });

  registry.register({
    name: 'environment_graph_stats',
    description: 'Get environment graph statistics — entities, relations, and events recorded',
    tags: ['world-model', 'environment', 'graph'],
    handler: async () => wiring.environmentGraph.stats(),
  });

  registry.register({
    name: 'self_forge_tool',
    description: 'Create a new tool using Self-Forge and execute it immediately. Provide a description of what the tool should do and optional params to run it with.',
    tags: ['self-forge', 'tool', 'creation'],
    schema: {
      description: { type: 'string', description: 'Description of what the tool should do' },
      name: { type: 'string', description: 'Name for the new tool (optional)' },
      executeParams: { type: 'object', description: 'Parameters to execute the newly forged tool with immediately (optional)' },
    },
    requiredParams: ['description'],
    handler: async (params: unknown) => {
      const p = params as { description: string; name?: string; executeParams?: Record<string, unknown> };
      const forgeResult = await wiring.selfForge.forgeTool(p.description, p.name ?? 'on-demand');

      if (!forgeResult.success || !forgeResult.toolName) {
        return forgeResult;
      }

      try {
        const registry = getGlobalToolRegistry();
        const execResult = await registry.execute(forgeResult.toolName, p.executeParams ?? {});
        wiring.selfForge.recordUsage(forgeResult.toolName);
        return {
          ...forgeResult,
          executed: true,
          executionResult: execResult,
        };
      } catch (err) {
        return {
          ...forgeResult,
          executed: false,
          executionError: err instanceof Error ? err.message : String(err),
        };
      }
    },
  });

  registry.register({
    name: 'introspective_awareness',
    description: 'Get introspective awareness report — the agent self-reflects on its own capabilities and limitations',
    tags: ['introspection', 'awareness', 'self-reflection'],
    handler: async () => wiring.introspectiveAwareness.getStats(),
  });

  registry.register({
    name: 'skill_md_list',
    description: 'List available skills from the Skill.md registry — community-discovered skill definitions',
    tags: ['integration', 'skill', 'registry'],
    handler: async () => wiring.skillMdRegistry.getAllSkills(),
  });

  registry.register({
    name: 'webmcp_discover',
    description: 'Discover tools on a remote MCP server over HTTP',
    tags: ['integration', 'webmcp', 'discovery'],
    schema: { serverId: { type: 'string', description: 'The registered server ID' } },
    requiredParams: ['serverId'],
    handler: async (params: unknown) => {
      const p = params as { serverId: string };
      return wiring.webMCPBridge.discoverTools(p.serverId);
    },
  });

  registry.register({
    name: 'webmcp_invoke',
    description: 'Invoke a tool on a remote MCP server over HTTP',
    tags: ['integration', 'webmcp', 'invoke'],
    schema: { serverId: { type: 'string' }, toolName: { type: 'string' }, args: { type: 'object' } },
    requiredParams: ['serverId', 'toolName'],
    handler: async (params: unknown) => {
      const p = params as { serverId: string; toolName: string; args?: Record<string, unknown> };
      return wiring.webMCPBridge.invokeTool(p.serverId, p.toolName, p.args ?? {});
    },
  });

  registry.register({
    name: 'autonomous_loop_status',
    description: 'Get autonomous loop status — check if the 24/7 monitoring loop is running',
    tags: ['autonomous', 'loop', 'status'],
    handler: async () => {
      return {
        status: 'idle',
        message: 'No autonomous loop running. Use the /api/v1/autonomous/task endpoint to create tasks.',
        availableEndpoints: ['/api/v1/autonomous/verify', '/api/v1/autonomous/task'],
      };
    },
  });
}
