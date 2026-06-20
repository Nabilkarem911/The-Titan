import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Plus, Trash2, Play } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { toast } from 'sonner';
import type { ListResponse, AgentProfile } from '../api/types';
import { EmptyState, ErrorState } from '../components/PageState';
import { SkeletonCard } from '../components/LoadingSkeleton';
import { StatusBadge } from '../components/StatusBadge';
import { formatRelativeTime } from '../utils/format';

export default function Agents() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useApi<ListResponse<AgentProfile>>('/agent-profiles');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', slug: '', description: '', systemPrompt: '', model: '', maxSteps: 10 });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/agent-profiles', {
        name: createForm.name,
        slug: createForm.slug,
        description: createForm.description || undefined,
        systemPrompt: createForm.systemPrompt || undefined,
        model: createForm.model || undefined,
        maxSteps: createForm.maxSteps,
      });
      toast.success('Agent created');
      setShowCreate(false);
      setCreateForm({ name: '', slug: '', description: '', systemPrompt: '', model: '', maxSteps: 10 });
      refetch();
    } catch (err) {
      toast.error('Failed to create agent', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this agent profile?')) return;
    try {
      await api.delete(`/agent-profiles/${id}`);
      toast.success('Agent deleted');
      refetch();
    } catch (err) {
      toast.error('Failed to delete', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleRun = async (profile: AgentProfile) => {
    try {
      const result = await api.post<{ runId: string }>(`/agents/${profile.slug}/run`, {
        prompt: `Run agent: ${profile.name}`,
        maxSteps: profile.maxSteps,
      });
      toast.success('Agent started', { description: `Run ID: ${result.runId}` });
      navigate('/runs');
    } catch (err) {
      toast.error('Failed to start agent', { description: err instanceof Error ? err.message : undefined });
    }
  };

  if (error) return <ErrorState message={error} onRetry={refetch} className="py-20" />;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-text-primary">Agents</h1>
          <p className="text-small text-text-secondary mt-1">Manage and run AI agent profiles</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          Create Agent
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : data?.items.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.items.map((profile) => (
            <div key={profile.id} className="card-hover p-5 group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-btn bg-accent-secondary/10 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-accent-secondary" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleRun(profile)} className="btn-icon !w-7 !h-7" title="Run agent">
                    <Play className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(profile.id)} className="btn-icon !w-7 !h-7 text-error hover:text-error" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <h3 className="text-h3 text-text-primary mb-1">{profile.name}</h3>
              <p className="text-small text-text-secondary line-clamp-2 mb-3">{profile.description || 'No description'}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={profile.isPublic ? 'enabled' : 'disabled'} />
                {profile.model && <span className="badge bg-elevated text-text-secondary">{profile.model}</span>}
                <span className="text-caption text-text-muted ml-auto">{formatRelativeTime(profile.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Bot}
          title="No agents yet"
          description="Create your first AI agent to get started"
          action={{ label: 'Create Agent', onClick: () => setShowCreate(true) }}
        />
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowCreate(false)}>
          <div className="card p-6 max-w-lg w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-h2 text-text-primary mb-4">Create Agent</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Name</label>
                <input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} className="input" required />
              </div>
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Slug</label>
                <input value={createForm.slug} onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="input font-mono" placeholder="my-agent" required />
              </div>
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Description</label>
                <input value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} className="input" />
              </div>
              <div>
                <label className="block text-label text-text-secondary mb-1.5">System Prompt</label>
                <textarea value={createForm.systemPrompt} onChange={(e) => setCreateForm({ ...createForm, systemPrompt: e.target.value })} className="input font-mono" rows={4} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-label text-text-secondary mb-1.5">Model</label>
                  <input value={createForm.model} onChange={(e) => setCreateForm({ ...createForm, model: e.target.value })} className="input" placeholder="gpt-4" />
                </div>
                <div>
                  <label className="block text-label text-text-secondary mb-1.5">Max Steps</label>
                  <input type="number" value={createForm.maxSteps} onChange={(e) => setCreateForm({ ...createForm, maxSteps: parseInt(e.target.value) || 10 })} className="input" min={1} max={50} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
