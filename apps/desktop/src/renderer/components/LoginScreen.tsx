import { useState, useEffect } from 'react';
import { Server, Mail, Lock, User, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { useAppStore } from '../stores/app-store.js';

export function LoginScreen() {
  const setLoggedIn = useAppStore((s) => s.setLoggedIn);
  const setUser = useAppStore((s) => s.setUser);
  const setServerUrl = useAppStore((s) => s.setServerUrl);
  const setConnected = useAppStore((s) => s.setConnected);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [serverUrl, setUrl] = useState('http://localhost:3000');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if already logged in
    (window as any).titan?.checkAuth().then(async (res: any) => {
      if (res?.loggedIn) {
        // Refresh token once before connecting to ensure it's fresh
        const refreshRes = await (window as any).titan?.refreshToken();
        if (refreshRes?.success) {
          // Token refreshed — now connect with fresh token
          const connectRes = await (window as any).titan?.connectToServer();
          if (connectRes?.success) {
            setLoggedIn(true);
            setServerUrl(res.serverUrl);
            setConnected(true);
          } else {
            // Connection failed — show login
            setUrl(res.serverUrl || 'http://localhost:3000');
          }
        } else {
          // Token expired and refresh failed — need to login again
          setUrl(res.serverUrl || 'http://localhost:3000');
        }
      }
      setChecking(false);
    }).catch(() => {
      setChecking(false);
    });
    // Safety timeout — never stay stuck on loading
    const timeout = setTimeout(() => setChecking(false), 5000);
    return () => clearTimeout(timeout);
  }, [setLoggedIn, setServerUrl, setConnected]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const titan = (window as any).titan;
      let res: any;

      if (mode === 'login') {
        res = await titan.login(serverUrl, email, password);
      } else {
        if (!name.trim()) {
          setError('Name is required');
          setLoading(false);
          return;
        }
        res = await titan.register(serverUrl, email, name, password);
      }

      if (res?.success) {
        setServerUrl(serverUrl);
        setUser(res.user);
        setLoggedIn(true);
        // Auto-connect to server
        await titan.connectToServer();
        setConnected(true);
      } else {
        setError(res?.error || 'Authentication failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
    setLoading(false);
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-primary">
        <Loader2 size={32} className="animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-bg-primary">
      {/* Left — Branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 50%, #3b82f6 0%, transparent 50%), radial-gradient(circle at 80% 20%, #8B5CF6 0%, transparent 50%)',
          }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <span className="text-xl font-bold text-text-primary">Titan Desktop</span>
          </div>
        </div>
        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold text-text-primary leading-tight">
            Command Your<br />
            <span className="bg-gradient-to-r from-accent to-purple-500 bg-clip-text text-transparent">
              AI Agent
            </span>
            <br />From Anywhere
          </h1>
          <p className="text-text-secondary max-w-md">
            Connect your desktop to Titan. Execute commands, manage files, take screenshots —
            all through natural language via Telegram or the Desktop UI.
          </p>
          <div className="flex gap-6 pt-4">
            <div>
              <div className="text-2xl font-bold text-accent">9</div>
              <div className="text-xs text-text-muted">Agent Tools</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-accent">∞</div>
              <div className="text-xs text-text-muted">Devices</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-accent">24/7</div>
              <div className="text-xs text-text-muted">Online</div>
            </div>
          </div>
        </div>
        <div className="relative z-10 text-xs text-text-muted">
          Titan Desktop Agent • Built with Electron
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 justify-center mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <span className="text-xl font-bold text-text-primary">Titan Desktop</span>
          </div>

          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold text-text-primary">
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              {mode === 'login'
                ? 'Sign in to connect your device to Titan'
                : 'Register a new Titan account'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Server URL */}
            <div>
              <label className="text-xs text-text-muted block mb-1.5">Server URL</label>
              <div className="relative">
                <Server size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="http://localhost:3000"
                  className="w-full bg-bg-tertiary border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                  required
                />
              </div>
            </div>

            {/* Name (register only) */}
            {mode === 'register' && (
              <div>
                <label className="text-xs text-text-muted block mb-1.5">Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-bg-tertiary border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                    required
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="text-xs text-text-muted block mb-1.5">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-bg-tertiary border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs text-text-muted block mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  className="w-full bg-bg-tertiary border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                  required
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-medium text-sm rounded-xl py-2.5 flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Switch mode */}
          <div className="text-center text-sm text-text-secondary">
            {mode === 'login' ? (
              <>
                Don't have an account?{' '}
                <button
                  onClick={() => { setMode('register'); setError(null); }}
                  className="text-accent hover:underline font-medium"
                >
                  Register
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => { setMode('login'); setError(null); }}
                  className="text-accent hover:underline font-medium"
                >
                  Sign In
                </button>
              </>
            )}
          </div>

          {/* Help */}
          <div className="text-center text-xs text-text-muted pt-4 border-t border-border">
            <p>Make sure the Titan Server is running at the URL above.</p>
            <p className="mt-1">Start it with: <code className="text-text-secondary">npm run start:core</code></p>
          </div>
        </div>
      </div>
    </div>
  );
}
