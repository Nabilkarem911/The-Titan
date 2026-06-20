import { useState } from 'react';
import { Network, Plus, Play, Trash2, Edit3, Save, X } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { ErrorState, EmptyState } from '../components/PageState';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { classNames } from '../utils/format';
import type { SwarmConfig } from '../api/client';

const topoColors: Record<string, string> = { sequential: 'badge-info', parallel: 'badge-success', graph: 'badge-violet' };

export default function Swarm() {
  const [editing, setEditing] = useState<Partial<SwarmConfig> | null>(null);
  const { data: swarms, error, isLoading, refetch } = useApi<SwarmConfig[]>(() => api.getSwarms(), []);

  const save = async () => {
    if (!editing) return;
    if (editing.id) await api.updateSwarm(editing.id, editing);
    else await api.createSwarm(editing);
    setEditing(null); refetch();
  };

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-text-secondary text-sm">{swarms?.length ?? 0} swarm configurations</p>
        <button onClick={() => setEditing({ name: '', agents: [], topology: 'sequential' })} className="btn btn-primary"><Plus className="w-4 h-4" /> New Swarm</button>
      </div>
      {!swarms || swarms.length === 0 ? (
        <EmptyState icon={<Network className="w-7 h-7 text-text-muted" />} title="No swarms" message="Create multi-agent swarm configurations" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {swarms.map((swarm) => (
            <div key={swarm.id} className="card p-5 hover:border-border-light transition-all">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-heading font-semibold text-text-primary">{swarm.name}</h3>
                  {swarm.description && <p className="text-sm text-text-secondary mt-1">{swarm.description}</p>}
                </div>
                <span className={classNames('badge', topoColors[swarm.topology] || 'badge-neutral')}>{swarm.topology}</span>
              </div>
              <div className="text-xs text-text-muted mb-4">{swarm.agents.length} agents</div>
              <div className="flex gap-2">
                <button onClick={async () => { const input = window.prompt('Enter input:'); if (input) await api.runSwarm(swarm.id, input); }} className="btn btn-primary btn-sm flex-1"><Play className="w-4 h-4" /> Run</button>
                <button onClick={() => setEditing({ ...swarm })} className="btn btn-secondary btn-sm"><Edit3 className="w-4 h-4" /></button>
                <button onClick={async () => { await api.deleteSwarm(swarm.id); refetch(); }} className="btn btn-ghost btn-sm text-text-muted hover:text-pink"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative card p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg font-semibold text-text-primary">{editing.id ? 'Edit' : 'New'} Swarm</h2>
              <button onClick={() => setEditing(null)} className="btn btn-ghost p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-sm text-text-secondary mb-1.5">Name</label><input value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="input" /></div>
              <div><label className="block text-sm text-text-secondary mb-1.5">Topology</label>
                <select value={editing.topology ?? 'sequential'} onChange={(e) => setEditing({ ...editing, topology: e.target.value as SwarmConfig['topology'] })} className="input">
                  <option value="sequential">Sequential</option><option value="parallel">Parallel</option><option value="graph">Graph</option>
                </select>
              </div>
              <div><label className="block text-sm text-text-secondary mb-1.5">Agent IDs (comma-separated)</label><input value={editing.agents?.join(', ') ?? ''} onChange={(e) => setEditing({ ...editing, agents: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} className="input font-mono" /></div>
              <div><label className="block text-sm text-text-secondary mb-1.5">Description</label><textarea value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="input" rows={2} /></div>
              <div className="flex gap-2"><button onClick={save} className="btn btn-primary flex-1"><Save className="w-4 h-4" /> Save</button><button onClick={() => setEditing(null)} className="btn btn-secondary">Cancel</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
