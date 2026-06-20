import React from 'react';
import { Cpu, HardDrive, Wifi, Clock, Zap, DollarSign, Hash, BarChart3 } from 'lucide-react';
import { usePollingApi } from '../hooks/useApi';
import { api } from '../api/client';
import { ErrorState } from '../components/PageState';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { classNames } from '../utils/format';
import type { MetricsData } from '../api/client';

function GaugeCard({ label, value, unit, icon, color }: { label: string; value: number; unit: string; icon: React.ReactNode; color: string }) {
  const barColor = value > 80 ? 'bg-pink' : value > 60 ? 'bg-warning' : `bg-${color}`;
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-3"><span className={`text-${color}`}>{icon}</span><span className="text-sm text-text-muted">{label}</span></div>
      <div className="text-2xl font-heading font-bold text-text-primary mb-2">{value.toFixed(1)}{unit}</div>
      <div className="w-full h-1.5 bg-deep rounded-full overflow-hidden">
        <div className={classNames('h-full rounded-full transition-all duration-700', barColor)} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit, icon, color }: { label: string; value: number | string; unit?: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-3"><span className={`text-${color}`}>{icon}</span><span className="text-sm text-text-muted">{label}</span></div>
      <div className="text-2xl font-heading font-bold text-text-primary">
        {typeof value === 'number' ? value.toLocaleString() : value}{unit && <span className="text-sm text-text-muted ms-1">{unit}</span>}
      </div>
    </div>
  );
}

export default function Metrics() {
  const { data: metrics, error, isLoading, refetch } = usePollingApi<MetricsData>(() => api.getMetrics(), 5000, []);
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (isLoading) return <PageSkeleton />;
  if (!metrics) return <ErrorState message="No metrics data" onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <GaugeCard label="CPU Usage" value={metrics.cpu_usage} unit="%" icon={<Cpu className="w-5 h-5" />} color="cyan" />
        <GaugeCard label="Memory Usage" value={metrics.memory_usage} unit="%" icon={<BarChart3 className="w-5 h-5" />} color="violet" />
        <GaugeCard label="Disk Usage" value={metrics.disk_usage} unit="%" icon={<HardDrive className="w-5 h-5" />} color="success" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Active Connections" value={metrics.active_connections} icon={<Wifi className="w-5 h-5" />} color="cyan" />
        <MetricCard label="Requests / min" value={metrics.requests_per_minute} icon={<Zap className="w-5 h-5" />} color="violet" />
        <MetricCard label="Avg Response" value={metrics.avg_response_time} unit="ms" icon={<Clock className="w-5 h-5" />} color="success" />
        <MetricCard label="Error Rate" value={`${metrics.error_rate.toFixed(2)}%`} icon={<BarChart3 className="w-5 h-5" />} color={metrics.error_rate > 5 ? 'pink' : 'success'} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Total Runs" value={metrics.total_runs} icon={<Hash className="w-5 h-5" />} color="cyan" />
        <MetricCard label="Total Tokens" value={metrics.total_tokens} icon={<Zap className="w-5 h-5" />} color="violet" />
        <MetricCard label="Total Cost" value={`$${metrics.total_cost.toFixed(2)}`} icon={<DollarSign className="w-5 h-5" />} color="success" />
      </div>
    </div>
  );
}
