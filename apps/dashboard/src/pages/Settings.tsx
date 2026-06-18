import { useState } from 'react';
import { Settings as SettingsIcon, Save } from 'lucide-react';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/PageState';

export default function Settings() {
  const { data, loading, error, refetch } = useApi(() => api.getSettings(), []);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await api.updateSettings(data);
      setSaveMsg('Settings saved successfully');
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-500/10">
            <SettingsIcon className="h-5 w-5 text-slate-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Settings</h2>
            <p className="text-sm text-slate-400">System configuration and preferences</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {saveMsg && (
        <div className={`text-sm px-3 py-2 rounded-lg ${
          saveMsg.includes('success')
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'bg-red-500/10 text-red-400'
        }`}>
          {saveMsg}
        </div>
      )}

      {/* Settings display */}
      <div className="card">
        <h3 className="text-sm font-medium text-white mb-4">Current Configuration</h3>
        {data && Object.keys(data).length > 0 ? (
          <div className="space-y-3">
            {Object.entries(data).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between py-2 border-b border-slate-800/50">
                <span className="text-sm text-slate-400">{key}</span>
                <span className="text-sm text-slate-300 font-mono">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No settings configured yet.</p>
        )}
      </div>
    </div>
  );
}
