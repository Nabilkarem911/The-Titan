import { useState } from 'react';
import { Activity, ChevronRight } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import type { ListResponse, AgentRun, AgentStep } from '../api/types';
import { EmptyState, ErrorState } from '../components/PageState';
import { SkeletonRow } from '../components/LoadingSkeleton';
import { StatusBadge } from '../components/StatusBadge';
import { formatRelativeTime, formatDuration } from '../utils/format';
import { useEffect } from 'react';

export default function Runs() {
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = useApi<ListResponse<AgentRun>>('/agents/default/runs?limit=20');

  const { data: stepsData } = useApi<ListResponse<AgentStep>>(
    selectedRun ? `/agents/default/runs/${selectedRun}/steps` : null,
  );

  // Auto-refresh when there are running tasks
  useEffect(() => {
    const hasRunning = data?.items.some(r => r.status === 'running' || r.status === 'queued');
    if (!hasRunning) return;
    const interval = setInterval(() => refetch(), 5000);
    return () => clearInterval(interval);
  }, [data, refetch]);

  if (error) return <ErrorState message={error} onRetry={refetch} className="py-20" />;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-h1 text-text-primary">Runs</h1>
        <p className="text-small text-text-secondary mt-1">Agent execution history and step details</p>
      </div>

      {isLoading ? (
        <div className="card">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} columns={4} />)}
        </div>
      ) : data?.items.length ? (
        <div className="card overflow-hidden">
          <div className="divide-y divide-border-subtle">
            {data.items.map((run) => (
              <div
                key={run.id}
                className="px-5 py-3 hover:bg-elevated/30 transition-colors cursor-pointer"
                onClick={() => setSelectedRun(selectedRun === run.id ? null : run.id)}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary truncate">{run.prompt}</p>
                    <p className="text-caption text-text-muted mt-0.5">
                      {formatRelativeTime(run.createdAt)} · Step {run.currentStep}/{run.maxSteps}
                      {run.tokensUsed > 0 && ` · ${run.tokensUsed} tokens`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={run.status} pulse={run.status === 'running'} />
                    <ChevronRight className={`w-4 h-4 text-text-muted transition-transform ${selectedRun === run.id ? 'rotate-90' : ''}`} />
                  </div>
                </div>

                {/* Expanded steps */}
                {selectedRun === run.id && stepsData && (
                  <div className="mt-4 ml-4 space-y-2 border-l-2 border-border-subtle pl-4">
                    {stepsData.items.length === 0 ? (
                      <p className="text-small text-text-muted py-2">No steps recorded yet</p>
                    ) : (
                      stepsData.items.map((step) => (
                        <div key={step.id} className="relative">
                          <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-accent-primary" />
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-caption text-text-muted font-mono">Step {step.stepIndex}</span>
                            <StatusBadge status={step.status} />
                            {step.latencyMs && <span className="text-caption text-text-muted">{formatDuration(step.latencyMs)}</span>}
                          </div>
                          {step.thought && <p className="text-small text-text-secondary mb-1"><span className="text-text-muted">Thought:</span> {step.thought}</p>}
                          {step.actionName && <p className="text-small text-text-secondary mb-1"><span className="text-text-muted">Action:</span> <code className="text-accent-primary">{step.actionName}</code></p>}
                          {step.observationData != null && (() => {
                            const result = typeof step.observationData === 'string'
                              ? String(step.observationData)
                              : JSON.stringify(step.observationData).slice(0, 200);
                            return <p className="text-small text-text-secondary mb-1"><span className="text-text-muted">Result:</span> {result}</p>;
                          })()}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Activity}
          title="No runs yet"
          description="Agent runs will appear here once you start executing agents"
        />
      )}
    </div>
  );
}
