import { useState, useCallback } from 'react';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { Workflow, RefreshCw, Play, ChevronDown, ChevronRight } from 'lucide-react';
import { ErrorState } from '../components/PageState';
import { SkeletonCard } from '../components/LoadingSkeleton';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';

interface DAGStats {
  totalExecutions: number;
  completed: number;
  failed: number;
  partial: number;
  avgDurationMs: number;
}

interface DAGExecution {
  runId: string;
  workflowId: string;
  status: 'completed' | 'failed' | 'partial';
  executionOrder: string[];
  parallelBatches: string[][];
  durationMs: number;
  retriedNodes: string[];
  skippedNodes: string[];
}

export default function DAGWorkflow() {
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useApi<DAGStats>('/workflows/dag/stats');
  const { data: execData, isLoading: execLoading, refetch: refetchExecs } = useApi<{ executions: DAGExecution[] }>('/workflows/dag/executions');
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [showExecForm, setShowExecForm] = useState(false);
  const [executing, setExecuting] = useState(false);

  const handleExecute = useCallback(async (jsonInput: string) => {
    setExecuting(true);
    try {
      const workflow = JSON.parse(jsonInput);
      await api.post('/workflows/dag/execute', { workflow });
      toast.success('DAG execution started');
      setShowExecForm(false);
      refetchExecs();
      refetchStats();
    } catch (err) {
      toast.error('Execution failed: ' + (err instanceof Error ? err.message : 'unknown'));
    } finally {
      setExecuting(false);
    }
  }, [refetchExecs, refetchStats]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto animate-fade-in">
      <PageHeader
        pageKey="dagWorkflow"
        icon={Workflow}
        title="DAG Workflow Engine"
        subtitle="Topological batch execution with parallel branches & retry"
        description="The DAG (Directed Acyclic Graph) Workflow Engine executes tasks in dependency order — tasks with no dependencies run in parallel, while dependent tasks wait. It supports retries, skip-on-failure, and partial completion. Perfect for complex pipelines like ETL, CI/CD, or multi-step AI workflows. Use this page to view execution stats and run new DAG workflows."
        tips={[
          'DAGs run tasks in topological order — dependencies first',
          'Parallel batches run simultaneously for speed',
          'Failed nodes can be retried automatically or skipped',
        ]}
        actions={
          <div className="flex gap-2">
            <button onClick={() => { refetchStats(); refetchExecs(); }} className="btn-secondary">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          <button onClick={() => setShowExecForm(!showExecForm)} className="btn-primary">
            <Play className="w-4 h-4" />
            Execute
          </button>
        </div>
        }
      />

      {statsError && <ErrorState message={statsError} onRetry={refetchStats} />}

      {showExecForm && <DAGExecForm onExecute={handleExecute} executing={executing} />}

      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-h2 font-bold text-accent-primary tabular-nums">{stats.totalExecutions}</p>
            <p className="text-caption text-text-muted">Total Executions</p>
          </div>
          <div className="card p-4">
            <p className="text-h2 font-bold text-success tabular-nums">{stats.completed}</p>
            <p className="text-caption text-text-muted">Completed</p>
          </div>
          <div className="card p-4">
            <p className="text-h2 font-bold text-error tabular-nums">{stats.failed}</p>
            <p className="text-caption text-text-muted">Failed</p>
          </div>
          <div className="card p-4">
            <p className="text-h2 font-bold text-warning tabular-nums">{stats.avgDurationMs}ms</p>
            <p className="text-caption text-text-muted">Avg Duration</p>
          </div>
        </div>
      ) : null}

      <div className="card p-5">
        <h2 className="text-h3 text-text-primary mb-3">Executions</h2>
        {execLoading ? (
          <SkeletonCard />
        ) : execData?.executions.length ? (
          <div className="space-y-2">
            {execData.executions.slice().reverse().map((e) => (
              <div key={e.runId} className="border border-border-subtle rounded-btn overflow-hidden">
                <button
                  onClick={() => setExpandedRun(expandedRun === e.runId ? null : e.runId)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-elevated transition-colors"
                >
                  {expandedRun === e.runId ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
                  <span className={`px-2 py-0.5 rounded text-caption font-medium ${
                    e.status === 'completed' ? 'bg-success/10 text-success' :
                    e.status === 'failed' ? 'bg-error/10 text-error' :
                    'bg-warning/10 text-warning'
                  }`}>{e.status}</span>
                  <span className="text-small font-mono text-text-primary">{e.runId}</span>
                  <span className="text-caption text-text-muted flex-1 text-right">{e.durationMs}ms</span>
                </button>
                {expandedRun === e.runId && (
                  <div className="p-3 border-t border-border-subtle space-y-2 bg-void/50">
                    <div>
                      <p className="text-caption text-text-muted mb-1">Execution Order</p>
                      <div className="flex flex-wrap gap-1">
                        {e.executionOrder.map((node, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-elevated text-caption font-mono text-text-secondary">
                            {i + 1}. {node}
                          </span>
                        ))}
                      </div>
                    </div>
                    {e.parallelBatches.length > 1 && (
                      <div>
                        <p className="text-caption text-text-muted mb-1">Parallel Batches</p>
                        <div className="space-y-1">
                          {e.parallelBatches.map((batch, i) => (
                            <p key={i} className="text-caption font-mono text-text-secondary">Batch {i + 1}: [{batch.join(', ')}]</p>
                          ))}
                        </div>
                      </div>
                    )}
                    {e.retriedNodes.length > 0 && (
                      <p className="text-caption text-warning">Retried: {e.retriedNodes.join(', ')}</p>
                    )}
                    {e.skippedNodes.length > 0 && (
                      <p className="text-caption text-text-muted">Skipped: {e.skippedNodes.join(', ')}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-small text-text-muted">No executions yet</p>
        )}
      </div>
    </div>
  );
}

function DAGExecForm({ onExecute, executing }: { onExecute: (json: string) => void; executing: boolean }) {
  const [json, setJson] = useState(JSON.stringify({
    id: 'wf-1',
    name: 'Example DAG',
    nodes: [
      { id: 'start', type: 'input', label: 'Start', config: {} },
      { id: 'process', type: 'tool', label: 'Process', config: { toolName: 'echo', params: {} } },
      { id: 'end', type: 'output', label: 'End', config: {} },
    ],
    edges: [
      { from: 'start', to: 'process' },
      { from: 'process', to: 'end' },
    ],
    entryNode: 'start',
  }, null, 2));

  return (
    <div className="card p-5 space-y-3">
      <h2 className="text-h3 text-text-primary">Execute DAG Workflow</h2>
      <p className="text-small text-text-muted">Paste a workflow JSON definition</p>
      <textarea
        className="input-field font-mono text-small min-h-[300px]"
        value={json}
        onChange={e => setJson(e.target.value)}
      />
      <button onClick={() => onExecute(json)} disabled={executing} className="btn-primary">
        <Play className="w-4 h-4" />
        {executing ? 'Executing...' : 'Execute DAG'}
      </button>
    </div>
  );
}
