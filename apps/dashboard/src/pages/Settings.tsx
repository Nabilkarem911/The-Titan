import { useState } from 'react';
import { Save } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { ErrorState } from '../components/PageState';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { classNames } from '../utils/format';
import type { Settings as SettingsType } from '../api/client';

export default function SettingsPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState<SettingsType | null>(null);
  const { data: settings, error, isLoading, refetch } = useApi<SettingsType>(() => api.getSettings(), []);
  const current = localSettings || settings;

  const handleSave = async () => {
    if (!current) return;
    setIsSaving(true);
    try { await api.updateSettings(current); refetch(); } finally { setIsSaving(false); }
  };

  const update = (path: string, value: unknown) => {
    if (!current) return;
    const next = JSON.parse(JSON.stringify(current));
    const parts = path.split('.');
    let obj: Record<string, unknown> = next;
    for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]] as Record<string, unknown>;
    obj[parts[parts.length - 1]] = value;
    setLocalSettings(next);
  };

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (isLoading) return <PageSkeleton />;
  if (!current) return <ErrorState message="No settings data" onRetry={refetch} />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-text-secondary text-sm">Platform configuration</p>
        <button onClick={handleSave} disabled={isSaving} className="btn btn-primary"><Save className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save Changes'}</button>
      </div>
      <div className="card p-6">
        <h3 className="font-heading font-semibold text-text-primary mb-4">General</h3>
        <div className="space-y-4">
          <div><label className="block text-sm text-text-secondary mb-1.5">Site Name</label><input value={current.general.site_name} onChange={(e) => update('general.site_name', e.target.value)} className="input" /></div>
          <div><label className="block text-sm text-text-secondary mb-1.5">Default Model</label><input value={current.general.default_model} onChange={(e) => update('general.default_model', e.target.value)} className="input" /></div>
          <div><label className="block text-sm text-text-secondary mb-1.5">Max Concurrent Runs</label><input type="number" value={current.general.max_concurrent_runs} onChange={(e) => update('general.max_concurrent_runs', parseInt(e.target.value))} className="input w-32" /></div>
          <div className="flex items-center gap-3"><input type="checkbox" checked={current.general.allow_registration} onChange={(e) => update('general.allow_registration', e.target.checked)} className="w-4 h-4 rounded" id="allow_reg" /><label htmlFor="allow_reg" className="text-sm text-text-secondary">Allow Registration</label></div>
        </div>
      </div>
      <div className="card p-6">
        <h3 className="font-heading font-semibold text-text-primary mb-4">Security</h3>
        <div className="space-y-4">
          <div><label className="block text-sm text-text-secondary mb-1.5">Session Timeout (seconds)</label><input type="number" value={current.security.session_timeout} onChange={(e) => update('security.session_timeout', parseInt(e.target.value))} className="input w-40" /></div>
          <div><label className="block text-sm text-text-secondary mb-1.5">Max Login Attempts</label><input type="number" value={current.security.max_login_attempts} onChange={(e) => update('security.max_login_attempts', parseInt(e.target.value))} className="input w-32" /></div>
          <div className="flex items-center gap-3"><input type="checkbox" checked={current.security.require_2fa} onChange={(e) => update('security.require_2fa', e.target.checked)} className="w-4 h-4 rounded" id="require_2fa" /><label htmlFor="require_2fa" className="text-sm text-text-secondary">Require 2FA</label></div>
          <div><label className="block text-sm text-text-secondary mb-1.5">Allowed Origins (comma-separated)</label><input value={current.security.allowed_origins.join(', ')} onChange={(e) => update('security.allowed_origins', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} className="input" /></div>
        </div>
      </div>
      <div className="card p-6">
        <h3 className="font-heading font-semibold text-text-primary mb-4">Model Providers</h3>
        <div className="space-y-3">
          {current.models.providers.map((provider) => (
            <div key={provider.name} className="flex items-center justify-between p-3 bg-deep rounded-lg border border-border">
              <div><span className="text-sm font-medium text-text-primary">{provider.name}</span><span className="text-xs text-text-muted ms-2">{provider.models.length} models</span></div>
              <div className="flex items-center gap-3">
                <span className={classNames('badge', provider.api_key_set ? 'badge-success' : 'badge-warning')}>{provider.api_key_set ? 'Key Set' : 'No Key'}</span>
                <span className={classNames('badge', provider.enabled ? 'badge-success' : 'badge-neutral')}>{provider.enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
