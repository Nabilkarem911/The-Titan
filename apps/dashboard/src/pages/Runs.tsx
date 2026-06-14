import { useState, useEffect } from 'react';
import { Search, ChevronRight, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api, type ApiRun, type ApiStep } from '../api/client';

export default function Runs() {
  const [agentId, setAgentId] = useState('default-agent');
  const [runs, setRuns] = useState<ApiRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [steps, setSteps] = useState<ApiStep[]>([]);
  const [stepsLoading, setStepsLoading] = useState(false);

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const res = await api.listRuns(agentId);
      setRuns(res.items);
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSteps = async (runId: string) => {
    setStepsLoading(true);
    setSelectedRunId(runId);
    try {
      const res = await api.getSteps(agentId, runId);
      setSteps(res.items);
    } catch {
      setSteps([]);
    } finally {
      setStepsLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const statusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle className="h-4 w-4 text-emerald-400" />;
    if (status === 'failed') return <AlertCircle className="h-4 w-4 text-red-400" />;
    if (status === 'running') return <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />;
    return <Clock className="h-4 w-4 text-slate-400" />;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Run History</h1>
          <p className="text-slate-400 mt-1">View past agent executions and their step-by-step timeline.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            className="input w-56"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="Agent ID"
          />
          <button onClick={fetchRuns} className="btn-secondary">
            <Search className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Runs List */}
        <div className="space-y-3">
          {loading ? (
            <div className="card text-center py-12 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading runs...
            </div>
          ) : runs.length === 0 ? (
            <div className="card text-center py-12 text-slate-500">
              No runs found for this agent.
            </div>
          ) : (
            runs.map((run) => (
              <button
                key={run.id}
                onClick={() => fetchSteps(run.id)}
                className={`w-full text-left card hover:border-indigo-500/50 transition-colors ${selectedRunId === run.id ? 'border-indigo-500' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {statusIcon(run.status)}
                      <span className="text-sm font-medium text-white">{run.id.slice(0, 8)}</span>
                      <span className="text-xs text-slate-500">{run.status}</span>
                    </div>
                    <p className="text-sm text-slate-400 line-clamp-2">{run.prompt}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>Steps: {run.currentStep}/{run.maxSteps}</span>
                      <span>Tokens: {run.tokensUsed}</span>
                      <span>{new Date(run.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500 mt-1" />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Steps Detail */}
        <div className="card min-h-[400px]">
          {selectedRunId ? (
            stepsLoading ? (
              <div className="text-center py-12 text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Loading steps...
              </div>
            ) : steps.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No steps recorded for this run.</div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-white mb-4">Steps for Run {selectedRunId.slice(0, 8)}</h3>
                {steps.map((step) => (
                  <div key={step.id} className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-indigo-400">Step {step.stepIndex}</span>
                      <span className="text-xs text-slate-500 capitalize">{step.status}</span>
                      {step.latencyMs && <span className="text-xs text-slate-500">{step.latencyMs}ms</span>}
                      {step.tokensUsed && <span className="text-xs text-slate-500">{step.tokensUsed} tokens</span>}
                    </div>

                    {step.thought && (
                      <div className="mb-2">
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Thought</span>
                        <p className="text-sm text-slate-300 mt-1">{step.thought}</p>
                      </div>
                    )}

                    {step.actionName && (
                      <div className="mb-2">
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Action</span>
                        <div className="mt-1 rounded bg-slate-950 px-3 py-2 font-mono text-xs text-emerald-400">
                          {step.actionName}({JSON.stringify(step.actionParams)})
                        </div>
                      </div>
                    )}

                    {step.observationData !== null && (
                      <div className="mb-2">
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Observation</span>
                        <div className="mt-1 rounded bg-slate-950 px-3 py-2 font-mono text-xs text-slate-300">
                          {step.observationSuccess ? JSON.stringify(step.observationData).slice(0, 200) : step.observationError}
                        </div>
                      </div>
                    )}

                    {step.reflection && (
                      <div>
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Reflection</span>
                        <p className="text-sm text-slate-300 mt-1">{step.reflection}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-12 text-slate-500">Select a run to view its steps.</div>
          )}
        </div>
      </div>
    </div>
  );
}
