import { useState, useEffect } from 'react';
import { User, Save, Key, Globe, Moon, Bell } from 'lucide-react';
import { API_BASE, getToken } from '../api/client';

export default function UserProfile() {
  const [prefs, setPrefs] = useState({ theme: 'dark', language: 'auto', notificationEmail: true, notificationPush: true, defaultModel: '', timezone: 'UTC' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/user/preferences`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.ok ? r.json() : null).then((d) => { if (d) setPrefs(d as typeof prefs); }).catch(() => {});
  }, []);

  const savePrefs = async () => {
    try {
      await fetch(`${API_BASE}/user/preferences`, { method: 'PATCH', headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(prefs) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold flex items-center gap-2"><User className="w-6 h-6 text-blue-500" /> Profile & Preferences</h1>
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 divide-y divide-zinc-800">
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-2"><Moon className="w-4 h-4 text-zinc-400" /> Theme</div>
          <select value={prefs.theme} onChange={(e) => setPrefs({ ...prefs, theme: e.target.value })} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm">
            <option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option>
          </select>
        </div>
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-zinc-400" /> Language</div>
          <select value={prefs.language} onChange={(e) => setPrefs({ ...prefs, language: e.target.value })} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm">
            <option value="auto">Auto Detect</option><option value="en">English</option><option value="ar-eg">العربية (مصري)</option><option value="ar-gulf">العربية (خليجي)</option><option value="fr">Français</option>
          </select>
        </div>
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-2"><Key className="w-4 h-4 text-zinc-400" /> Default Model</div>
          <select value={prefs.defaultModel} onChange={(e) => setPrefs({ ...prefs, defaultModel: e.target.value })} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm">
            <option value="">Auto</option><option value="gpt-4o">GPT-4o</option><option value="gpt-4o-mini">GPT-4o Mini</option><option value="claude-sonnet-4-6">Claude Sonnet</option><option value="claude-haiku-4-5">Claude Haiku</option>
          </select>
        </div>
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-2"><Bell className="w-4 h-4 text-zinc-400" /> Email Notifications</div>
          <button onClick={() => setPrefs({ ...prefs, notificationEmail: !prefs.notificationEmail })} className={`w-12 h-6 rounded-full transition-colors ${prefs.notificationEmail ? 'bg-blue-600' : 'bg-zinc-700'}`}>
            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${prefs.notificationEmail ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>
      <button onClick={savePrefs} className={`flex items-center gap-2 px-6 py-2 rounded-lg ${saved ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
        <Save className="w-4 h-4" /> {saved ? 'Saved!' : 'Save Preferences'}
      </button>
    </div>
  );
}
