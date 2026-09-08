import type { LlmProvider, LlmToolDefinition } from '../types.js';
import type { DynamicAgentSpec, SpawnRequest } from './types.js';

const FACTORY_PROMPT = `You are designing an AI agent for a specific task. Given the role and goal, create the agent specification.

Respond ONLY with JSON:
{
  "name": "short agent name",
  "systemPrompt": "detailed instructions for this agent",
  "suggestedTools": ["tool_name_1", "tool_name_2"],
  "maxSteps": 5-15,
  "approach": "brief strategy description"
}`;

const CAPABILITY_TO_TOOLS: Record<string, string[]> = {
  'search': ['brave_search', 'http_request'],
  'code': ['read_file_content', 'write_file', 'patch_file', 'execute_bash'],
  'data': ['database_query', 'parse_csv_json', 'excel_read', 'calculate'],
  'web': ['http_request', 'firecrawl_scrape', 'html_to_text'],
  'files': ['read_file_content', 'write_file', 'pdf_read', 'zip_unzip'],
  'communication': ['send_email', 'translate_text'],
  'security': ['dns_lookup', 'ip_lookup', 'hash_crypto', 'jwt_decode'],
  'devops': ['execute_bash', 'docker_manage', 'git_push'],
};

export class DynamicAgentFactory {
  constructor(private llm: LlmProvider, private availableTools: LlmToolDefinition[]) {}

  async createAgent(spec: DynamicAgentSpec, parentId: string): Promise<SpawnRequest> {
    // Resolve tools from capabilities
    const toolNames = new Set<string>();
    for (const cap of spec.requiredCapabilities) {
      const tools = CAPABILITY_TO_TOOLS[cap] ?? [];
      for (const t of tools) toolNames.add(t);
    }

    const allowedTools = Array.from(toolNames).filter((t) => this.availableTools.some((at) => at.name === t));

    // Use LLM to design the agent
    try {
      const completion = await this.llm.complete([
        { role: 'system', content: FACTORY_PROMPT },
        {
          role: 'user',
          content: `Role: ${spec.role}\nGoal: ${spec.goal}\nCapabilities: ${spec.requiredCapabilities.join(', ')}\nAvailable tools: ${allowedTools.join(', ')}${spec.context ? `\nContext: ${spec.context}` : ''}`,
        },
      ], { temperature: 0.3 });

      const design = this.parseDesign(completion.content);

      return {
        name: design.name || spec.role,
        prompt: spec.goal,
        systemPrompt: design.systemPrompt,
        allowedTools: design.suggestedTools.length > 0 ? design.suggestedTools : allowedTools,
        maxSteps: design.maxSteps || 10,
        mode: 'foreground',
        parentId,
      };
    } catch {
      // Fallback without LLM
      return {
        name: spec.role,
        prompt: spec.goal,
        systemPrompt: `You are a ${spec.role}. ${spec.goal}`,
        allowedTools,
        maxSteps: 10,
        mode: 'foreground',
        parentId,
      };
    }
  }

  async createTeam(specs: DynamicAgentSpec[], parentId: string): Promise<SpawnRequest[]> {
    return Promise.all(specs.map((s) => this.createAgent(s, parentId)));
  }

  resolveTools(capabilities: string[]): string[] {
    const tools = new Set<string>();
    for (const cap of capabilities) {
      for (const t of CAPABILITY_TO_TOOLS[cap] ?? []) tools.add(t);
    }
    return Array.from(tools);
  }

  listCapabilities(): string[] {
    return Object.keys(CAPABILITY_TO_TOOLS);
  }

  private parseDesign(content: string): { name: string; systemPrompt: string; suggestedTools: string[]; maxSteps: number } {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return { name: '', systemPrompt: '', suggestedTools: [], maxSteps: 10 };

    try {
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      return {
        name: String(parsed.name ?? ''),
        systemPrompt: String(parsed.systemPrompt ?? ''),
        suggestedTools: Array.isArray(parsed.suggestedTools) ? parsed.suggestedTools.map(String) : [],
        maxSteps: Number(parsed.maxSteps) || 10,
      };
    } catch {
      return { name: '', systemPrompt: '', suggestedTools: [], maxSteps: 10 };
    }
  }
}
