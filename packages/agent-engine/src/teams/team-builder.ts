import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';
import type { SwarmAgent, AgentRole } from '../swarm/types.js';

const log = getLogger().child({ component: 'team-builder' });

interface TeamTemplate {
  name: string;
  description: string;
  roles: Array<{ role: AgentRole; name: string; description: string; systemPrompt?: string; tools?: string[]; maxSteps?: number }>;
}

const TEMPLATES: Record<string, TeamTemplate> = {
  'dev-team': {
    name: 'Development Team',
    description: 'Full-stack development team for building features',
    roles: [
      { role: 'planner', name: 'Tech Lead', description: 'Plans architecture and breaks down tasks', maxSteps: 8 },
      { role: 'coder', name: 'Developer', description: 'Writes clean, tested code', tools: ['write_file', 'patch_file', 'read_file_content', 'execute_bash'], maxSteps: 15 },
      { role: 'reviewer', name: 'Code Reviewer', description: 'Reviews code for bugs, security, and best practices', tools: ['read_file_content'], maxSteps: 8 },
      { role: 'executor', name: 'QA Engineer', description: 'Runs tests and verifies functionality', tools: ['execute_bash'], maxSteps: 10 },
    ],
  },
  'research-team': {
    name: 'Research Team',
    description: 'Research and analysis team',
    roles: [
      { role: 'planner', name: 'Research Lead', description: 'Defines research questions and methodology', maxSteps: 5 },
      { role: 'researcher', name: 'Researcher', description: 'Gathers information from multiple sources', tools: ['brave_search', 'firecrawl_scrape', 'http_request'], maxSteps: 12 },
      { role: 'reviewer', name: 'Fact Checker', description: 'Verifies claims and cross-references sources', tools: ['brave_search'], maxSteps: 8 },
      { role: 'synthesizer', name: 'Writer', description: 'Synthesizes findings into clear reports', maxSteps: 8 },
    ],
  },
  'ops-team': {
    name: 'Operations Team',
    description: 'DevOps and infrastructure team',
    roles: [
      { role: 'planner', name: 'SRE Lead', description: 'Plans infrastructure changes', maxSteps: 5 },
      { role: 'executor', name: 'DevOps Engineer', description: 'Executes infrastructure operations', tools: ['execute_bash', 'docker_manage', 'read_file_content', 'write_file'], maxSteps: 15 },
      { role: 'reviewer', name: 'Security Reviewer', description: 'Reviews for security implications', tools: ['read_file_content', 'dns_lookup'], maxSteps: 8 },
    ],
  },
  'content-team': {
    name: 'Content Team',
    description: 'Content creation and editing team',
    roles: [
      { role: 'planner', name: 'Content Strategist', description: 'Plans content strategy and outlines', maxSteps: 5 },
      { role: 'researcher', name: 'Topic Researcher', description: 'Researches topics for accuracy', tools: ['brave_search', 'http_request'], maxSteps: 10 },
      { role: 'coder', name: 'Content Writer', description: 'Writes engaging content', maxSteps: 10 },
      { role: 'reviewer', name: 'Editor', description: 'Edits for clarity, grammar, and style', maxSteps: 5 },
    ],
  },
};

export class TeamBuilder {
  buildFromTemplate(templateName: string, priority = 5): SwarmAgent[] {
    const template = TEMPLATES[templateName];
    if (!template) {
      log.warn({ template: templateName }, 'unknown template — using dev-team');
      return this.buildFromTemplate('dev-team', priority);
    }

    return template.roles.map((role) => ({
      id: randomUUID(),
      role: role.role,
      name: role.name,
      description: role.description,
      systemPrompt: role.systemPrompt,
      allowedTools: role.tools,
      maxSteps: role.maxSteps ?? 10,
      priority,
    }));
  }

  buildCustom(roles: TeamTemplate['roles']): SwarmAgent[] {
    return roles.map((role) => ({
      id: randomUUID(),
      role: role.role,
      name: role.name,
      description: role.description,
      systemPrompt: role.systemPrompt,
      allowedTools: role.tools,
      maxSteps: role.maxSteps ?? 10,
      priority: 5,
    }));
  }

  listTemplates(): Array<{ name: string; description: string; roles: string[] }> {
    return Object.entries(TEMPLATES).map(([key, t]) => ({
      name: key,
      description: t.description,
      roles: t.roles.map((r) => r.name),
    }));
  }

  getTemplate(name: string): TeamTemplate | undefined {
    return TEMPLATES[name];
  }
}
