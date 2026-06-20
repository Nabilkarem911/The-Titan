import { useState, useEffect, useCallback } from 'react';
import { Plus, Bot, Trash2, Edit3, X, Save, Loader2, Globe, Lock } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { EmptyState } from '../components/PageState';
import { Skeleton } from '../components/LoadingSkeleton';

interface AgentProfile {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  systemPrompt?: string | null;
  model?: string | null;
  allowedTools?: string[] | null;
  forbiddenTools?: string[] | null;
  maxSteps: number;
  temperature?: number | null;
  ownerId: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AgentProfiles() {
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AgentProfile | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    systemPrompt: '',
    model: '',
    maxSteps: 10,
    temperature: 0.7,
    isPublic: false,
    forbiddenTools: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ items: AgentProfile[]; total: number }>('/agent-profiles');
      setProfiles(res.items);
    } catch (err) {
      toast.error('Failed to load profiles', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', slug: '', description: '', systemPrompt: '', model: '', maxSteps: 10, temperature: 0.7, isPublic: false, forbiddenTools: '' });
    setShowModal(true);
  };

  const openEdit = (p: AgentProfile) => {
    setEditing(p);
    setForm({
      name: p.name,
      slug: p.slug,
      description: p.description ?? '',
      systemPrompt: p.systemPrompt ?? '',
      model: p.model ?? '',
      maxSteps: p.maxSteps,
      temperature: p.temperature ?? 0.7,
      isPublic: p.isPublic,
      forbiddenTools: (p.forbiddenTools ?? []).join(', '),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error('Name and slug are required');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || undefined,
      systemPrompt: form.systemPrompt.trim() || undefined,
      model: form.model.trim() || undefined,
      maxSteps: form.maxSteps,
      temperature: form.temperature,
      isPublic: form.isPublic,
      forbiddenTools: form.forbiddenTools.split(',').map(s => s.trim()).filter(Boolean),
    };
    try {
      if (editing) {
        await api.patch(`/agent-profiles/${editing.id}`, payload);
        toast.success('Profile updated');
      } else {
        await api.post('/agent-profiles', payload);
        toast.success('Profile created');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error('Failed to save profile', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: AgentProfile) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try {
      await api.delete(`/agent-profiles/${p.id}`);
      toast.success('Profile deleted');
      load();
    } catch (err) {
      toast.error('Failed to delete', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-h2 text-text-primary flex items-center gap-2">
            <Bot className="w-6 h-6 text-accent-primary" />
            Agent Profiles
          </h1>
          <p className="text-caption text-text-secondary mt-1">Create and manage AI agent personalities</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          New Profile
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : profiles.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agent profiles yet"
          description="Create your first agent profile to customize Titan's behavior"
          action={{ label: 'Create Profile', onClick: openCreate }}
        />
      ) : (
        <div className="space-y-3">
          {profiles.map(p => (
            <div key={p.id} className="card p-4 hover:border-border-default transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-body text-text-primary font-medium">{p.name}</h3>
                    <span className="badge bg-elevated text-text-muted text-caption font-mono">{p.slug}</span>
                    {p.isPublic ? (
                      <span className="badge bg-accent-primary/10 text-accent-primary text-caption flex items-center gap-1">
                        <Globe className="w-3 h-3" /> Public
                      </span>
                    ) : (
                      <span className="badge bg-elevated text-text-muted text-caption flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Private
                      </span>
                    )}
                  </div>
                  {p.description && <p className="text-caption text-text-secondary mb-2">{p.description}</p>}
                  <div className="flex flex-wrap gap-2 text-caption text-text-muted">
                    {p.model && <span>Model: <span className="text-text-secondary font-mono">{p.model}</span></span>}
                    <span>Max steps: <span className="text-text-secondary">{p.maxSteps}</span></span>
                    {p.temperature != null && <span>Temp: <span className="text-text-secondary">{p.temperature}</span></span>}
                    {p.forbiddenTools && p.forbiddenTools.length > 0 && (
                      <span>Forbidden: <span className="text-text-secondary">{p.forbiddenTools.join(', ')}</span></span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-3">
                  <button onClick={() => openEdit(p)} className="btn-icon" title="Edit">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(p)} className="btn-icon hover:text-error" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-h3 text-text-primary">{editing ? 'Edit Profile' : 'New Profile'}</h3>
              <button onClick={() => setShowModal(false)} className="btn-icon">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-caption text-text-muted block mb-1">Name *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="My Agent"
                    className="input"
                  />
                </div>
                <div>
                  <label className="text-caption text-text-muted block mb-1">Slug *</label>
                  <input
                    value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                    placeholder="my-agent"
                    className="input font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-caption text-text-muted block mb-1">Description</label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="A brief description"
                  className="input"
                />
              </div>

              <div>
                <label className="text-caption text-text-muted block mb-1">System Prompt</label>
                <textarea
                  value={form.systemPrompt}
                  onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
                  placeholder="You are a helpful assistant..."
                  rows={5}
                  className="input font-mono text-sm resize-y"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-caption text-text-muted block mb-1">Model</label>
                  <input
                    value={form.model}
                    onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                    placeholder="gpt-4o"
                    className="input font-mono"
                  />
                </div>
                <div>
                  <label className="text-caption text-text-muted block mb-1">Max Steps</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={form.maxSteps}
                    onChange={e => setForm(f => ({ ...f, maxSteps: parseInt(e.target.value) || 10 }))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="text-caption text-text-muted block mb-1">Temperature</label>
                  <input
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={form.temperature}
                    onChange={e => setForm(f => ({ ...f, temperature: parseFloat(e.target.value) || 0.7 }))}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="text-caption text-text-muted block mb-1">Forbidden Tools (comma-separated)</label>
                <input
                  value={form.forbiddenTools}
                  onChange={e => setForm(f => ({ ...f, forbiddenTools: e.target.value }))}
                  placeholder="execute_bash, send_email"
                  className="input font-mono"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPublic}
                  onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))}
                  className="w-4 h-4 rounded accent-accent-primary"
                />
                <span className="text-caption text-text-secondary">Make this profile public</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.slug.trim()} className="btn-primary flex items-center gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editing ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
