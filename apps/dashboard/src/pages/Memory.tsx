import { useState } from 'react';
import { Brain, Plus, Trash2, Search, Save, X } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { ErrorState, EmptyState } from '../components/PageState';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { formatRelativeTime } from '../utils/format';
import { useDebounce } from '../hooks/useDebounce';
import type { MemoryEntry } from '../api/client';

export default function Memory() {
  const [namespace, setNamespace] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editing, setEditing] = useState<Partial<MemoryEntry> | null>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);

  const { data: memories, error, isLoading, refetch } = useApi<MemoryEntry[]>(
    () => debouncedSearch ? api.searchMemory(debouncedSearch) : api.getMemories(namespace || undefined),
    [namespace, debouncedSearch]
  );

  const save = async () => {
    if (!editing || !editing.key || !editing.value) return;
    await api.setMemory({ key: editing.key, value: editing.value, namespace: editing.namespace });
    setEditing(null); refetch();
  };

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search memories..." className="input ps-10 w-56" />
          </div>
          <input value={namespace} onChange={(e) => setNamespace(e.target.value)} placeholder="Namespace filter..." className="input w-44" />
        </div>
        <button onClick={() => setEditing({ key: '', value: '', namespace: '' })} className="btn btn-primary"><Plus className="w-4 h-4" /> Add Memory</button>
      </div>

      {!memories || memories.length === 0 ? (
        <EmptyState icon={<Brain className="w-7 h-7 text-text-muted" />} title="No memories" message={searchQuery ? 'No results found' : 'Store key-value pairs for your agents'} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {memories.map((mem) => (
            <div key={mem.id} className="card p-5 hover:border-border-light transition-all">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-mono text-sm font-semibold text-cyan">{mem.key}</h3>
                  {mem.namespace && <span className="badge badge-violet text-[10px] mt-1">{mem.namespace}</span>}
                </div>
                <button onClick={async () => { await api.deleteMemory(mem.id); refetch(); }} className="btn btn-ghost p-1 text-text-muted hover:text-pink"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <p className="text-sm text-text-secondary mt-2 line-clamp-3 break-words">{mem.value}</p>
              <div className="text-xs text-text-muted mt-3">{formatRelativeTime(mem.updated_at)}</div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative card p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg font-semibold text-text-primary">Add Memory</h2>
              <button onClick={() => setEditing(null)} className="btn btn-ghost p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-sm text-text-secondary mb-1.5">Key</label><input value={editing.key ?? ''} onChange={(e) => setEditing({ ...editing, key: e.target.value })} className="input font-mono" /></div>
              <div><label className="block text-sm text-text-secondary mb-1.5">Value</label><textarea value={editing.value ?? ''} onChange={(e) => setEditing({ ...editing, value: e.target.value })} className="input" rows={4} /></div>
              <div><label className="block text-sm text-text-secondary mb-1.5">Namespace (optional)</label><input value={editing.namespace ?? ''} onChange={(e) => setEditing({ ...editing, namespace: e.target.value })} className="input" /></div>
              <div className="flex gap-2"><button onClick={save} disabled={!editing.key || !editing.value} className="btn btn-primary flex-1"><Save className="w-4 h-4" /> Save</button><button onClick={() => setEditing(null)} className="btn btn-secondary">Cancel</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
