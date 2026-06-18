import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  Server,
  Gauge,
  Clock,
  RefreshCw,
  Users,
  Terminal,
  HeartPulse,
  AlertCircle,
} from 'lucide-react';
import { getToken, API_BASE } from '../api/client';
import { SkeletonCard } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/PageState';

interface HealthData {
  status: string;
  db?: { status: string };
  redis?: { status: string };
  uptime?: number;
  [key: string]: unknown;
}

interface MetricsData {
  [key: string]: unknown;
}

interface CronData {
  items: Array<Record<string, unknown>>;
  total: number;
}

async function fetchWithAuth(url: string) {
  const token = getToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}

export default function Dashboard() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [cronCount, setCronCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading((prev) => !health && prev);
    setError(null);
    try {
      const [h, m, c] = await Promise.allSettled([
        fetchWithAuth('/health/dashboard'),
        fetchWithAuth('/metrics.json'),
        fetchWithAuth(`${API_BASE}/cron`),
      ]);

      if (h.status === 'fulfilled') setHealth(h.value as HealthData);
      else setHealth(null);

      if (m.status === 'fulfilled') setMetrics(m.value as MetricsData);
      else setMetrics(null);

      if (c.status === 'fulfilled') {
        const cronData = c.value as CronData;
        setCronCount(cronData.total ?? cronData.items?.length ?? 0);
      } else {
        setCronCount(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  if (loading && !health) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard count={4} />
        </div>
      </div>
    );
  }

  if (error && !health) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <ErrorState message={error} onRetry={fetchAll} />
      </div>
    );
  }

  const dbStatus = health?.db?.status ?? health?.status ?? 'unknown';
  const redisStatus = health?.redis?.status ?? 'unknown';

  return (
    <div className="space-y-6">
      <PageHeader onRefresh={fetchAll} />

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard
          icon={<Database className="h-5 w-5" />}
          label="Database"
          value={dbStatus}
          color={dbStatus === 'ok' || dbStatus === 'healthy' ? 'emerald' : 'red'}
        />
        <StatusCard
          icon={<Server className="h-5 w-5" />}
          label="Redis"
          value={redisStatus}
          color={redisStatus === 'ok' || redisStatus === 'healthy' ? 'emerald' : 'red'}
        />
        <StatusCard
          icon={<Gauge className="h-5 w-5" />}
          label="System"
          value={health?.status ?? 'unknown'}
          color={health?.status === 'ok' || health?.status === 'healthy' ? 'emerald' : 'amber'}
        />
        <StatusCard
          icon={<Clock className="h-5 w-5" />}
          label="Cron Jobs"
          value={cronCount !== null ? String(cronCount) : '--'}
          color="indigo"
        />
      </div>

      {/* Metrics Summary */}
      {metrics && (
        <div className="card">
          <h3 className="text-sm font-medium text-white mb-3">Metrics Overview</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(metrics)
              .filter(([, v]) => typeof v === 'number')
              .slice(0, 8)
              .map(([key, value]) => (
                <div key={key}>
                  <p className="text-xs text-slate-500 truncate">{key.replace(/_/g, ' ')}</p>
                  <p className="text-lg font-semibold text-white">{String(value)}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="card">
        <h3 className="text-sm font-medium text-white mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickAction to="/agents" icon={<Users className="h-4 w-4" />} label="Agents" />
          <QuickAction to="/runs" icon={<LayoutDashboard className="h-4 w-4" />} label="Runs" />
          <QuickAction to="/terminal" icon={<Terminal className="h-4 w-4" />} label="Terminal" />
          <QuickAction to="/health" icon={<HeartPulse className="h-4 w-4" />} label="Health" />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Some data failed to load. Auto-retrying in 30s.</span>
        </div>
      )}
    </div>
  );
}

function PageHeader({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-500/10">
          <LayoutDashboard className="h-5 w-5 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Dashboard</h2>
          <p className="text-sm text-slate-400">System overview and quick actions</p>
        </div>
      </div>
      {onRefresh && (
        <button onClick={onRefresh} className="btn-secondary text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      )}
    </div>
  );
}

function StatusCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'emerald' | 'red' | 'amber' | 'indigo';
}) {
  const colors = {
    emerald: 'bg-emerald-500/10 text-emerald-400',
    red: 'bg-red-500/10 text-red-400',
    amber: 'bg-amber-500/10 text-amber-400',
    indigo: 'bg-indigo-500/10 text-indigo-400',
  };
  const badgeColors = {
    emerald: 'badge-success',
    red: 'badge-error',
    amber: 'badge-warning',
    indigo: 'badge-info',
  };

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-2">
        <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${colors[color]}`}>
          {icon}
        </div>
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <span className={`badge ${badgeColors[color]}`}>{value}</span>
    </div>
  );
}

function QuickAction({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 text-sm text-slate-300 hover:text-white transition-colors"
    >
      {icon}
      {label}
    </Link>
  );
}
