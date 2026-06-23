import { useState, useEffect, useCallback } from 'react';
import { Scroll, Loader2, RefreshCw, Scale, AlertTriangle } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';

interface NormativeStats {
  total: number;
  active: number;
  fulfilled: number;
  violated: number;
  revised: number;
  conflicts: number;
  revisions: number;
}

export default function Constitution() {
  const [stats, setStats] = useState<NormativeStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<NormativeStats>('/normative/stats').catch(() => null);
      setStats(res);
    } catch {
      toast.error('Failed to load constitution data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-text-primary flex items-center gap-2">
            <Scroll className="w-6 h-6 text-accent-primary" />
            Constitution
          </h1>
          <p className="text-small text-text-secondary mt-1">Normative agency, ethical commitments, and conflict detection</p>
        </div>
        <button onClick={load} className="btn-ghost flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2"><Scale className="w-4 h-4 text-accent-primary" /><span className="text-small text-text-secondary">Total Commitments</span></div>
            <p className="text-h2 font-bold text-text-primary">{stats.total}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2"><Scale className="w-4 h-4 text-success" /><span className="text-small text-text-secondary">Active</span></div>
            <p className="text-h2 font-bold text-text-primary">{stats.active}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2"><Scale className="w-4 h-4 text-accent-secondary" /><span className="text-small text-text-secondary">Fulfilled</span></div>
            <p className="text-h2 font-bold text-text-primary">{stats.fulfilled}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-error" /><span className="text-small text-text-secondary">Violated</span></div>
            <p className="text-h2 font-bold text-text-primary">{stats.violated}</p>
          </div>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-5">
            <h2 className="text-h3 text-text-primary mb-3">Conflicts & Revisions</h2>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-small text-text-secondary">Conflicts Detected</span><span className="text-sm font-medium text-warning">{stats.conflicts}</span></div>
              <div className="flex justify-between"><span className="text-small text-text-secondary">Revisions Made</span><span className="text-sm font-medium text-text-primary">{stats.revisions}</span></div>
              <div className="flex justify-between"><span className="text-small text-text-secondary">Total Revised</span><span className="text-sm font-medium text-text-primary">{stats.revised}</span></div>
            </div>
          </div>
          <div className="card p-5">
            <h2 className="text-h3 text-text-primary mb-3">Compliance Rate</h2>
            <div className="p-4 rounded-btn bg-elevated">
              <p className="text-h2 font-bold text-text-primary">
                {stats.total > 0 ? ((stats.fulfilled / stats.total) * 100).toFixed(0) : 100}%
              </p>
              <p className="text-small text-text-secondary mt-1">of commitments fulfilled</p>
            </div>
          </div>
        </div>
      )}

      {!stats && (
        <div className="card p-5">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Scroll className="w-8 h-8 text-text-muted mb-2" />
            <p className="text-small text-text-secondary">No constitution data available</p>
          </div>
        </div>
      )}
    </div>
  );
}
