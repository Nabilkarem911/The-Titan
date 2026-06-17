import { useState, useEffect } from 'react';
import { ScrollText, ShieldCheck, Archive, AlertCircle, Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditLog {
  id: string;
  actorId: string | null;
  workspaceId: string | null;
  action: string;
  resource: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface RetentionInfo {
  count: number;
  oldest: string | null;
  newest: string | null;
  archiveCount: number;
}

interface VerifyResult {
  valid: boolean;
  brokenAt: string | null;
  checked: number;
}

import { API_BASE, getToken } from '../api/client';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [retention, setRetention] = useState<RetentionInfo | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      if (actionFilter) params.set('action', actionFilter);
      if (resourceFilter) params.set('resource', resourceFilter);
      const res = await fetch(`${API_BASE}/compliance/audit/logs?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { items: AuditLog[] };
      setLogs(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const fetchRetention = async () => {
    try {
      const res = await fetch(`${API_BASE}/compliance/audit/retention`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as RetentionInfo;
      setRetention(data);
    } catch { /* ignore */ }
  };

  const handleVerify = async () => {
    try {
      const res = await fetch(`${API_BASE}/compliance/audit/verify`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Verify failed');
      const data = await res.json() as VerifyResult;
      setVerifyResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verify failed');
    }
  };

  const handleArchive = async () => {
    if (!confirm('Archive audit logs older than 365 days?')) return;
    try {
      const res = await fetch(`${API_BASE}/compliance/audit/archive`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ daysOld: 365, batchSize: 1000 }),
      });
      if (!res.ok) throw new Error('Archive failed');
      const data = await res.json() as { archived: number };
      alert(`Archived ${data.archived} logs`);
      await fetchRetention();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Archive failed');
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchRetention();
  }, [offset, actionFilter, resourceFilter]);

  const actionColor = (action: string) => {
    if (action.includes('CREATE') || action.includes('INSERT')) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (action.includes('DELETE') || action.includes('REMOVE')) return 'text-red-400 bg-red-500/10 border-red-500/20';
    if (action.includes('UPDATE') || action.includes('PATCH')) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400">
            <ScrollText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Audit Logs</h3>
            <p className="text-xs text-slate-500">Immutable tamper-evident activity trail</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleVerify} className="btn-secondary">
            <ShieldCheck className="h-4 w-4" />
            Verify Chain
          </button>
          <button onClick={handleArchive} className="btn-secondary">
            <Archive className="h-4 w-4" />
            Archive
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {verifyResult && (
        <div className={`card p-3 flex items-center gap-3 ${verifyResult.valid ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
          <ShieldCheck className={`h-5 w-5 ${verifyResult.valid ? 'text-emerald-400' : 'text-red-400'}`} />
          <div>
            <div className="text-sm font-medium text-slate-200">
              {verifyResult.valid ? 'Hash chain verified' : 'Hash chain broken!'}
            </div>
            <div className="text-xs text-slate-500">
              Checked {verifyResult.checked} entries{verifyResult.brokenAt ? ` • Broken at ${verifyResult.brokenAt}` : ''}
            </div>
          </div>
        </div>
      )}

      {/* Retention Stats */}
      {retention && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="card p-3">
            <div className="text-xs text-slate-500">Total Logs</div>
            <div className="text-lg font-semibold text-white">{retention.count.toLocaleString()}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs text-slate-500">Oldest</div>
            <div className="text-sm font-medium text-white">{retention.oldest ? new Date(retention.oldest).toLocaleDateString() : '—'}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs text-slate-500">Newest</div>
            <div className="text-sm font-medium text-white">{retention.newest ? new Date(retention.newest).toLocaleDateString() : '—'}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs text-slate-500">Archived</div>
            <div className="text-lg font-semibold text-white">{retention.archiveCount.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setOffset(0); }}
            placeholder="Filter by action..."
            className="input pl-9"
          />
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={resourceFilter}
            onChange={(e) => { setResourceFilter(e.target.value); setOffset(0); }}
            placeholder="Filter by resource..."
            className="input pl-9"
          />
        </div>
        <button onClick={() => { setOffset(0); fetchLogs(); }} className="btn-secondary px-3">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800/50 bg-slate-900/50">
                <th className="px-4 py-2.5 font-medium">Time</th>
                <th className="px-4 py-2.5 font-medium">Action</th>
                <th className="px-4 py-2.5 font-medium">Resource</th>
                <th className="px-4 py-2.5 font-medium">Actor</th>
                <th className="px-4 py-2.5 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-400" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-xs">No audit logs found</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-800/20 hover:bg-slate-800/20">
                    <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${actionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-300">
                      {log.resource}{log.resourceId ? ` / ${log.resourceId.slice(0, 8)}` : ''}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{log.actorId ? log.actorId.slice(0, 8) : 'System'}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{log.ipAddress ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800/50">
          <button
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
            disabled={offset === 0}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </button>
          <span className="text-xs text-slate-500">Offset {offset}</span>
          <button
            onClick={() => setOffset((o) => o + limit)}
            disabled={logs.length < limit}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
