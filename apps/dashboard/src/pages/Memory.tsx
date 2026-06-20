import { useState } from 'react';
import { Brain, Plus, Trash2, Download, Upload } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { toast } from 'sonner';
import { EmptyState, ErrorState } from '../components/PageState';
import { SkeletonRow } from '../components/LoadingSkeleton';

interface MemoryItem {
  key: string;
  value: string;
}

interface ListResponseMemory {
  items: MemoryItem[];
  total: number;
}

export default function Memory() {
  const { data, isLoading, error, refetch } = useApi<ListResponseMemory>('/user-context');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ key: '', value: '' });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/user-context', form);
      toast.success('Memory added');
      setShowAdd(false);
      setForm({ key: '', value: '' });
      refetch();
    } catch (err) {
      toast.error('Failed to add memory', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm('Delete this memory?')) return;
    try {
      await api.delete(`/user-context/${encodeURIComponent(key)}`);
      toast.success('Memory deleted');
      refetch();
    } catch (err) {
      toast.error('Failed to delete', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleExport = () => {
    const json = JSON.stringify(data?.items ?? [], null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `titan-memory-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Memory exported');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const items: MemoryItem[] = JSON.parse(text);
      for (const item of items) {
        await api.post('/user-context', item);
      }
      toast.success(`Imported ${items.length} memories`);
      refetch();
    } catch {
      toast.error('Failed to import — invalid JSON format');
    }
    e.target.value = '';
  };

  if (error) return <ErrorState message={error} onRetry={refetch} className="py-20" />;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-text-primary flex items-center gap-2">
            <Brain className="w-6 h-6 text-accent-secondary" />
            Memory
          </h1>
          <p className="text-small text-text-secondary mt-1">User context and persistent memory</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={!data?.items.length} className="btn-secondary flex items-center gap-1.5" title="Export as JSON">
            <Download className="w-4 h-4" />
            Export
          </button>
          <label className="btn-secondary flex items-center gap-1.5 cursor-pointer" title="Import from JSON">
            <Upload className="w-4 h-4" />
            Import
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Memory
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="card">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} columns={2} />)}</div>
      ) : data?.items.length ? (
        <div className="card overflow-hidden">
          <div className="divide-y divide-border-subtle">
            {data.items.map((item) => (
              <div key={item.key} className="px-5 py-3 group flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary font-medium">{item.key}</p>
                  <p className="text-small text-text-secondary truncate mt-0.5">{item.value}</p>
                </div>
                <button onClick={() => handleDelete(item.key)} className="btn-icon text-error hover:text-error opacity-0 group-hover:opacity-100 transition-opacity" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState icon={Brain} title="No memories stored" description="Add context to help agents personalize responses" action={{ label: 'Add Memory', onClick: () => setShowAdd(true) }} />
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowAdd(false)}>
          <div className="card p-6 max-w-lg w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-h2 text-text-primary mb-4">Add Memory</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Key</label>
                <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} className="input" placeholder="preferred_language" required />
              </div>
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Value</label>
                <textarea value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="input" rows={3} placeholder="English" required />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
