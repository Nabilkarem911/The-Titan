import { useState } from 'react';
import { CalendarClock, Plus, Edit3, Trash2, Power, Save, X } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { ErrorState, EmptyState } from '../components/PageState';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { classNames, formatRelativeTime } from '../utils/format';
import type { CronJob } from '../api/client';

export default function Cron() {
  const [editingJob, setEditingJob] = useState<Partial<CronJob> | null>(null);
  const { data: jobs, error, isLoading, refetch } = useApi<CronJob[]>(() => api.getCronJobs(), []);

  const saveJob = async () => {
    if (!editingJob) return;
    if (editingJob.id) await api.updateCronJob(editingJob.id, editingJob);
    else await api.createCronJob(editingJob);
    setEditingJob(null); refetch();
  };

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-text-secondary text-sm">{jobs?.length ?? 0} scheduled jobs</p>
        <button onClick={() => setEditingJob({ name: '', schedule: '*/5 * * * *', agent_id: '', input: '', enabled: true })} className="btn btn-primary"><Plus className="w-4 h-4" /> New Cron Job</button>
      </div>
      {!jobs || jobs.length === 0 ? (
        <EmptyState icon={<CalendarClock className="w-7 h-7 text-text-muted" />} title="No cron jobs" message="Schedule recurring tasks for your agents" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobs.map((job) => (
            <div key={job.id} className="card p-5 hover:border-border-light transition-all">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-heading font-semibold text-text-primary">{job.name}</h3>
                  <p className="text-xs font-mono text-cyan mt-0.5">{job.schedule}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={async () => { await api.toggleCronJob(job.id, !job.enabled); refetch(); }} className={classNames('btn btn-ghost p-1.5', job.enabled ? 'text-success' : 'text-text-muted')}><Power className="w-4 h-4" /></button>
                  <button onClick={() => setEditingJob({ ...job })} className="btn btn-ghost p-1.5"><Edit3 className="w-4 h-4" /></button>
                  <button onClick={async () => { await api.deleteCronJob(job.id); refetch(); }} className="btn btn-ghost p-1.5 text-text-muted hover:text-pink"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-text-muted mt-3">
                <span className={classNames('badge', job.enabled ? 'badge-success' : 'badge-neutral')}>{job.enabled ? 'Active' : 'Paused'}</span>
                <span>{job.run_count} runs</span>
                {job.last_run && <span>Last: {formatRelativeTime(job.last_run)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {editingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditingJob(null)}>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative card p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg font-semibold text-text-primary">{editingJob.id ? 'Edit' : 'New'} Cron Job</h2>
              <button onClick={() => setEditingJob(null)} className="btn btn-ghost p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-sm text-text-secondary mb-1.5">Name</label><input value={editingJob.name ?? ''} onChange={(e) => setEditingJob({ ...editingJob, name: e.target.value })} className="input" /></div>
              <div><label className="block text-sm text-text-secondary mb-1.5">Schedule</label><input value={editingJob.schedule ?? ''} onChange={(e) => setEditingJob({ ...editingJob, schedule: e.target.value })} className="input font-mono" placeholder="*/5 * * * *" /></div>
              <div><label className="block text-sm text-text-secondary mb-1.5">Agent ID</label><input value={editingJob.agent_id ?? ''} onChange={(e) => setEditingJob({ ...editingJob, agent_id: e.target.value })} className="input font-mono" /></div>
              <div><label className="block text-sm text-text-secondary mb-1.5">Input</label><textarea value={editingJob.input ?? ''} onChange={(e) => setEditingJob({ ...editingJob, input: e.target.value })} className="input" rows={3} /></div>
              <div className="flex gap-2"><button onClick={saveJob} className="btn btn-primary flex-1"><Save className="w-4 h-4" /> Save</button><button onClick={() => setEditingJob(null)} className="btn btn-secondary">Cancel</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
