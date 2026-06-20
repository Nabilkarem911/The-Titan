import type { ReactNode } from 'react';
import { Activity, CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { usePollingApi } from '../hooks/useApi';
import { api } from '../api/client';
import { ErrorState } from '../components/PageState';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { classNames, formatDuration } from '../utils/format';
import type { HealthStatus } from '../api/client';

const statusIcon: Record<string, ReactNode> = {
  pass: <CheckCircle2 className="w-5 h-5 text-success" />,
  warn: <AlertTriangle className="w-5 h-5 text-warning" />,
  fail: <XCircle className="w-5 h-5 text-pink" />,
};

const statusColor: Record<string, { text: string; bg: string; border: string }> = {
  healthy: { text: 'text-success', bg: 'bg-[rgba(16,185,129,0.08)]', border: 'border-[rgba(16,185,129,0.2)]' },
  degraded: { text: 'text-warning', bg: 'bg-[rgba(245,158,11,0.08)]', border: 'border-[rgba(245,158,11,0.2)]' },
  unhealthy: { text: 'text-pink', bg: 'bg-[rgba(255,0,122,0.08)]', border: 'border-[rgba(255,0,122,0.2)]' },
};

export default function Health() {
  const { data: health, error, isLoading, refetch } = usePollingApi<HealthStatus>(() => api.getHealth(), 10000, []);
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (isLoading) return <PageSkeleton />;
  if (!health) return <ErrorState message="No health data" onRetry={refetch} />;
  const sc = statusColor[health.status] || statusColor.unhealthy;

  return (
    <div className="space-y-6">
      <div className={classNames('card p-6 border', sc.border)}>
        <div className="flex items-center gap-4">
          <div className={classNames('w-14 h-14 rounded-xl flex items-center justify-center', sc.bg)}><Activity className={classNames('w-7 h-7', sc.text)} /></div>
          <div>
            <h2 className={classNames('font-heading text-2xl font-bold capitalize', sc.text)}>{health.status}</h2>
            <div className="flex items-center gap-4 text-sm text-text-muted mt-1">
              <span>Version: {health.version}</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Uptime: {formatDuration(health.uptime)}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(health.checks).map(([name, check]) => (
          <div key={name} className="card p-5 hover:border-border-light transition-all">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading font-semibold text-text-primary capitalize">{name}</h3>
              {statusIcon[check.status]}
            </div>
            {check.message && <p className="text-sm text-text-secondary mb-2">{check.message}</p>}
            {check.latency_ms != null && <div className="flex items-center gap-1 text-xs text-text-muted"><Clock className="w-3 h-3" />{check.latency_ms}ms</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
