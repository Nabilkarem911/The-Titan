import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, User, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../utils/cn';

export function TopBar() {
  const { userId, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const openCommandPalette = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true }));
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
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
        <button className="btn-icon relative" title="Notifications">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent-primary" />
        </button>

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
