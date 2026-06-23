import { useState, useEffect, useCallback } from 'react';
import { Users, Rocket, Loader2, Bot, Wrench, Eye, Brain, Code2, Search as SearchIcon } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { cn } from '../utils/cn';
import { PageHeader } from '../components/PageHeader';

interface TeamTemplate {
  name: string;
  description: string;
  roles: string[];
}

interface TeamAgent {
  id: string;
  role: string;
  name: string;
  description: string;
  allowedTools?: string[];
  maxSteps: number;
  priority: number;
}

const ROLE_ICONS: Record<string, typeof Bot> = {
  planner: Brain,
  coder: Code2,
  reviewer: Eye,
  executor: Wrench,
  researcher: SearchIcon,
  synthesizer: Bot,
};

const ROLE_COLORS: Record<string, string> = {
  planner: 'bg-accent-primary/10 text-accent-primary border-accent-primary/30',
  coder: 'bg-accent-secondary/10 text-accent-secondary border-accent-secondary/30',
  reviewer: 'bg-warning/10 text-warning border-warning/30',
  executor: 'bg-success/10 text-success border-success/30',
  researcher: 'bg-accent-tertiary/10 text-accent-tertiary border-accent-tertiary/30',
  synthesizer: 'bg-accent-primary/10 text-accent-primary border-accent-primary/30',
};

export default function Teams() {
  const [templates, setTemplates] = useState<TeamTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState<string | null>(null);
  const [builtAgents, setBuiltAgents] = useState<TeamAgent[] | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ items: TeamTemplate[]; total: number }>('/teams/templates');
      setTemplates(res.items);
    } catch {
      toast.error('Failed to load team templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleBuild = async (templateName: string) => {
    setBuilding(templateName);
    setSelectedTemplate(templateName);
    setBuiltAgents(null);
    try {
      const res = await api.post<{ agents: TeamAgent[]; total: number; template: string }>('/teams/build', { template: templateName });
      setBuiltAgents(res.agents);
      toast.success(`Team built: ${res.total} agents from ${templateName}`);
    } catch {
      toast.error('Failed to build team');
    } finally {
      setBuilding(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <PageHeader
        icon={Users}
        title="Multi-Agent Teams"
        subtitle="Launch coordinated teams of AI agents for complex tasks"
        description="Multi-Agent Teams are pre-configured groups of agents that work together on complex tasks. Each team has a structure — a planner, executors, and a reviewer — and a prompt template. Choose a template, customize the prompt, and launch. Teams are more structured than Swarms and are optimized for specific use cases like research, code review, or content creation."
        tips={[
          'Pick a template that matches your task type',
          'Customize the prompt with your specific requirements',
          'Each team member has a specific role — planner, executor, or reviewer',
          'From chat: titan chat "launch a research team to analyze competitors"',
        ]}
      />

      {/* Templates */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <div key={template.name} className="card p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-btn bg-accent-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-accent-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-text-primary capitalize">{template.name.replace('-', ' ')}</h3>
                    <p className="text-caption text-text-muted">{template.roles.length} agents</p>
                  </div>
                </div>
              </div>

              <p className="text-small text-text-secondary flex-1">{template.description}</p>

              <div className="flex flex-wrap gap-1.5">
                {template.roles.map((role, i) => {
                  const Icon = ROLE_ICONS[role] || Bot;
                  return (
                    <span key={i} className={cn('badge text-caption border', ROLE_COLORS[role] || 'bg-elevated text-text-muted border-border-subtle')}>
                      <Icon className="w-2.5 h-2.5 inline mr-0.5" />
                      {role}
                    </span>
                  );
                })}
              </div>

              <button
                onClick={() => handleBuild(template.name)}
                disabled={building === template.name}
                className={cn('btn w-full', selectedTemplate === template.name ? 'btn-primary' : 'btn-secondary')}
              >
                {building === template.name ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <><Rocket className="w-4 h-4" /> Build Team</>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Built agents */}
      {builtAgents && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h2 className="text-h3 text-text-primary flex items-center gap-2">
              <Users className="w-4 h-4 text-accent-primary" />
              Team Agents ({builtAgents.length})
            </h2>
          </div>
          <div className="divide-y divide-border-subtle">
            {builtAgents.map((agent) => {
              const Icon = ROLE_ICONS[agent.role] || Bot;
              return (
                <div key={agent.id} className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-8 h-8 rounded-btn flex items-center justify-center border', ROLE_COLORS[agent.role] || 'bg-elevated border-border-subtle')}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">{agent.name}</p>
                      <p className="text-caption text-text-muted">{agent.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="badge bg-elevated text-text-muted text-caption">{agent.role}</span>
                      <p className="text-caption text-text-muted mt-1">max {agent.maxSteps} steps</p>
                    </div>
                  </div>
                  {agent.allowedTools && agent.allowedTools.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 ml-11">
                      {agent.allowedTools.map((tool, i) => (
                        <span key={i} className="badge bg-elevated text-text-muted text-caption">
                          <Wrench className="w-2.5 h-2.5 inline mr-0.5" />{tool}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
