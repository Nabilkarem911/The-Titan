import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, User, Key, Bell, Palette, MessageCircle, Link2, Check, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import { toast } from 'sonner';
import { cn } from '../utils/cn';
import { PageHeader } from '../components/PageHeader';

type Tab = 'profile' | 'keys' | 'notifications' | 'appearance';

export default function Settings() {
  const { userId, logoutAll } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'keys', label: 'Provider Keys', icon: Key },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <PageHeader
        pageKey="settings"
        icon={SettingsIcon}
        title="Settings"
        subtitle="Manage your account and preferences"
        description="Configure your Titan account — update your profile, add provider API keys (OpenAI, Anthropic, Google), manage notifications, and customize the appearance. Provider keys are stored securely and used when Titan needs to call external LLM providers."
        tips={[
          'Add your OpenAI or Anthropic API key in the Provider Keys tab',
          'Notifications can be toggled per event type',
          'Appearance settings control theme and layout preferences',
        ]}
      />

      <div className="flex gap-6">
        {/* Tabs */}
        <div className="w-48 shrink-0 space-y-0.5">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-btn text-sm w-full transition-colors',
                tab === t.id ? 'bg-accent-primary/10 text-accent-primary' : 'text-text-secondary hover:bg-elevated hover:text-text-primary',
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1">
          {tab === 'profile' && <ProfileTab userId={userId} onLogoutAll={logoutAll} />}
          {tab === 'keys' && <ProviderKeysTab />}
          {tab === 'notifications' && <NotificationsTab />}
          {tab === 'appearance' && <AppearanceTab />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ userId, onLogoutAll }: { userId: string | null; onLogoutAll: () => Promise<void> }) {
  const [telegramId, setTelegramId] = useState('');
  const [linkedTelegram, setLinkedTelegram] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ linked: boolean; telegramId: string | null }>('/user-context/telegram-status');
        setLinkedTelegram(res.telegramId);
      } catch {
        /* ignore */
      } finally {
        setLoadingStatus(false);
      }
    })();
  }, []);

  const handleLink = async () => {
    if (!telegramId.trim()) {
      toast.error('Enter your Telegram ID');
      return;
    }
    setLinking(true);
    try {
      const res = await api.post<{ linked: boolean; telegramId: string; memoryMerged: number; historyMerged: number }>('/user-context/link-telegram', { telegramId: telegramId.trim() });
      setLinkedTelegram(res.telegramId);
      setTelegramId('');
      toast.success('Telegram linked!', {
        description: `Merged ${res.memoryMerged} memories and ${res.historyMerged} messages`,
      });
    } catch (err) {
      toast.error('Failed to link Telegram', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-6 space-y-4">
        <h2 className="text-h3 text-text-primary">Profile</h2>
        <div>
          <label className="block text-label text-text-secondary mb-1.5">User ID</label>
          <input value={userId ?? ''} readOnly className="input font-mono opacity-60" />
        </div>
        <button onClick={onLogoutAll} className="btn-secondary text-error hover:text-error">
          Logout from all devices
        </button>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="text-h3 text-text-primary flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-accent-secondary" />
          Telegram Link
        </h2>
        <p className="text-small text-text-secondary">
          Link your Telegram account so Titan remembers you across both platforms. Your memory and chat history from Telegram will be merged into your dashboard account.
        </p>

        {loadingStatus ? (
          <div className="flex items-center gap-2 text-small text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking link status...
          </div>
        ) : linkedTelegram ? (
          <div className="flex items-center gap-2 p-3 rounded-btn bg-success/10">
            <Check className="w-4 h-4 text-success" />
            <span className="text-small text-success font-medium">Linked to Telegram ID: {linkedTelegram}</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-label text-text-secondary mb-1.5">Your Telegram ID</label>
              <input
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                className="input"
                placeholder="e.g. 123456789"
              />
              <p className="text-caption text-text-muted mt-1">
                Send <code className="text-accent-primary">/memory</code> to Titan on Telegram to see your ID, or check @userinfobot
              </p>
            </div>
            <button onClick={handleLink} disabled={linking} className="btn-primary flex items-center gap-2">
              {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Link Telegram
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProviderKeysTab() {
  const [keys, setKeys] = useState<{ provider: string; key: string }[]>([{ provider: 'openai', key: '' }]);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const handleSave = async () => {
    for (const { provider, key } of keys) {
      if (!key) continue;
      try {
        await api.post('/user/keys', { name: `${provider}-key`, provider, value: key });
        toast.success(`${provider} key saved`);
      } catch (err) {
        toast.error(`Failed to save ${provider} key`, { description: err instanceof Error ? err.message : undefined });
      }
    }
    setKeys([{ provider: 'openai', key: '' }]);
  };

  return (
    <div className="card p-6 space-y-4">
      <h2 className="text-h3 text-text-primary">Provider API Keys</h2>
      <p className="text-small text-text-secondary">Add your LLM provider API keys. These are encrypted and stored securely.</p>
      {keys.map((entry, i) => (
        <div key={i} className="flex gap-2">
          <select
            value={entry.provider}
            onChange={(e) => setKeys(prev => prev.map((k, idx) => idx === i ? { ...k, provider: e.target.value } : k))}
            className="input w-40"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google</option>
            <option value="groq">Groq</option>
            <option value="mistral">Mistral</option>
          </select>
          <input
            type={showKeys[i] ? 'text' : 'password'}
            value={entry.key}
            onChange={(e) => setKeys(prev => prev.map((k, idx) => idx === i ? { ...k, key: e.target.value } : k))}
            placeholder="sk-..."
            className="input flex-1 font-mono"
          />
          <button onClick={() => setShowKeys(prev => ({ ...prev, [i]: !prev[i] }))} className="btn-ghost">
            {showKeys[i] ? 'Hide' : 'Show'}
          </button>
        </div>
      ))}
      <button onClick={() => setKeys([...keys, { provider: 'openai', key: '' }])} className="btn-ghost">+ Add another</button>
      <div className="pt-2">
        <button onClick={handleSave} className="btn-primary">Save Keys</button>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const [prefs, setPrefs] = useState({ runCompleted: true, runFailed: true, webhookTriggered: false, weeklyReport: true });
  return (
    <div className="card p-6 space-y-4">
      <h2 className="text-h3 text-text-primary">Notifications</h2>
      {Object.entries(prefs).map(([key, value]) => (
        <label key={key} className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-text-secondary capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
          <button
            onClick={() => setPrefs(prev => ({ ...prev, [key]: !value }))}
            className={cn('w-10 h-6 rounded-full transition-colors relative', value ? 'bg-accent-primary' : 'bg-border-default')}
          >
            <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform', value ? 'translate-x-4' : 'translate-x-0.5')} />
          </button>
        </label>
      ))}
    </div>
  );
}

function AppearanceTab() {
  return (
    <div className="card p-6 space-y-4">
      <h2 className="text-h3 text-text-primary">Appearance</h2>
      <p className="text-small text-text-secondary">Titan uses a dark theme by default. Light theme coming soon.</p>
      <div className="flex gap-3">
        <div className="card-hover p-4 w-32 text-center border-2 border-accent-primary">
          <div className="w-full h-16 rounded-btn bg-void mb-2" />
          <span className="text-small text-text-primary">Dark</span>
        </div>
        <div className="card-hover p-4 w-32 text-center opacity-50">
          <div className="w-full h-16 rounded-btn bg-surface mb-2" />
          <span className="text-small text-text-muted">Light (soon)</span>
        </div>
      </div>
    </div>
  );
}
