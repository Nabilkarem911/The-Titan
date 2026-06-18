import { useState } from 'react';
import { Users, Plus } from 'lucide-react';
import { api } from '../api/client';
import type { AgentProfile } from '../api/client';
import { useApi } from '../hooks/useApi';
import { SkeletonCard } from '../components/LoadingSkeleton';
import { ErrorState, EmptyState } from '../components/PageState';

export default function Agents() {
  const { data, loading, error, refetch } = useApi(() => api.listAgentProfiles(), []);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreateError(null);
    try {
      await api.createAgentProfile({ name, systemPrompt, maxSteps: 10, allowedTools: [], forbiddenTools: [] });
      setCreating(false);
      setName('');
      setSystemPrompt('');
      refetch();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create agent');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteAgentProfile(id);
      refetch();
    } catch (err) {
      // Error handled by global error toast
      console.error('Delete failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-500/10">
            <Users className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Agents</h2>
            <p className="text-sm text-slate-400">Manage your AI agent profiles</p>
          </div>
        </div>
        <button onClick={() => setCreating(!creating)} className="btn-primary text-sm">
          <Plus className="h-4 w-4" />
          New Agent
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="card space-y-3">
          <h3 className="text-sm font-medium text-white">Create Agent Profile</h3>
          {createError && (
            <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{createError}</div>
          )}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Agent name"
            className="input w-full"
          />
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="System prompt"
            className="input w-full h-24 resize-none"
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="btn-primary text-sm">Create</button>
            <button onClick={() => setCreating(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard count={6} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : !data?.items?.length ? (
        <EmptyState
          icon={<Users className="h-6 w-6 text-slate-400" />}
          title="No agents yet"
          description="Create your first agent profile to get started."
          action={
            <button onClick={() => setCreating(true)} className="btn-primary text-sm">
              <Plus className="h-4 w-4" /> Create Agent
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.items.map((agent: AgentProfile) => (
            <div key={agent.id} className="card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-white">{agent.name}</h3>
                <span className={`badge ${agent.isPublic ? 'badge-success' : 'badge-info'}`}>
                  {agent.isPublic ? 'Public' : 'Private'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-3 line-clamp-2">
                {agent.description ?? agent.systemPrompt.slice(0, 100)}
              </p>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Max steps: {agent.maxSteps}</span>
                <button
                  onClick={() => handleDelete(agent.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
