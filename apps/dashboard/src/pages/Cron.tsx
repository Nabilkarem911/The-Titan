import { useState } from 'react';
import { Clock, Plus, Trash2 } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { toast } from 'sonner';
import type { ListResponse, CronJob } from '../api/types';
import { EmptyState, ErrorState } from '../components/PageState';
import { SkeletonRow } from '../components/LoadingSkeleton';
import { StatusBadge } from '../components/StatusBadge';
import { formatRelativeTime } from '../utils/format';

export default function Cron() {
  const { data, isLoading, error, refetch } = useApi<ListResponse<CronJob>>('/cron');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', agentId: 'default', prompt: '', cronExpression: '0 * * * *' });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/cron', form);
      toast.success('Cron job created');
      setShowCreate(false);
      setForm({ name: '', agentId: 'default', prompt: '', cronExpression: '0 * * * *' });
      refetch();
    } catch (err) {
      toast.error('Failed to create cron job', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this cron job?')) return;
    try {
      await api.delete(`/cron/${id}`);
      toast.success('Cron job deleted');
      refetch();
    } catch (err) {
      toast.error('Failed to delete', { description: err instanceof Error ? err.message : undefined });
    }
  };

  if (error) return <ErrorState message={error} onRetry={refetch} className="py-20" />;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-text-primary flex items-center gap-2">
            <Clock className="w-6 h-6 text-warning" />
            Cron Jobs
          </h1>
          <p className="text-small text-text-secondary mt-1">Schedule recurring agent tasks</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          Create Job
        </button>
      </div>

      {isLoading ? (
        <div className="card">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} columns={3} />)}</div>
      ) : data?.items.length ? (
        <div className="card overflow-hidden">
          <div className="divide-y divide-border-subtle">
            {data.items.map((job) => (
              <div key={job.id} className="px-5 py-3 group flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary">{job.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <code className="text-caption text-accent-primary font-mono">{job.cronExpression}</code>
                    <StatusBadge status={job.enabled ? 'enabled' : 'disabled'} />
                    {job.lastRunAt && <span className="text-caption text-text-muted">Last: {formatRelativeTime(job.lastRunAt)}</span>}
                  </div>
                </div>
                <button onClick={() => handleDelete(job.id)} className="btn-icon text-error hover:text-error opacity-0 group-hover:opacity-100 transition-opacity" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState icon={Clock} title="No cron jobs" description="Schedule recurring agent tasks" action={{ label: 'Create Job', onClick: () => setShowCreate(true) }} />
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowCreate(false)}>
          <div className="card p-6 max-w-lg w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-h2 text-text-primary mb-4">Create Cron Job</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" required />
              </div>
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Agent ID</label>
                <input value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })} className="input font-mono" required />
              </div>
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Prompt</label>
                <textarea value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} className="input" rows={3} required />
              </div>
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Cron Expression</label>
                <input value={form.cronExpression} onChange={(e) => setForm({ ...form, cronExpression: e.target.value })} className="input font-mono" required />
                <p className="text-caption text-text-muted mt-1">Format: minute hour day month weekday (e.g. 0 * * * * = hourly)</p>
              </div>
              <div className="flex justify-end gap-2">
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
