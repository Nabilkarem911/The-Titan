import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { TitanLogo } from '../components/TitanLogo';
import { ApiClientError } from '../api/client';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, name, password);
      }
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-void">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 bg-gradient-surface relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, #06B6D4 0%, transparent 50%), radial-gradient(circle at 80% 20%, #8B5CF6 0%, transparent 50%)',
        }} />
        <div className="relative z-10">
          <TitanLogo size={40} />
        </div>
        <div className="relative z-10 space-y-6">
          <h1 className="text-display text-text-primary leading-tight">
            Command Your<br />
            <span className="bg-gradient-brand bg-clip-text text-transparent">AI Swarm</span>
          </h1>
          <p className="text-body text-text-secondary max-w-md">
            Mission control for autonomous agents. Run, monitor, and orchestrate your AI workforce from a single command center.
          </p>
          <div className="flex gap-8 pt-4">
            <div>
              <p className="text-h2 font-bold text-accent-primary">60+</p>
              <p className="text-small text-text-muted">API Endpoints</p>
            </div>
            <div>
              <p className="text-h2 font-bold text-accent-secondary">30+</p>
              <p className="text-small text-text-muted">Data Tables</p>
            </div>
            <div>
              <p className="text-h2 font-bold text-accent-tertiary">∞</p>
              <p className="text-small text-text-muted">Possibilities</p>
            </div>
          </div>
        </div>
        <p className="relative z-10 text-caption text-text-muted">
          © 2024 Titan. All rights reserved.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8">
            <TitanLogo size={32} />
          </div>

          <h2 className="text-h1 text-text-primary mb-2">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="text-small text-text-secondary mb-8">
            {mode === 'login'
              ? 'Enter your credentials to access mission control'
              : 'Sign up to start commanding your AI swarm'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-label text-text-secondary mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder="John Doe"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-label text-text-secondary mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-label text-text-secondary mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>

            {error && (
              <div className="px-3 py-2 rounded-badge bg-error/10 text-error text-small">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full !py-2.5"
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-void border-t-transparent rounded-full animate-spin" />
              ) : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-small text-text-secondary mt-6">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
              className="text-accent-primary hover:underline font-medium"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
