import { Link } from 'react-router-dom';
import {
  Bot,
  Clock,
  Activity,
  TrendingUp,
  Zap,
  ArrowUpRight,
  CircleDot,
  CheckCircle2,
  XCircle,
  BarChart3,
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { ErrorState } from '../components/PageState';
import { SkeletonCard } from '../components/LoadingSkeleton';
import { classNames } from '../utils/format';
import type { AgentProfile, QueueStats, HealthStatus, MetricsData } from '../api/client';

function StatCard({
  label,
  value,
  icon,
  trend,
  color = 'cyan',
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color?: 'cyan' | 'violet' | 'success' | 'warning' | 'pink';
}) {
  const colorMap = {
    cyan: { bg: 'bg-[rgba(0,242,254,0.08)]', text: 'text-cyan', border: 'border-[rgba(0,242,254,0.15)]' },
    violet: { bg: 'bg-[rgba(112,0,255,0.08)]', text: 'text-violet', border: 'border-[rgba(112,0,255,0.15)]' },
    success: { bg: 'bg-[rgba(16,185,129,0.08)]', text: 'text-success', border: 'border-[rgba(16,185,129,0.15)]' },
    warning: { bg: 'bg-[rgba(245,158,11,0.08)]', text: 'text-warning', border: 'border-[rgba(245,158,11,0.15)]' },
    pink: { bg: 'bg-[rgba(255,0,122,0.08)]', text: 'text-pink', border: 'border-[rgba(255,0,122,0.15)]' },
  };

  const c = colorMap[color];

  return (
    <div className={classNames('card p-5 border', c.border)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-text-muted text-sm">{label}</span>
        <div className={classNames('w-9 h-9 rounded-lg flex items-center justify-center', c.bg)}>
          <span className={c.text}>{icon}</span>
        </div>
      </div>
      <div className="text-2xl font-heading font-bold text-text-primary">{value}</div>
      {trend && (
        <div className="flex items-center gap-1 mt-1">
          <TrendingUp className="w-3 h-3 text-success" />
          <span className="text-xs text-success">{trend}</span>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { data: agents, error: agentsError, isLoading: agentsLoading, refetch: refetchAgents } = useApi<AgentProfile[]>(
    () => api.getAgents(),
    []
  );
  const { data: queueStats, isLoading: queueLoading } = useApi<QueueStats>(
    () => api.getQueueStats(),
    []
  );
  const { data: health, isLoading: healthLoading } = useApi<HealthStatus>(
    () => api.getHealth(),
    []
  );
  const { data: metrics, isLoading: metricsLoading } = useApi<MetricsData>(
    () => api.getMetrics(),
    []
  );

  if (agentsError) {
    return <ErrorState message={agentsError} onRetry={refetchAgents} />;
  }

  const isLoading = agentsLoading || queueLoading || healthLoading || metricsLoading;

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              label="Active Agents"
              value={agents?.length ?? 0}
              icon={<Bot className="w-5 h-5" />}
              color="violet"
            />
            <StatCard
              label="Queue Jobs"
              value={queueStats?.running ?? 0}
              icon={<Clock className="w-5 h-5" />}
              trend={queueStats ? `${queueStats.pending} pending` : undefined}
              color="cyan"
            />
            <StatCard
              label="System Health"
              value={health?.status === 'healthy' ? 'Healthy' : health?.status ?? 'Unknown'}
              icon={<Activity className="w-5 h-5" />}
              color={health?.status === 'healthy' ? 'success' : 'warning'}
            />
            <StatCard
              label="Requests / min"
              value={metrics?.requests_per_minute ?? 0}
              icon={<Zap className="w-5 h-5" />}
              color="cyan"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agents overview */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="font-heading font-semibold text-text-primary">Agents</h2>
            <Link to="/agents" className="text-xs text-cyan hover:underline flex items-center gap-1">
              View all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4">
            {agentsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton h-14 w-full" />
                ))}
              </div>
            ) : agents && agents.length > 0 ? (
              <div className="space-y-2">
                {agents.slice(0, 5).map((agent) => (
                  <Link
                    key={agent.id}
                    to="/agents"
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-card-hover transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[rgba(112,0,255,0.1)] flex items-center justify-center">
                      <Bot className="w-5 h-5 text-violet" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text-primary truncate">{agent.name}</div>
                      <div className="text-xs text-text-muted">{agent.model}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-text-muted">{agent.tools.length} tools</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-text-muted text-sm">
                No agents configured
              </div>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="card">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="font-heading font-semibold text-text-primary">System</h2>
            <Link to="/metrics" className="text-xs text-cyan hover:underline flex items-center gap-1">
              Details <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4 space-y-4">
            {metricsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton h-8 w-full" />
                ))}
              </div>
            ) : metrics ? (
              <>
                <MetricBar label="CPU" value={metrics.cpu_usage} />
                <MetricBar label="Memory" value={metrics.memory_usage} />
                <MetricBar label="Disk" value={metrics.disk_usage} />
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">Avg Response</span>
                    <span className="text-text-primary font-mono">{metrics.avg_response_time}ms</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-text-muted">Error Rate</span>
                    <span className={classNames(
                      'font-mono',
                      metrics.error_rate > 5 ? 'text-pink' : 'text-success'
                    )}>
                      {metrics.error_rate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-text-muted">Total Runs</span>
                    <span className="text-text-primary font-mono">{metrics.total_runs.toLocaleString()}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-text-muted text-sm">
                No metrics data
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Queue overview */}
      {queueStats && (
        <div className="card">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="font-heading font-semibold text-text-primary">Queue Overview</h2>
            <Link to="/queue" className="text-xs text-cyan hover:underline flex items-center gap-1">
              Manage <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 p-4">
            <QueueStat label="Pending" value={queueStats.pending} icon={<CircleDot className="w-4 h-4" />} color="text-warning" />
            <QueueStat label="Running" value={queueStats.running} icon={<BarChart3 className="w-4 h-4" />} color="text-cyan" />
            <QueueStat label="Completed" value={queueStats.completed} icon={<CheckCircle2 className="w-4 h-4" />} color="text-success" />
            <QueueStat label="Failed" value={queueStats.failed} icon={<XCircle className="w-4 h-4" />} color="text-pink" />
            <QueueStat label="Workers" value={queueStats.workers} icon={<Zap className="w-4 h-4" />} color="text-violet" />
          </div>
        </div>
      )}
    </div>
  );
}

function MetricBar({ label, value }: { label: string; value: number }) {
  const color = value > 80 ? 'bg-pink' : value > 60 ? 'bg-warning' : 'bg-cyan';
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-text-muted">{label}</span>
        <span className="text-text-primary font-mono">{value.toFixed(0)}%</span>
      </div>
      <div className="w-full h-1.5 bg-deep rounded-full overflow-hidden">
        <div
          className={classNames('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

function QueueStat({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="text-center">
      <div className={classNames('flex items-center justify-center mb-1', color)}>{icon}</div>
      <div className="text-xl font-heading font-bold text-text-primary">{value}</div>
      <div className="text-xs text-text-muted">{label}</div>
    </div>
  );
}
