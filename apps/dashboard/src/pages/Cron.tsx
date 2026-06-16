import { useState, useEffect } from 'react';
import {
  Clock,
  Plus,
  Trash2,
  Edit3,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  AlertCircle,
  Save,
} from 'lucide-react';

interface CronJob {
  id: string;
  name: string;
  agentId: string;
  prompt: string;
  cronExpression: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
}

const API_BASE = (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_BASE_URL ?? '/api/v1';
const getToken = () => localStorage.getItem('titan_access_token') ?? '';

const CRON_PRESETS = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily at 9AM', value: '0 9 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Weekly (Monday 9AM)', value: '0 9 * * 1' },
  { label: 'Monthly (1st, 9AM)', value: '0 9 1 * *' },
];

export default function CronPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [agentId, setAgentId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [cronExpression, setCronExpression] = useState('0 9 * * *');
  const [enabled, setEnabled] = useState(true);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/cron`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to load jobs');
      const data = await res.json() as { items: CronJob[] };
      setJobs(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const resetForm = () => {
    setName('');
    setAgentId('');
    setPrompt('');
    setCronExpression('0 9 * * *');
    setEnabled(true);
    setEditingId(null);
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!name.trim() || !agentId.trim() || !prompt.trim() || !cronExpression.trim()) {
      setError('All fields are required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/cron`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, agentId, prompt, cronExpression, enabled }),
      });
      if (!res.ok) throw new Error('Failed to create');
      resetForm();
      await fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  };

  const handleUpdate = async (id: string, patch: Partial<CronJob>) => {
    try {
      const res = await fetch(`${API_BASE}/cron/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Update failed');
      await fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this scheduled job?')) return;
    try {
      const res = await fetch(`${API_BASE}/cron/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      await fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const startEdit = (job: CronJob) => {
    setEditingId(job.id);
    setName(job.name);
    setAgentId(job.agentId);
    setPrompt(job.prompt);
    setCronExpression(job.cronExpression);
    setEnabled(job.enabled);
    setShowForm(true);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    await handleUpdate(editingId, { name, agentId, prompt, cronExpression, enabled });
    resetForm();
  };

  const formatCronHuman = (expr: string) => {
    const preset = CRON_PRESETS.find((p) => p.value === expr);
    return preset ? preset.label : expr;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-500/20 text-purple-400">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Scheduled Tasks</h3>
            <p className="text-xs text-slate-500">Automate agent runs with cron schedules</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus className="h-4 w-4" />
          New Schedule
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="card space-y-4">
          <h4 className="text-sm font-medium text-white">
            {editingId ? 'Edit Schedule' : 'New Schedule'}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Daily report" className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Agent ID</label>
              <input value={agentId} onChange={(e) => setAgentId(e.target.value)} placeholder="agent-123" className="input" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Schedule</label>
            <select
              value={cronExpression}
              onChange={(e) => setCronExpression(e.target.value)}
              className="input"
            >
              {CRON_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What should the agent do on each run?"
              rows={3}
              className="input resize-none"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-slate-600 bg-slate-900 text-indigo-600"
            />
            <span className="text-sm text-slate-300">Enabled</span>
          </label>
          <div className="flex gap-2">
            <button
              onClick={editingId ? handleSaveEdit : handleCreate}
              className="btn-primary"
            >
              <Save className="h-4 w-4" />
              {editingId ? 'Save Changes' : 'Create Schedule'}
            </button>
            <button onClick={resetForm} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Jobs List */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Clock className="h-12 w-12 mb-3 text-slate-600" />
            <p className="text-sm">No scheduled tasks yet</p>
            <p className="text-xs text-slate-600 mt-1">Create a schedule to automate agent runs</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800/50 text-xs font-medium text-slate-500 uppercase tracking-wider">
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3 hidden sm:table-cell">Schedule</th>
                <th className="text-left px-5 py-3 hidden md:table-cell">Status</th>
                <th className="text-left px-5 py-3 hidden lg:table-cell">Last / Next</th>
                <th className="text-right px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="px-5 py-3">
                    <div className="text-sm font-medium text-slate-200">{job.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{job.agentId}</div>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-400 hidden sm:table-cell">
                    {formatCronHuman(job.cronExpression)}
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${job.enabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {job.enabled ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      {job.enabled ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500 hidden lg:table-cell">
                    {job.lastRunAt && (
                      <div>Last: {new Date(job.lastRunAt).toLocaleString()}</div>
                    )}
                    {job.nextRunAt && (
                      <div>Next: {new Date(job.nextRunAt).toLocaleString()}</div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleUpdate(job.id, { enabled: !job.enabled })}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                        title={job.enabled ? 'Pause' : 'Resume'}
                      >
                        {job.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => startEdit(job)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                        title="Edit"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(job.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
