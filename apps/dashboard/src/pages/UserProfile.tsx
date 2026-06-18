import { useState, useEffect } from 'react';
import { User, Save, Key, Globe, Moon, Bell, Loader2 } from 'lucide-react';
import { API_BASE, getToken } from '../api/client';
import { ErrorState } from '../components/PageState';

interface Preferences {
  theme: string;
  language: string;
  notificationEmail: boolean;
  notificationPush: boolean;
  defaultModel: string;
  timezone: string;
}

export default function UserProfile() {
  const [prefs, setPrefs] = useState<Preferences>({
    theme: 'dark', language: 'auto', notificationEmail: true, notificationPush: true, defaultModel: '', timezone: 'UTC',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchPrefs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/user/preferences`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPrefs(await res.json() as Preferences);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPrefs(); }, []);

  const savePrefs = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/user/preferences`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMessage({ type: 'success', text: 'Preferences saved' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={fetchPrefs} />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/20 text-blue-400">
          <User className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Profile & Preferences</h3>
          <p className="text-xs text-slate-500">Customize your Titan experience</p>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="card animate-pulse space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-slate-800/50 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="card divide-y divide-slate-800/50">
          <PrefRow icon={<Moon className="h-4 w-4 text-slate-400" />} label="Theme">
            <select value={prefs.theme} onChange={(e) => setPrefs({ ...prefs, theme: e.target.value })} className="input w-32">
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </PrefRow>

          <PrefRow icon={<Globe className="h-4 w-4 text-slate-400" />} label="Language">
            <select value={prefs.language} onChange={(e) => setPrefs({ ...prefs, language: e.target.value })} className="input w-40">
              <option value="auto">Auto Detect</option>
              <option value="en">English</option>
              <option value="ar-eg">العربية (مصري)</option>
              <option value="ar-gulf">العربية (خليجي)</option>
              <option value="fr">Français</option>
            </select>
          </PrefRow>

          <PrefRow icon={<Key className="h-4 w-4 text-slate-400" />} label="Default Model">
            <select value={prefs.defaultModel} onChange={(e) => setPrefs({ ...prefs, defaultModel: e.target.value })} className="input w-40">
              <option value="">Auto</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="claude-sonnet-4-6">Claude Sonnet</option>
              <option value="claude-haiku-4-5">Claude Haiku</option>
            </select>
          </PrefRow>

          <PrefRow icon={<Bell className="h-4 w-4 text-slate-400" />} label="Email Notifications">
            <button
              onClick={() => setPrefs({ ...prefs, notificationEmail: !prefs.notificationEmail })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${prefs.notificationEmail ? 'bg-indigo-600' : 'bg-slate-700'}`}
              role="switch"
              aria-checked={prefs.notificationEmail}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${prefs.notificationEmail ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </PrefRow>
        </div>
      )}

      <button onClick={savePrefs} disabled={saving || loading} className="btn-primary">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? 'Saving...' : 'Save Preferences'}
      </button>
    </div>
  );
}

function PrefRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
      <div className="flex items-center gap-2 text-sm text-slate-300">{icon}{label}</div>
      {children}
    </div>
  );
}
