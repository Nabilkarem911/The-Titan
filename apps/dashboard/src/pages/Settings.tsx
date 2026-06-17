import { useState, useEffect } from 'react';
import {
  Key,
  Save,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Shield,
  User,
  Palette,
} from 'lucide-react';

interface UserKey {
  id: string;
  name: string;
  provider: string;
  maskedValue: string;
  createdAt: string;
}

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

import { API_BASE, getToken } from '../api/client';

const KEY_PROVIDERS = [
  { value: 'github', label: 'GitHub Token', placeholder: 'ghp_...' },
  { value: 'openai', label: 'OpenAI API Key', placeholder: 'sk-...' },
  { value: 'anthropic', label: 'Anthropic API Key', placeholder: 'sk-ant-...' },
  { value: 'brave', label: 'Brave Search API Key', placeholder: 'BSA...' },
  { value: 'openweather', label: 'OpenWeather API Key', placeholder: '' },
  { value: 'custom', label: 'Custom', placeholder: '' },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'profile' | 'keys' | 'preferences'>('profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [keys, setKeys] = useState<UserKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile form
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Add key form
  const [showAddKey, setShowAddKey] = useState(false);
  const [keyProvider, setKeyProvider] = useState('github');
  const [keyName, setKeyName] = useState('');
  const [keyValue, setKeyValue] = useState('');
  const [showKeyValue, setShowKeyValue] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchKeys();
  }, []);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json() as UserProfile;
        setProfile(data);
        setName(data.name);
      }
    } catch { /* ignore */ }
  };

  const fetchKeys = async () => {
    try {
      const res = await fetch(`${API_BASE}/user/keys`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json() as { items: UserKey[] };
        setKeys(data.items ?? []);
      }
    } catch { /* ignore */ }
  };

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      const body: Record<string, string> = {};
      if (name && name !== profile?.name) body.name = name;
      if (newPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }
      if (Object.keys(body).length === 0) {
        showMessage('error', 'No changes to save');
        return;
      }
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to update profile');
      showMessage('success', 'Profile updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      await fetchProfile();
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAddKey = async () => {
    if (!keyName.trim() || !keyValue.trim()) {
      showMessage('error', 'Name and value are required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/user/keys`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: keyName, provider: keyProvider, value: keyValue }),
      });
      if (!res.ok) throw new Error('Failed to save key');
      showMessage('success', 'Key saved successfully');
      setKeyName('');
      setKeyValue('');
      setShowAddKey(false);
      await fetchKeys();
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Failed to save key');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Delete this key? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API_BASE}/user/keys/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to delete key');
      showMessage('success', 'Key deleted');
      await fetchKeys();
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: <User className="h-4 w-4" /> },
    { id: 'keys' as const, label: 'API Keys & Tokens', icon: <Key className="h-4 w-4" /> },
    { id: 'preferences' as const, label: 'Preferences', icon: <Palette className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg text-sm border ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-900/50 border border-slate-800/50 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-indigo-500/15 text-indigo-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="card space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800/50">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Profile Settings</h3>
              <p className="text-xs text-slate-500">Manage your account information</p>
            </div>
          </div>

          <div className="grid gap-4 max-w-md">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                value={profile?.email ?? ''}
                disabled
                className="input opacity-60 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-400" />
                <span className="text-sm text-slate-200 capitalize">{profile?.role ?? 'member'}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/50">
              <h4 className="text-sm font-medium text-white mb-3">Change Password</h4>
              <div className="grid gap-3">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  className="input"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  className="input"
                />
              </div>
            </div>

            <button onClick={handleUpdateProfile} disabled={loading} className="btn-primary w-fit mt-2">
              <Save className="h-4 w-4" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Keys Tab */}
      {activeTab === 'keys' && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/50 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/20 text-amber-400">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">API Keys & Tokens</h3>
                  <p className="text-xs text-slate-500">Store your API keys securely. The agent uses them when needed.</p>
                </div>
              </div>
              <button onClick={() => setShowAddKey(true)} className="btn-primary">
                <Plus className="h-4 w-4" />
                Add Key
              </button>
            </div>

            {/* Add Key Form */}
            {showAddKey && (
              <div className="mb-6 p-4 rounded-lg bg-slate-800/30 border border-slate-700/50 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Provider</label>
                    <select
                      value={keyProvider}
                      onChange={(e) => setKeyProvider(e.target.value)}
                      className="input"
                    >
                      {KEY_PROVIDERS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Name</label>
                    <input
                      type="text"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      placeholder="My GitHub Token"
                      className="input"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Value</label>
                  <div className="relative">
                    <input
                      type={showKeyValue ? 'text' : 'password'}
                      value={keyValue}
                      onChange={(e) => setKeyValue(e.target.value)}
                      placeholder={KEY_PROVIDERS.find((p) => p.value === keyProvider)?.placeholder ?? ''}
                      className="input pr-10"
                    />
                    <button
                      onClick={() => setShowKeyValue(!showKeyValue)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                    >
                      {showKeyValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddKey} disabled={loading} className="btn-primary">
                    <Save className="h-4 w-4" />
                    {loading ? 'Saving...' : 'Save Key'}
                  </button>
                  <button onClick={() => { setShowAddKey(false); setKeyValue(''); }} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Keys List */}
            {keys.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Key className="h-10 w-10 mx-auto mb-3 text-slate-600" />
                <p className="text-sm">No keys stored yet</p>
                <p className="text-xs text-slate-600 mt-1">Add your API keys so agents can use them</p>
              </div>
            ) : (
              <div className="space-y-2">
                {keys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-800/20 border border-slate-800/30 hover:border-slate-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-700/50">
                        <Key className="h-3.5 w-3.5 text-slate-300" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-200">{key.name}</div>
                        <div className="text-xs text-slate-500">{key.provider} &middot; {key.maskedValue}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteKey(key.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preferences Tab */}
      {activeTab === 'preferences' && (
        <div className="card space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800/50">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-500/20 text-purple-400">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Preferences</h3>
              <p className="text-xs text-slate-500">Customize your experience</p>
            </div>
          </div>

          <div className="grid gap-4 max-w-md">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/20">
              <div>
                <div className="text-sm font-medium text-slate-200">Default Max Steps</div>
                <div className="text-xs text-slate-500">Steps per agent run</div>
              </div>
              <input type="number" defaultValue={10} min={1} max={50} className="input w-20 text-center" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/20">
              <div>
                <div className="text-sm font-medium text-slate-200">Default Model</div>
                <div className="text-xs text-slate-500">LLM model for new runs</div>
              </div>
              <select className="input w-40" defaultValue="auto">
                <option value="auto">Auto</option>
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
              </select>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/20">
              <div>
                <div className="text-sm font-medium text-slate-200">Auto-refresh Runs</div>
                <div className="text-xs text-slate-500">Live updates while running</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
              </label>
            </div>
          </div>

          <button className="btn-primary w-fit">
            <Save className="h-4 w-4" />
            Save Preferences
          </button>
        </div>
      )}
    </div>
  );
}
