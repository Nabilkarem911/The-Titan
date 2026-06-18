import { useState, useEffect } from 'react';
import {
  HeartPulse,
  Database,
  HardDrive,
  ShieldCheck,
  Archive,
  AlertCircle,
  RefreshCw,
  Clock,
  Layers,
} from 'lucide-react';

interface HealthDashboard {
  dbPool: { total: number; idle: number; waiting: number } | null;
  queues: Record<string, { waiting?: number; active?: number; completed?: number; failed?: number; delayed?: number; error?: string }>;
  audit: { count: number; oldest: string | null; newest: string | null; archiveCount: number } | null;
  auditIntegrity: { valid?: boolean; brokenAt?: string | null; checked?: number; lastCheckAt?: string; status?: string; reason?: string };
  auditArchival: { lastArchived?: number; lastArchiveAt?: string; status?: string; reason?: string };
  timestamp: string;
}

import { getToken } from '../api/client';

export default function HealthPage() {
  const [data, setData] = useState<HealthDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/health/dashboard', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json() as HealthDashboard;
      setData(json);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10_000);
    return () => clearInterval(interval);
  }, []);

  const queueEntries = data ? Object.entries(data.queues) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-rose-500/20 text-rose-400">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">System Health</h3>
            <p className="text-xs text-slate-500">Real-time infrastructure status</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-slate-500">
              <Clock className="h-3 w-3 inline mr-1" />
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button onClick={fetchHealth} className="btn-secondary px-3">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* DB Pool */}
      {data?.dbPool && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-400" />
            <h4 className="text-sm font-medium text-white">Database Pool</h4>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-slate-800/40 text-center">
              <div className="text-lg font-semibold text-white">{data.dbPool.total}</div>
              <div className="text-[10px] text-slate-500">Total</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/40 text-center">
              <div className="text-lg font-semibold text-emerald-400">{data.dbPool.idle}</div>
              <div className="text-[10px] text-slate-500">Idle</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/40 text-center">
              <div className="text-lg font-semibold text-amber-400">{data.dbPool.waiting}</div>
              <div className="text-[10px] text-slate-500">Waiting</div>
            </div>
          </div>
        </div>
      )}

      {/* Queues */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-violet-400" />
          <h4 className="text-sm font-medium text-white">Queues</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {queueEntries.length === 0 ? (
            <div className="col-span-full text-center text-xs text-slate-500 py-4">No queue data</div>
          ) : (
            queueEntries.map(([name, stats]) => (
              <div key={name} className="p-3 rounded-lg bg-slate-800/40 space-y-2">
                <div className="text-xs font-medium text-slate-300">{name}</div>
                {'error' in stats && stats.error ? (
                  <div className="text-xs text-red-400">{stats.error}</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="flex justify-between"><span className="text-slate-500">Waiting</span><span className="text-white">{stats.waiting ?? 0}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Active</span><span className="text-amber-400">{stats.active ?? 0}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Done</span><span className="text-emerald-400">{stats.completed ?? 0}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Failed</span><span className="text-red-400">{stats.failed ?? 0}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Delayed</span><span className="text-slate-400">{stats.delayed ?? 0}</span></div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Audit */}
      {data?.audit && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-emerald-400" />
            <h4 className="text-sm font-medium text-white">Audit Logs</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-slate-800/40 text-center">
              <div className="text-lg font-semibold text-white">{data.audit.count.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500">Total</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/40 text-center">
              <div className="text-sm font-semibold text-white">{data.audit.oldest ? new Date(data.audit.oldest).toLocaleDateString() : '—'}</div>
              <div className="text-[10px] text-slate-500">Oldest</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/40 text-center">
              <div className="text-sm font-semibold text-white">{data.audit.newest ? new Date(data.audit.newest).toLocaleDateString() : '—'}</div>
              <div className="text-[10px] text-slate-500">Newest</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/40 text-center">
              <div className="text-lg font-semibold text-white">{data.audit.archiveCount.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500">Archived</div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Integrity */}
      {data?.auditIntegrity && (
        <div className={`card space-y-2 ${data.auditIntegrity.valid ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
          <div className="flex items-center gap-2">
            <ShieldCheck className={`h-4 w-4 ${data.auditIntegrity.valid ? 'text-emerald-400' : 'text-red-400'}`} />
            <h4 className="text-sm font-medium text-white">Audit Integrity</h4>
          </div>
          {'status' in data.auditIntegrity && data.auditIntegrity.status === 'pending' ? (
            <div className="text-xs text-slate-500">{data.auditIntegrity.reason}</div>
          ) : (
            <div className="flex flex-wrap gap-3 text-xs">
              <span className={`px-2 py-0.5 rounded-full border ${data.auditIntegrity.valid ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                {data.auditIntegrity.valid ? 'Valid' : 'Broken'}
              </span>
              <span className="text-slate-400">Checked: {data.auditIntegrity.checked}</span>
              {data.auditIntegrity.lastCheckAt && (
                <span className="text-slate-500">Last: {new Date(data.auditIntegrity.lastCheckAt).toLocaleString()}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Audit Archival */}
      {data?.auditArchival && (
        <div className="card space-y-2">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-blue-400" />
            <h4 className="text-sm font-medium text-white">Audit Archival</h4>
          </div>
          {'status' in data.auditArchival && data.auditArchival.status === 'pending' ? (
            <div className="text-xs text-slate-500">{data.auditArchival.reason}</div>
          ) : (
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="text-slate-400">Archived: {data.auditArchival.lastArchived}</span>
              {data.auditArchival.lastArchiveAt && (
                <span className="text-slate-500">At: {new Date(data.auditArchival.lastArchiveAt).toLocaleString()}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Timestamp */}
      {data?.timestamp && (
        <div className="text-[10px] text-slate-600 text-right">
          Last check: {new Date(data.timestamp).toLocaleString()}
        </div>
      )}
    </div>
  );
}
