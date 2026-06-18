import { useState } from 'react';
import { Clock, Plus, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import type { CronJob } from '../api/client';
import { useApi } from '../hooks/useApi';
import { SkeletonTable } from '../components/LoadingSkeleton';
import { ErrorState, EmptyState } from '../components/PageState';

export default function Cron() {
  const { data, loading, error, refetch } = useApi(() => api.listCron(), []);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [schedule, setSchedule] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim() || !schedule.trim()) return;
    setCreateError(null);
    try {
      await api.createCron({ name, schedule, enabled: true });
      setCreating(false);
      setName('');
      setSchedule('');
      refetch();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create cron job');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteCron(id);
      refetch();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-violet-500/10">
            <Clock className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Cron Jobs</h2>
            <p className="text-sm text-slate-400">Schedule recurring agent tasks</p>
          </div>
        </div>
        <button onClick={() => setCreating(!creating)} className="btn-primary text-sm">
          <Plus className="h-4 w-4" />
          New Job
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="card space-y-3">
          <h3 className="text-sm font-medium text-white">Create Cron Job</h3>
          {createError && (
            <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{createError}</div>
          )}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Job name"
            className="input w-full"
          />
          <input
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            placeholder="Cron schedule (e.g. */5 * * * *)"
            className="input w-full"
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="btn-primary text-sm">Create</button>
            <button onClick={() => setCreating(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : !data?.items?.length ? (
        <EmptyState
          icon={<Clock className="h-6 w-6 text-slate-400" />}
          title="No cron jobs"
          description="Create a cron job to schedule recurring tasks."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Schedule</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Next Run</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((job: CronJob) => (
                <tr key={job.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-slate-300">{job.name}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{job.schedule}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${job.enabled ? 'badge-success' : 'badge-warning'}`}>
                      {job.enabled ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {job.nextRun ? new Date(job.nextRun).toLocaleString() : '--'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(job.id)}
                      className="text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
