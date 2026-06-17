import { useState, useEffect } from 'react';
import { Bot, Plus, Trash2, Edit3, Globe, Lock, Loader2, X } from 'lucide-react';
import { api, type AgentProfile } from '../api/client';

export default function Agents() {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentProfile | null>(null);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const [mine, pub] = await Promise.all([
        api.listAgentProfiles(),
        api.listPublicAgentProfiles(),
      ]);
      // Merge and deduplicate
      const map = new Map<string, AgentProfile>();
      for (const a of [...(mine.items ?? []), ...(pub.items ?? [])]) {
        map.set(a.id, a);
      }
      setAgents(Array.from(map.values()));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAgents(); }, []);

  const deleteAgent = async (id: string) => {
    if (!confirm('Delete this agent?')) return;
    try {
      await api.deleteAgentProfile(id);
      setAgents((prev) => prev.filter((a) => a.id !== id));
    } catch { /* silent */ }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-indigo-400" />
          <h1 className="text-xl font-semibold text-white">Agent Profiles</h1>
          <span className="text-sm text-slate-500">{agents.length} agents</span>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Create Agent
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={() => setEditingAgent(agent)}
              onDelete={() => deleteAgent(agent.id)}
            />
          ))}
        </div>
      )}

      {(showCreate || editingAgent) && (
        <AgentFormModal
          agent={editingAgent}
          onClose={() => { setShowCreate(false); setEditingAgent(null); }}
          onSaved={() => { setShowCreate(false); setEditingAgent(null); loadAgents(); }}
        />
      )}
    </div>
  );
}

function AgentCard({ agent, onEdit, onDelete }: { agent: AgentProfile; onEdit: () => void; onDelete: () => void }) {
  const isSystem = agent.ownerId === '00000000-0000-0000-0000-000000000001';

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">{agent.name}</h3>
          <p className="text-xs text-slate-500 font-mono">{agent.slug}</p>
        </div>
        <div className="flex items-center gap-1">
          {agent.isPublic ? (
            <Globe className="h-3.5 w-3.5 text-green-400" />
          ) : (
            <Lock className="h-3.5 w-3.5 text-slate-500" />
          )}
        </div>
      </div>

      {agent.description && (
        <p className="text-xs text-slate-400 line-clamp-2">{agent.description}</p>
      )}

      <div className="flex flex-wrap gap-1">
        {agent.allowedTools.slice(0, 4).map((tool) => (
          <span key={tool} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
            {tool}
          </span>
        ))}
        {agent.allowedTools.length > 4 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">
            +{agent.allowedTools.length - 4}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-800">
        <span className="text-xs text-slate-600">max {agent.maxSteps} steps</span>
        {!isSystem && (
          <div className="flex gap-1">
            <button onClick={onEdit} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300" aria-label={`Edit agent ${agent.name}`}>
              <Edit3 className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDelete} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-red-400" aria-label={`Delete agent ${agent.name}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {isSystem && <span className="text-[10px] text-indigo-400/60">built-in</span>}
      </div>
    </div>
  );
}

function AgentFormModal({ agent, onClose, onSaved }: { agent: AgentProfile | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(agent?.name ?? '');
  const [slug, setSlug] = useState(agent?.slug ?? '');
  const [description, setDescription] = useState(agent?.description ?? '');
  const [systemPrompt, setSystemPrompt] = useState(agent?.systemPrompt ?? '');
  const [allowedTools, setAllowedTools] = useState(agent?.allowedTools.join(', ') ?? '');
  const [forbiddenTools, setForbiddenTools] = useState(agent?.forbiddenTools.join(', ') ?? '');
  const [maxSteps, setMaxSteps] = useState(agent?.maxSteps ?? 10);
  const [isPublic, setIsPublic] = useState(agent?.isPublic ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const body = {
      name,
      slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      description: description || undefined,
      systemPrompt: systemPrompt || undefined,
      allowedTools: allowedTools.split(',').map((s) => s.trim()).filter(Boolean),
      forbiddenTools: forbiddenTools.split(',').map((s) => s.trim()).filter(Boolean),
      maxSteps,
      isPublic,
    };

    try {
      if (agent) {
        await api.updateAgentProfile(agent.id, body);
      } else {
        await api.createAgentProfile(body);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={agent ? 'Edit agent' : 'Create agent'}>
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            {agent ? 'Edit Agent' : 'Create Agent'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-800 text-slate-400" aria-label="Close dialog">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="agent-name" className="text-xs text-slate-400 mb-1 block">Name</label>
            <input id="agent-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Custom Agent" required />
          </div>

          <div>
            <label htmlFor="agent-slug" className="text-xs text-slate-400 mb-1 block">Slug (URL identifier)</label>
            <input id="agent-slug" className="input font-mono" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-custom-agent" />
          </div>

          <div>
            <label htmlFor="agent-description" className="text-xs text-slate-400 mb-1 block">Description</label>
            <input id="agent-description" className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this agent do?" />
          </div>

          <div>
            <label htmlFor="agent-system-prompt" className="text-xs text-slate-400 mb-1 block">System Prompt</label>
            <textarea
              id="agent-system-prompt"
              className="input resize-none min-h-[100px]"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful AI assistant that..."
            />
          </div>

          <div>
            <label htmlFor="agent-allowed-tools" className="text-xs text-slate-400 mb-1 block">Allowed Tools (comma-separated)</label>
            <input id="agent-allowed-tools" className="input font-mono text-xs" value={allowedTools} onChange={(e) => setAllowedTools(e.target.value)} placeholder="brave_search, http_request, calculate" />
          </div>

          <div>
            <label htmlFor="agent-forbidden-tools" className="text-xs text-slate-400 mb-1 block">Forbidden Tools (comma-separated)</label>
            <input id="agent-forbidden-tools" className="input font-mono text-xs" value={forbiddenTools} onChange={(e) => setForbiddenTools(e.target.value)} placeholder="bash, docker, write_file" />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="agent-max-steps" className="text-xs text-slate-400 mb-1 block">Max Steps</label>
              <input id="agent-max-steps" type="number" className="input" value={maxSteps} onChange={(e) => setMaxSteps(Number(e.target.value))} min={1} max={50} />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" id="isPublic" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="rounded" />
              <label htmlFor="isPublic" className="text-xs text-slate-400">Public</label>
            </div>
          </div>

          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary flex-1" disabled={saving || !name}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {agent ? 'Save Changes' : 'Create Agent'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
