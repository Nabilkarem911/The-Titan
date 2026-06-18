import { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Cpu,
  Database,
  HardDrive,
  Clock,
  MessageSquare,
  FolderOpen,
  GitBranch,
  Zap,
  RefreshCw,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { API_BASE, getToken } from '../api/client';
import { formatBytes } from '../utils/format';
import { ErrorState } from '../components/PageState';

interface HealthStatus {
  dbPool: { total: number; idle: number; waiting: number } | null;
  queues: Record<string, { waiting?: number; active?: number; completed?: number; failed?: number }>;
  audit: unknown;
  auditIntegrity: { valid: boolean } | { status: string };
  auditArchival: { lastArchived: number } | { status: string };
  timestamp: string;
}

interface MetricsSnapshot {
  metrics: Record<string, unknown>;
  dbPool: { total: number; idle: number; waiting: number } | null;
  redis: { status: string; memory?: number };
  timestamp: string;
}

interface WorkspaceStats {
  totalFiles: number;
  totalDirs: number;
}

export default function DashboardPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceStats | null>(null);
  const [cronCount, setCronCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${getToken()}` };
      const [healthRes, metricsRes, filesRes, cronRes] = await Promise.all([
        fetch(`${API_BASE}/health/dashboard`, { headers }).catch(() => null),
        fetch(`${API_BASE}/metrics`, { headers }).catch(() => null),
        fetch(`${API_BASE}/files?path=/`, { headers }).catch(() => null),
        fetch(`${API_BASE}/cron`, { headers }).catch(() => null),
      ]);

      let anySuccess = false;

      if (healthRes?.ok) {
        setHealth(await healthRes.json() as HealthStatus);
        anySuccess = true;
      }
      if (metricsRes?.ok) {
        setMetrics(await metricsRes.json() as MetricsSnapshot);
        anySuccess = true;
      }
      if (filesRes?.ok) {
        const f = await filesRes.json() as { items: Array<{ type: 'file' | 'directory' }> };
        const items = f.items ?? [];
        setWorkspace({
          totalFiles: items.filter((i) => i.type === 'file').length,
          totalDirs: items.filter((i) => i.type === 'directory').length,
        });
        anySuccess = true;
      }
      if (cronRes?.ok) {
        const c = await cronRes.json() as { total: number };
        setCronCount(c.total ?? 0);
        anySuccess = true;
      }

      if (!anySuccess && !health && !metrics) {
        setError('Could not connect to any backend service');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    }
    setLastRefresh(new Date());
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30_000);
    return () => clearInterval(interval);
  }, []);

  const dbStatus = health?.dbPool ? 'healthy' : 'unknown';
  const redisStatus = metrics?.redis.status ?? 'unknown';

  const totalQueueJobs = Object.values(health?.queues ?? {}).reduce(
    (sum, q) => sum + (q.waiting ?? 0) + (q.active ?? 0) + (q.failed ?? 0),
    0,
  );

  if (error && !health && !metrics) {
    return <ErrorState message={error} onRetry={fetchAll} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Dashboard</h3>
            <p className="text-xs text-slate-500">System overview and real-time status</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </span>
          <button onClick={fetchAll} className="btn-secondary" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
          Some services unavailable: {error}
        </div>
      )}

      {/* Status Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatusCard
          icon={<Database className="h-5 w-5" />}
          label="Database"
          status={dbStatus}
          detail={health?.dbPool ? `${health.dbPool.total} connections` : '—'}
          loading={loading}
        />
        <StatusCard
          icon={<Cpu className="h-5 w-5" />}
          label="Redis"
          status={redisStatus}
          detail={metrics?.redis.memory ? formatBytes(metrics.redis.memory) : '—'}
          loading={loading}
        />
        <StatusCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Queues"
          status={totalQueueJobs > 0 ? 'active' : 'idle'}
          detail={`${totalQueueJobs} jobs`}
          loading={loading}
        />
        <StatusCard
          icon={<CheckCircle className="h-5 w-5" />}
          label="Audit"
          status={
            health?.auditIntegrity && 'valid' in health.auditIntegrity && health.auditIntegrity.valid
              ? 'healthy'
              : 'warning'
          }
          detail="Integrity check"
          loading={loading}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickStatCard
          icon={<FolderOpen className="h-5 w-5 text-amber-400" />}
          label="Workspace Files"
          value={workspace?.totalFiles ?? 0}
          sub={`${workspace?.totalDirs ?? 0} dirs`}
          to="/files"
        />
        <QuickStatCard
          icon={<Clock className="h-5 w-5 text-purple-400" />}
          label="Cron Jobs"
          value={cronCount}
          sub="scheduled"
          to="/cron"
        />
        <QuickStatCard
          icon={<MessageSquare className="h-5 w-5 text-emerald-400" />}
          label="Chat"
          value="Live"
          sub="streaming"
          to="/chat"
        />
        <QuickStatCard
          icon={<GitBranch className="h-5 w-5 text-orange-400" />}
          label="Git"
          value="Push"
          sub="deploy"
          to="/git"
        />
      </div>

      {/* Queue Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-400" />
            <h4 className="text-sm font-medium text-white">Queue Status</h4>
          </div>
          {Object.entries(health?.queues ?? {}).length === 0 ? (
            <p className="text-sm text-slate-500">No queue data available</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(health?.queues ?? {}).map(([name, stats]) => (
                <div key={name} className="flex items-center gap-3 text-sm">
                  <span className="text-slate-400 flex-1 truncate">{name}</span>
                  <div className="flex gap-2 text-xs">
                    <span className="text-amber-400">{stats.waiting ?? 0} waiting</span>
                    <span className="text-blue-400">{stats.active ?? 0} active</span>
                    <span className="text-emerald-400">{stats.completed ?? 0} done</span>
                    {stats.failed ? <span className="text-red-400">{stats.failed} failed</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-cyan-400" />
            <h4 className="text-sm font-medium text-white">Database Pool</h4>
          </div>
          {health?.dbPool ? (
            <div className="grid grid-cols-3 gap-2">
              <PoolStat label="Total" value={health.dbPool.total} />
              <PoolStat label="Idle" value={health.dbPool.idle} />
              <PoolStat label="Waiting" value={health.dbPool.waiting} />
            </div>
          ) : (
            <p className="text-sm text-slate-500">Pool info unavailable</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-400" />
          <h4 className="text-sm font-medium text-white">Quick Actions</h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          <QuickAction to="/chat" label="Chat" />
          <QuickAction to="/agents" label="Agents" />
          <QuickAction to="/editor" label="Editor" />
          <QuickAction to="/terminal" label="Terminal" />
          <QuickAction to="/files" label="Files" />
          <QuickAction to="/git" label="Git" />
          <QuickAction to="/analytics" label="Analytics" />
          <QuickAction to="/settings" label="Settings" />
        </div>
      </div>
    </div>
  );
}

function StatusCard({
  icon,
  label,
  status,
  detail,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  status: string;
  detail: string;
  loading: boolean;
}) {
  const colors: Record<string, string> = {
    healthy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    ok: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    active: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    idle: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
    warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    degraded: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    down: 'text-red-400 bg-red-500/10 border-red-500/20',
    unknown: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  };
  const color = colors[status] ?? colors.unknown;

  return (
    <div className={`card p-3 flex items-center gap-3 border ${color}`}>
      <div className="flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-slate-400">{label}</div>
        <div className="text-sm font-medium flex items-center gap-1.5">
          {loading ? (
            <span className="inline-block w-8 h-3 bg-slate-700/50 rounded animate-pulse" />
          ) : (
            <>
              {status === 'healthy' || status === 'ok' ? (
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
              ) : status === 'down' ? (
                <XCircle className="h-3.5 w-3.5 text-red-400" />
              ) : status === 'warning' || status === 'degraded' ? (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              ) : null}
              <span className="capitalize">{status}</span>
            </>
          )}
        </div>
        <div className="text-xs text-slate-500">{detail}</div>
      </div>
    </div>
  );
}

function QuickStatCard({
  icon,
  label,
  value,
  sub,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  to: string;
}) {
  return (
    <a href={to} className="card p-4 flex items-center gap-3 hover:bg-slate-800/60 transition-colors group">
      <div className="flex-shrink-0 p-2 rounded-lg bg-slate-800/60 group-hover:bg-slate-700/60 transition-colors">
        {icon}
      </div>
      <div>
        <div className="text-lg font-semibold text-white">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-[10px] text-slate-600">{sub}</div>
      </div>
    </a>
  );
}

function PoolStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-2 rounded-lg bg-slate-800/50 text-center">
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function QuickAction({ to, label }: { to: string; label: string }) {
  return (
    <a
      href={to}
      className="p-2 rounded-lg bg-slate-800/50 text-center text-xs text-slate-300 hover:bg-indigo-500/10 hover:text-indigo-400 transition-colors border border-slate-700/30 hover:border-indigo-500/20"
    >
      {label}
    </a>
  );
}
