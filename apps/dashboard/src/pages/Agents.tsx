import React, { useState } from 'react';
import {
  Bot, Plus, Edit3, Trash2, Copy, Search,
  Layers, Save, X, Wand2,
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { ErrorState, EmptyState } from '../components/PageState';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { classNames, formatRelativeTime } from '../utils/format';
import { useDebounce } from '../hooks/useDebounce';
import type { AgentProfile } from '../api/client';

export default function Agents() {
  const [activeTab, setActiveTab] = useState<'agents' | 'templates'>('agents');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingAgent, setEditingAgent] = useState<Partial<AgentProfile> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 300);

  const { data: agents, error, isLoading, refetch } = useApi<AgentProfile[]>(
    () => api.getAgents(),
    []
  );

  const filtered = agents?.filter(
    (a) =>
      a.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      a.model.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      a.tags?.some((t) => t.toLowerCase().includes(debouncedSearch.toLowerCase()))
  );

  const handleDelete = async (id: string) => {
    await api.deleteAgent(id);
    refetch();
  };

  const handleSave = async () => {
    if (!editingAgent) return;
    if (editingAgent.id) {
      await api.updateAgent(editingAgent.id, editingAgent);
    } else {
      await api.createAgent(editingAgent);
    }
    setEditingAgent(null);
    setIsCreating(false);
    refetch();
  };

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (isLoading) return <PageSkeleton />;

  const templates: Array<{ name: string; model: string; description: string; tools: string[] }> = [
    { name: 'Code Assistant', model: 'claude-3-opus', description: 'Full-stack coding agent with file access and terminal', tools: ['read_file', 'write_file', 'bash', 'search'] },
    { name: 'Research Agent', model: 'claude-3-sonnet', description: 'Web research and data analysis agent', tools: ['web_search', 'scrape', 'summarize'] },
    { name: 'DevOps Agent', model: 'claude-3-haiku', description: 'Infrastructure monitoring and deployment', tools: ['bash', 'docker', 'kubectl', 'ssh'] },
    { name: 'Data Pipeline', model: 'claude-3-sonnet', description: 'ETL and data processing automation', tools: ['sql', 'python', 'read_file', 'write_file'] },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-text-secondary text-sm">
            {agents?.length ?? 0} agents configured
          </p>
        </div>
        <button
          onClick={() => {
            setEditingAgent({ name: '', model: 'claude-3-sonnet', system_prompt: '', tools: [], temperature: 0.7, max_tokens: 4096 });
            setIsCreating(true);
          }}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
          New Agent
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={classNames('tab', activeTab === 'agents' && 'active')}
          onClick={() => setActiveTab('agents')}
        >
          <Bot className="w-4 h-4 inline-block me-1.5" />
          Agents ({agents?.length ?? 0})
        </button>
        <button
          className={classNames('tab', activeTab === 'templates' && 'active')}
          onClick={() => setActiveTab('templates')}
        >
          <Layers className="w-4 h-4 inline-block me-1.5" />
          Templates
        </button>
      </div>

      {activeTab === 'agents' && (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search agents..."
              className="input ps-10"
            />
          </div>

          {/* Agent cards */}
          {!filtered || filtered.length === 0 ? (
            <EmptyState
              icon={<Bot className="w-7 h-7 text-text-muted" />}
              title="No agents found"
              message={searchQuery ? 'Try a different search query' : 'Create your first agent to get started'}
              action={
                !searchQuery ? (
                  <button
                    onClick={() => {
                      setEditingAgent({ name: '', model: 'claude-3-sonnet', system_prompt: '', tools: [], temperature: 0.7, max_tokens: 4096 });
                      setIsCreating(true);
                    }}
                    className="btn btn-primary btn-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Create Agent
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((agent) => (
                <div key={agent.id} className="card p-5 hover:border-border-light transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[rgba(112,0,255,0.1)] flex items-center justify-center">
                        <Bot className="w-5 h-5 text-violet" />
                      </div>
                      <div>
                        <h3 className="font-heading font-semibold text-text-primary">{agent.name}</h3>
                        <p className="text-xs text-text-muted">{agent.model}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditingAgent({ ...agent })}
                        className="btn btn-ghost p-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(agent.id)}
                        className="btn btn-ghost p-1.5 text-text-muted hover:text-pink"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {agent.description && (
                    <p className="text-sm text-text-secondary mb-3 line-clamp-2">{agent.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {agent.tools.slice(0, 4).map((tool) => (
                      <span key={tool} className="badge badge-neutral text-[11px]">{tool}</span>
                    ))}
                    {agent.tools.length > 4 && (
                      <span className="badge badge-neutral text-[11px]">+{agent.tools.length - 4}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span>temp: {agent.temperature}</span>
                    <span>{formatRelativeTime(agent.updated_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tmpl) => (
            <div key={tmpl.name} className="card p-5 hover:border-border-light transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[rgba(0,242,254,0.08)] flex items-center justify-center">
                    <Wand2 className="w-5 h-5 text-cyan" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-text-primary">{tmpl.name}</h3>
                    <p className="text-xs text-text-muted">{tmpl.model}</p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-text-secondary mb-3">{tmpl.description}</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {tmpl.tools.map((tool) => (
                  <span key={tool} className="badge badge-info text-[11px]">{tool}</span>
                ))}
              </div>
              <button
                onClick={() => {
                  setEditingAgent({
                    name: tmpl.name,
                    model: tmpl.model,
                    system_prompt: '',
                    tools: tmpl.tools,
                    temperature: 0.7,
                    max_tokens: 4096,
                    description: tmpl.description,
                  });
                  setIsCreating(true);
                  setActiveTab('agents');
                }}
                className="btn btn-secondary btn-sm w-full"
              >
                <Copy className="w-4 h-4" />
                Use Template
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create modal */}
      {(editingAgent || isCreating) && editingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { setEditingAgent(null); setIsCreating(false); }}>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg font-semibold text-text-primary">
                {editingAgent.id ? 'Edit Agent' : 'Create Agent'}
              </h2>
              <button onClick={() => { setEditingAgent(null); setIsCreating(false); }} className="btn btn-ghost p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Name</label>
                <input
                  type="text"
                  value={editingAgent.name ?? ''}
                  onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })}
                  className="input"
                  placeholder="Agent name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Model</label>
                <input
                  type="text"
                  value={editingAgent.model ?? ''}
                  onChange={(e) => setEditingAgent({ ...editingAgent, model: e.target.value })}
                  className="input"
                  placeholder="claude-3-sonnet"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">System Prompt</label>
                <textarea
                  value={editingAgent.system_prompt ?? ''}
                  onChange={(e) => setEditingAgent({ ...editingAgent, system_prompt: e.target.value })}
                  className="input min-h-[120px]"
                  placeholder="Enter system prompt..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Temperature</label>
                <input
                  type="number"
                  value={editingAgent.temperature ?? 0.7}
                  onChange={(e) => setEditingAgent({ ...editingAgent, temperature: parseFloat(e.target.value) })}
                  className="input"
                  min={0}
                  max={2}
                  step={0.1}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Max Tokens</label>
                <input
                  type="number"
                  value={editingAgent.max_tokens ?? 4096}
                  onChange={(e) => setEditingAgent({ ...editingAgent, max_tokens: parseInt(e.target.value) })}
                  className="input"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} className="btn btn-primary flex-1">
                  <Save className="w-4 h-4" />
                  Save
                </button>
                <button onClick={() => { setEditingAgent(null); setIsCreating(false); }} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
