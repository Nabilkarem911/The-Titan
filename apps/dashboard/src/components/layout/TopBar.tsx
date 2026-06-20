import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, User, ChevronDown, CheckCircle2, AlertCircle, Info, Sun, Moon } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../utils/cn';
import { formatRelativeTime } from '../../utils/format';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
  createdAt: string;
  read?: boolean;
}

export function TopBar() {
  const { userId, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('titan:theme');
    if (saved) return saved === 'dark';
    return true; // default dark
  });
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const { data: runsData } = useApi<{ items: Array<{ id: string; status: string; prompt: string; createdAt: string }> }>('/agents/default/runs?limit=5');

  const notifications: Notification[] = (runsData?.items ?? []).map(r => ({
    id: r.id,
    type: r.status === 'completed' ? 'success' : r.status === 'failed' || r.status === 'error' ? 'error' : 'info',
    title: r.status === 'running' ? `Run in progress` : `Run ${r.status}`,
    message: r.prompt.slice(0, 80),
    createdAt: r.createdAt,
    read: r.status === 'running',
  }));
  const unreadCount = notifications.filter(n => !n.read).length;

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem('titan:theme', next ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', next);
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const openCommandPalette = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true }));
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="h-14 bg-surface border-b border-border-subtle flex items-center justify-between px-6 shrink-0">
      {/* Search */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <button
          onClick={openCommandPalette}
          className="relative w-full flex items-center gap-2 px-3 h-9 rounded-btn bg-elevated border border-border-subtle text-text-muted hover:border-border-default transition-colors"
        >
          <Search className="w-4 h-4 shrink-0" />
          <span className="text-sm">Search pages...</span>
          <kbd className="ml-auto text-caption bg-surface px-1.5 py-0.5 rounded border border-border-subtle">⌘K</kbd>
        </button>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button onClick={toggleTheme} className="btn-icon" title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="btn-icon relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-accent-primary text-void text-[10px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-1 w-80 card shadow-lg py-1 animate-scale-in origin-top-right z-50 max-h-96 overflow-y-auto">
              <div className="px-3 py-2 border-b border-border-subtle flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">Notifications</span>
                <span className="text-caption text-text-muted">{notifications.length} recent</span>
              </div>
              {notifications.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <p className="text-small text-text-secondary">No notifications</p>
                </div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    className={cn(
                      'px-3 py-2.5 border-b border-border-subtle last:border-0 hover:bg-elevated/30 transition-colors cursor-pointer',
                      !n.read && 'bg-accent-primary/5',
                    )}
                    onClick={() => { setNotifOpen(false); navigate('/runs'); }}
                  >
                    <div className="flex items-start gap-2">
                      {n.type === 'success' && <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />}
                      {n.type === 'error' && <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />}
                      {n.type === 'info' && <Info className="w-4 h-4 text-accent-primary shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary font-medium">{n.title}</p>
                        {n.message && <p className="text-caption text-text-secondary mt-0.5 truncate">{n.message}</p>}
                        <p className="text-caption text-text-muted mt-0.5">{formatRelativeTime(n.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-btn hover:bg-elevated transition-colors duration-150"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-brand flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-void" />
            </div>
            <span className="text-sm text-text-secondary max-w-[120px] truncate">
              {userId?.slice(0, 8) ?? 'User'}
            </span>
            <ChevronDown className={cn('w-4 h-4 text-text-muted transition-transform', menuOpen && 'rotate-180')} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 card shadow-lg py-1 animate-scale-in origin-top-right z-50">
              <button
                onClick={() => { setMenuOpen(false); navigate('/settings'); }}
                className="w-full px-3 py-2 text-left text-sm text-text-secondary hover:bg-elevated hover:text-text-primary transition-colors"
              >
                Settings
              </button>
              <div className="h-px bg-border-subtle my-1" />
              <button
                onClick={handleLogout}
                className="w-full px-3 py-2 text-left text-sm text-error hover:bg-elevated transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
