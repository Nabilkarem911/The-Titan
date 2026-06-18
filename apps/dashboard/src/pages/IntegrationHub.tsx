import { useState, useEffect } from 'react';
import { Link, CheckCircle, XCircle, Settings, Loader2, RefreshCw } from 'lucide-react';
import { API_BASE, getToken } from '../api/client';
import { ErrorState, EmptyState } from '../components/PageState';

interface Integration {
  type: string;
  status: string;
  available: boolean;
}

const ICONS: Record<string, string> = {
  slack: '💬', discord: '🎮', notion: '📝', linear: '📋', jira: '🎫',
  github: '🐙', google_drive: '📁', s3: '☁️', sentry: '🐛',
};

export default function IntegrationHub() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegrations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/integrations`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json() as { integrations?: Integration[] };
      setIntegrations(d.integrations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIntegrations(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-pink-500/20 text-pink-400">
            <Link className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Integration Hub</h3>
            <p className="text-xs text-slate-500">Connect external services to Titan</p>
          </div>
        </div>
        <button onClick={fetchIntegrations} className="btn-secondary" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={fetchIntegrations} />
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-8 w-8 bg-slate-700/50 rounded mb-3" />
              <div className="h-4 w-24 bg-slate-700/50 rounded mb-2" />
              <div className="h-3 w-32 bg-slate-800/50 rounded" />
            </div>
          ))}
        </div>
      ) : integrations.length === 0 ? (
        <EmptyState
          icon={<Link className="h-6 w-6 text-slate-400" />}
          title="No integrations available"
          description="The API will return available integrations when configured"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map((int) => (
            <div key={int.type} className="card hover:border-slate-700 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{ICONS[int.type] ?? '🔌'}</span>
                {int.status === 'connected' ? (
                  <span className="badge-success"><CheckCircle className="h-3 w-3" /> Connected</span>
                ) : (
                  <span className="badge"><XCircle className="h-3 w-3 text-slate-500" /> Not configured</span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-white capitalize">{int.type.replace('_', ' ')}</h3>
              <p className="text-xs text-slate-500 mt-1">{int.status === 'connected' ? 'Service connected and active' : 'Click to set up this integration'}</p>
              <button className="btn-secondary w-full mt-3 text-xs">
                <Settings className="h-3 w-3" />
                {int.status === 'connected' ? 'Configure' : 'Connect'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
