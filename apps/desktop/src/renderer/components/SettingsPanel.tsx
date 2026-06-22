import { useState, useEffect } from 'react';
import { Server, Key, Monitor, Shield, Sun, Moon, Power, RefreshCw, Send, CheckCircle2, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../stores/app-store.js';

export function SettingsPanel() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [telegramId, setTelegramId] = useState('');
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const setServerUrl = useAppStore((s) => s.setServerUrl);
  const setDeviceName = useAppStore((s) => s.setDeviceName);
  const setTheme = useAppStore((s) => s.setTheme);

  useEffect(() => {
    (window as any).titan?.getSettings().then((s: Record<string, any>) => {
      setSettings(s);
      if (s.serverUrl) setServerUrl(s.serverUrl);
      if (s.deviceName) setDeviceName(s.deviceName);
      if (s.theme) setTheme(s.theme);
      setLoading(false);
    });
    // Check Telegram link status
    (window as any).titan?.getTelegramStatus().then((res: { linked: boolean; telegramId?: string }) => {
      setTelegramLinked(res?.linked ?? false);
      if (res?.telegramId) setTelegramId(res.telegramId);
    });
  }, [setServerUrl, setDeviceName, setTheme]);

  const update = async (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await (window as any).titan?.setSettings({ [key]: value });
    if (key === 'serverUrl') setServerUrl(value);
    if (key === 'deviceName') setDeviceName(value);
    if (key === 'theme') setTheme(value);
  };

  const handleReconnect = async () => {
    toast.loading('Connecting to server...');
    const res = await (window as any).titan?.connectToServer();
    if (res?.success) {
      toast.success('Connected to Titan Server');
    } else {
      toast.error(res?.error || 'Failed to connect');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-primary overflow-y-auto">
      <div className="h-12 border-b border-border flex items-center px-4 glass">
        <span className="font-semibold text-sm">Settings</span>
      </div>

      <div className="max-w-2xl w-full mx-auto p-6 space-y-6">
        {/* Server Connection */}
        <section>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
            <Server size={14} /> Server Connection
          </h3>
          <div className="space-y-3 bg-bg-secondary rounded-xl p-4 border border-border">
            <div>
              <label className="text-xs text-text-muted block mb-1">Server URL</label>
              <input
                type="text"
                value={settings.serverUrl || ''}
                onChange={(e) => update('serverUrl', e.target.value)}
                placeholder="http://localhost:3000"
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Auth Method</label>
              <div className="flex gap-2">
                <button
                  onClick={() => update('authMethod', 'jwt')}
                  className={`px-3 py-1.5 rounded-lg text-xs ${settings.authMethod === 'jwt' ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-muted'}`}
                >
                  JWT (Email + Password)
                </button>
                <button
                  onClick={() => update('authMethod', 'apiKey')}
                  className={`px-3 py-1.5 rounded-lg text-xs ${settings.authMethod === 'apiKey' ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-muted'}`}
                >
                  API Key
                </button>
              </div>
            </div>
            {settings.authMethod === 'jwt' ? (
              <div>
                <label className="text-xs text-text-muted block mb-1">JWT Token (auto-filled on login)</label>
                <input
                  type="password"
                  value={settings.token || ''}
                  onChange={(e) => update('token', e.target.value)}
                  placeholder="Auto-filled after login"
                  className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
              </div>
            ) : (
              <div>
                <label className="text-xs text-text-muted block mb-1">API Key</label>
                <input
                  type="password"
                  value={settings.apiKey || ''}
                  onChange={(e) => update('apiKey', e.target.value)}
                  placeholder="Paste your API key"
                  className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
              </div>
            )}
            <button
              onClick={handleReconnect}
              className="w-full flex items-center justify-center gap-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              <RefreshCw size={14} /> Reconnect to Server
            </button>
          </div>
        </section>

        {/* Device */}
        <section>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
            <Monitor size={14} /> Device
          </h3>
          <div className="space-y-3 bg-bg-secondary rounded-xl p-4 border border-border">
            <div>
              <label className="text-xs text-text-muted block mb-1">Device Name</label>
              <input
                type="text"
                value={settings.deviceName || ''}
                onChange={(e) => update('deviceName', e.target.value)}
                placeholder="My Computer"
                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-2">Capabilities</label>
              <div className="flex flex-wrap gap-2">
                {['shell', 'files', 'screenshot', 'apps'].map((cap) => {
                  const enabled = settings.capabilities?.includes(cap);
                  return (
                    <button
                      key={cap}
                      onClick={() => {
                        const caps = settings.capabilities || [];
                        update('capabilities', enabled ? caps.filter((c: string) => c !== cap) : [...caps, cap]);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs ${enabled ? 'bg-accent/20 text-accent border border-accent' : 'bg-bg-tertiary text-text-muted border border-border'}`}
                    >
                      {cap}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Telegram Link */}
        <section>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
            <Send size={14} /> Telegram Link
          </h3>
          <div className="space-y-3 bg-bg-secondary rounded-xl p-4 border border-border">
            {telegramLinked ? (
              <div className="flex items-center gap-2 text-success text-sm">
                <CheckCircle2 size={16} />
                <span>Linked to Telegram ID: {telegramId}</span>
              </div>
            ) : (
              <p className="text-xs text-text-muted">
                Link your Telegram account to control this device from Telegram chat.
                Enter your Telegram chat ID (numeric).
              </p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                placeholder="e.g. 495185511"
                className="flex-1 bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
              <button
                onClick={async () => {
                  if (!telegramId.trim()) {
                    toast.error('Enter your Telegram chat ID');
                    return;
                  }
                  setTelegramLoading(true);
                  const res = await (window as any).titan?.linkTelegram(telegramId.trim());
                  setTelegramLoading(false);
                  if (res?.success) {
                    setTelegramLinked(true);
                    toast.success('Telegram linked successfully!');
                  } else {
                    toast.error(res?.error || 'Failed to link Telegram');
                  }
                }}
                disabled={telegramLoading}
                className="flex items-center gap-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Link2 size={14} /> {telegramLoading ? 'Linking...' : 'Link'}
              </button>
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
            <Sun size={14} /> Appearance
          </h3>
          <div className="bg-bg-secondary rounded-xl p-4 border border-border">
            <div className="flex gap-2">
              <button
                onClick={() => update('theme', 'dark')}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 ${settings.theme === 'dark' ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-muted'}`}
              >
                <Moon size={16} /> Dark
              </button>
              <button
                onClick={() => update('theme', 'light')}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 ${settings.theme === 'light' ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-muted'}`}
              >
                <Sun size={16} /> Light
              </button>
            </div>
          </div>
        </section>

        {/* System */}
        <section>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
            <Shield size={14} /> System
          </h3>
          <div className="space-y-3 bg-bg-secondary rounded-xl p-4 border border-border">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">Minimize to tray on close</span>
              <input
                type="checkbox"
                checked={settings.minimizeToTray ?? true}
                onChange={(e) => update('minimizeToTray', e.target.checked)}
                className="w-4 h-4 accent-accent"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">Start on system boot</span>
              <input
                type="checkbox"
                checked={settings.autoStart ?? false}
                onChange={(e) => update('autoStart', e.target.checked)}
                className="w-4 h-4 accent-accent"
              />
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
