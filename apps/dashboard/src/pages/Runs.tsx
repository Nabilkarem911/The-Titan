import { useState } from 'react';
import { History } from 'lucide-react';
import { api } from '../api/client';
import type { AgentProfile, ApiRun } from '../api/client';
import { useApi } from '../hooks/useApi';
import { SkeletonTable } from '../components/LoadingSkeleton';
import { ErrorState, EmptyState } from '../components/PageState';

export default function Runs() {
  const { data: agents, loading: agentsLoading } = useApi(() => api.listAgentProfiles(), []);
  const [selectedAgent, setSelectedAgent] = useState('');
  const {
    data: runs,
    loading: runsLoading,
    error,
    refetch,
  } = useApi(
    () => (selectedAgent ? api.listRuns(selectedAgent) : Promise.resolve({ items: [], total: 0 })),
    [selectedAgent],
  );

  const loading = agentsLoading || runsLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-500/10">
            <History className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Runs</h2>
            <p className="text-sm text-slate-400">View agent run history and details</p>
          </div>
        </div>
      </div>

      {/* Agent selector */}
      <div>
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="input"
        >
          <option value="">Select an agent...</option>
          {agents?.items?.map((a: AgentProfile) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {!selectedAgent ? (
        <EmptyState
          icon={<History className="h-6 w-6 text-slate-400" />}
          title="Select an agent"
          description="Choose an agent above to view its run history."
        />
      ) : loading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : !runs?.items?.length ? (
        <EmptyState
          icon={<History className="h-6 w-6 text-slate-400" />}
          title="No runs yet"
          description="This agent has no run history."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Run ID</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Steps</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Tokens</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {runs.items.map((run: ApiRun) => (
                <tr key={run.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-slate-300 font-mono text-xs">{run.id.slice(0, 12)}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${
                      run.status === 'completed' ? 'badge-success' :
                      run.status === 'failed' ? 'badge-error' :
                      run.status === 'running' ? 'badge-warning' : 'badge-info'
                    }`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{run.currentStep}/{run.maxSteps}</td>
                  <td className="px-4 py-3 text-slate-400">{run.tokensUsed.toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(run.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
