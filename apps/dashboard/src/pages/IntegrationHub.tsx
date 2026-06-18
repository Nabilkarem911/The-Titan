import { useState, useEffect } from 'react';
import { Plug, CheckCircle, XCircle, Settings } from 'lucide-react';
import { API_BASE, getToken } from '../api/client';

interface Integration { type: string; status: string; available: boolean }

const ICONS: Record<string, string> = { slack: '💬', discord: '🎮', notion: '📝', linear: '📋', jira: '🎫', github: '🐙', google_drive: '📁', s3: '☁️', sentry: '🐛' };

export default function IntegrationHub() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/integrations`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d && (d as Record<string, unknown>).integrations) setIntegrations((d as Record<string, unknown>).integrations as Integration[]); })
      .catch(() => {});
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Plug className="w-6 h-6 text-pink-500" /> Integration Hub</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {integrations.map((int) => (
          <div key={int.type} className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 hover:border-zinc-600 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{ICONS[int.type] ?? '🔌'}</span>
              {int.status === 'connected' ? <CheckCircle className="w-5 h-5 text-green-400" /> : <XCircle className="w-5 h-5 text-zinc-600" />}
            </div>
            <h3 className="font-semibold capitalize">{int.type.replace('_', ' ')}</h3>
            <p className="text-xs text-zinc-500 mt-1">{int.status === 'connected' ? 'Connected' : 'Not configured'}</p>
            <button className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg text-sm hover:bg-zinc-700">
              <Settings className="w-3 h-3" /> {int.status === 'connected' ? 'Configure' : 'Connect'}
            </button>
          </div>
        ))}
      </div>
      {integrations.length === 0 && <div className="bg-zinc-900 rounded-xl p-12 border border-zinc-800 text-center text-zinc-500"><Plug className="w-12 h-12 mx-auto mb-4 opacity-20" /><p>No integrations loaded</p><p className="text-xs mt-1">The API will return available integrations when configured</p></div>}
    </div>
  );
}
