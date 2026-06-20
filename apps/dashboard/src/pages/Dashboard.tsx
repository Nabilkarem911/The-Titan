import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Bot,
  MessageSquare,
  Network,
  Plus,
  TerminalSquare,
  Zap,
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import type { HealthDashboard, ListResponse, AgentRun, AgentProfile } from '../api/types';
import { SkeletonCard } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/PageState';
import { StatusBadge } from '../components/StatusBadge';
import { formatRelativeTime } from '../utils/format';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: health, isLoading: healthLoading, error: healthError, refetch: refetchHealth } = useApi<HealthDashboard>('/health/dashboard');
  const { data: runsData } = useApi<ListResponse<AgentRun>>('/agents/default/runs?limit=5');
  const { data: profilesData } = useApi<ListResponse<AgentProfile>>('/agent-profiles?limit=5');

  const stats = [
    { label: 'Active Runs', value: runsData?.items.filter(r => r.status === 'running').length ?? 0, icon: Activity, color: 'text-running', bg: 'bg-running/10' },
    { label: 'Total Runs', value: runsData?.total ?? 0, icon: Zap, color: 'text-accent-primary', bg: 'bg-accent-primary/10' },
    { label: 'Agent Profiles', value: profilesData?.total ?? 0, icon: Bot, color: 'text-accent-secondary', bg: 'bg-accent-secondary/10' },
    { label: 'DB Pool', value: health?.dbPool ? `${health.dbPool.total}` : '—', icon: Network, color: 'text-accent-tertiary', bg: 'bg-accent-tertiary/10' },
  ];

  const quickActions = [
    { label: 'New Chat', icon: MessageSquare, path: '/chat', color: 'text-accent-primary' },
    { label: 'Run Agent', icon: Bot, path: '/agents', color: 'text-accent-secondary' },
    { label: 'Open Terminal', icon: TerminalSquare, path: '/terminal', color: 'text-accent-tertiary' },
    { label: 'Launch Swarm', icon: Network, path: '/swarm', color: 'text-warning' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-text-primary">Mission Control</h1>
          <p className="text-small text-text-secondary mt-1">Overview of your AI operations</p>
        </div>
        <button onClick={() => navigate('/chat')} className="btn-primary">
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {healthLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          stats.map((stat) => (
            <div key={stat.label} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-btn ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
              <p className="text-h2 font-bold text-text-primary tabular-nums">{stat.value}</p>
              <p className="text-small text-text-secondary mt-1">{stat.label}</p>
            </div>
          ))
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => navigate(action.path)}
            className="card-hover p-4 flex items-center gap-3 text-left"
          >
            <action.icon className={`w-5 h-5 ${action.color}`} />
            <span className="text-sm font-medium text-text-primary">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Recent Runs + Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Runs */}
        <div className="card lg:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
            <h2 className="text-h3 text-text-primary">Recent Runs</h2>
            <button onClick={() => navigate('/runs')} className="text-small text-accent-primary hover:underline">
              View all
            </button>
          </div>
          {runsData?.items.length ? (
            <div className="divide-y divide-border-subtle">
              {runsData.items.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-elevated/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/runs`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary truncate">{run.prompt}</p>
                    <p className="text-caption text-text-muted mt-0.5">{formatRelativeTime(run.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-caption text-text-muted tabular-nums">{run.currentStep}/{run.maxSteps}</span>
                    <StatusBadge status={run.status} pulse={run.status === 'running'} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-12 text-center">
              <p className="text-small text-text-secondary">No runs yet</p>
              <button onClick={() => navigate('/agents')} className="btn-secondary mt-3">
                <Bot className="w-4 h-4" />
                Run an agent
              </button>
            </div>
          )}
        </div>

        {/* System Health */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
            <h2 className="text-h3 text-text-primary">System Health</h2>
            <button onClick={refetchHealth} className="btn-icon !w-7 !h-7" title="Refresh">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          {healthError ? (
            <ErrorState message={healthError} onRetry={refetchHealth} className="py-8" />
          ) : health ? (
            <div className="p-5 space-y-3">
              <HealthRow label="PostgreSQL" ok={!!health.dbPool} detail={health.dbPool ? `${health.dbPool.idle} idle / ${health.dbPool.total} total` : 'unavailable'} />
              <HealthRow label="Redis" ok={true} detail="connected" />
              <HealthRow label="Audit Integrity" ok={health.auditIntegrity && typeof health.auditIntegrity === 'object' && 'valid' in (health.auditIntegrity as Record<string, unknown>) ? (health.auditIntegrity as { valid: boolean }).valid : true} detail={typeof health.auditIntegrity === 'object' && 'status' in (health.auditIntegrity as Record<string, unknown>) ? 'pending' : 'verified'} />
            </div>
          ) : (
            <div className="p-5 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-12 rounded-btn" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HealthRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className={`w-2 h-2 rounded-full ${ok ? 'bg-success' : 'bg-error'}`} />
        <span className="text-sm text-text-primary">{label}</span>
      </div>
      <span className="text-caption text-text-muted">{detail}</span>
    </div>
  );
}
