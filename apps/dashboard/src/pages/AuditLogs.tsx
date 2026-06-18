import { useState } from 'react';
import { Shield, RefreshCw, CheckCircle } from 'lucide-react';
import { api } from '../api/client';
import type { AuditLog } from '../api/client';
import { useApi } from '../hooks/useApi';
import { SkeletonTable } from '../components/LoadingSkeleton';
import { ErrorState, EmptyState } from '../components/PageState';

export default function AuditLogs() {
  const { data, loading, error, refetch } = useApi(() => api.getAuditLogs(), []);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; checked: number } | null>(null);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const result = await api.verifyAuditChain();
      setVerifyResult(result);
    } catch (err) {
      console.error('Verify failed:', err);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-violet-500/10">
            <Shield className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Audit Logs</h2>
            <p className="text-sm text-slate-400">Compliance audit trail with chain verification</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleVerify} disabled={verifying} className="btn-secondary text-xs">
            <CheckCircle className="h-3.5 w-3.5" />
            {verifying ? 'Verifying...' : 'Verify Chain'}
          </button>
          <button onClick={refetch} className="btn-secondary text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Verify result */}
      {verifyResult && (
        <div className={`text-sm px-3 py-2 rounded-lg ${
          verifyResult.valid
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {verifyResult.valid
            ? `Chain verified: ${verifyResult.checked} entries intact`
            : `Chain broken: verified ${verifyResult.checked} entries`}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <SkeletonTable rows={10} cols={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : !data?.items?.length ? (
        <EmptyState
          icon={<Shield className="h-6 w-6 text-slate-400" />}
          title="No audit logs"
          description="Audit entries will appear as actions are performed."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Time</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Action</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Actor</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Target</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Hash</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((log: AuditLog) => (
                <tr key={log.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{log.action}</td>
                  <td className="px-4 py-3 text-slate-400">{log.actor}</td>
                  <td className="px-4 py-3 text-slate-400">{log.target ?? '--'}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{log.hash.slice(0, 12)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
