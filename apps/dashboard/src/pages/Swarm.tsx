import { useState } from 'react';
import { Layers, Play, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { SkeletonTable } from '../components/LoadingSkeleton';
import { ErrorState, EmptyState } from '../components/PageState';

export default function Swarm() {
  const { data, loading, error, refetch } = useApi(() => api.listSwarmTasks(), []);
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!prompt.trim()) return;
    setRunning(true);
    setRunError(null);
    setRunResult(null);
    try {
      const res = await api.runSwarm({ prompt });
      setRunResult(`Swarm task started: ${res.taskId}`);
      setPrompt('');
      refetch();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Failed to start swarm');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-500/10">
            <Layers className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Swarm</h2>
            <p className="text-sm text-slate-400">Multi-agent orchestration tasks</p>
          </div>
        </div>
        <button onClick={refetch} className="btn-secondary text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Run form */}
      <div className="card space-y-3">
        <h3 className="text-sm font-medium text-white">Run Swarm Task</h3>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the task for the swarm..."
          className="input w-full h-24 resize-none"
        />
        <button onClick={handleRun} disabled={running} className="btn-primary text-sm">
          <Play className="h-4 w-4" />
          {running ? 'Starting...' : 'Run Swarm'}
        </button>
        {runError && (
          <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{runError}</div>
        )}
        {runResult && (
          <div className="text-sm text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-lg">{runResult}</div>
        )}
      </div>

      {/* Tasks list */}
      {loading ? (
        <SkeletonTable rows={5} cols={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : !data?.items?.length ? (
        <EmptyState
          icon={<Layers className="h-6 w-6 text-slate-400" />}
          title="No swarm tasks"
          description="Run a swarm task to coordinate multiple agents."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Task ID</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((task, i) => (
                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-slate-300 font-mono text-xs">
                    {String(task.id ?? task.taskId ?? '--').slice(0, 12)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${
                      task.status === 'completed' ? 'badge-success' :
                      task.status === 'failed' ? 'badge-error' : 'badge-info'
                    }`}>
                      {String(task.status ?? 'unknown')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {task.createdAt ? new Date(String(task.createdAt)).toLocaleString() : '--'}
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
