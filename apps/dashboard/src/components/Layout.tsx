import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Bot,
  Play,
  FolderOpen,
  ListOrdered,
  Terminal,
  Clock,
  CalendarClock,
  ScrollText,
  Activity,
  BarChart3,
  Webhook,
  Puzzle,
  Key,
  Settings,
  Shield,
  GitBranch,
  Network,
  Building2,
  Brain,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Circle,
  LogOut,
} from 'lucide-react';
import TitanLogo from './TitanLogo';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { classNames } from '../utils/format';

// ── Navigation Config ────────────────────────────────────────────────────────

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Core',
    items: [
      { path: '/', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
      { path: '/chat', label: 'Chat', icon: <MessageSquare className="w-5 h-5" /> },
      { path: '/agents', label: 'Agents', icon: <Bot className="w-5 h-5" /> },
      { path: '/playground', label: 'Playground', icon: <Play className="w-5 h-5" /> },
      { path: '/files', label: 'Files', icon: <FolderOpen className="w-5 h-5" /> },
    ],
  },
  {
    title: 'Operations',
    items: [
      { path: '/runs', label: 'Runs', icon: <ListOrdered className="w-5 h-5" /> },
      { path: '/terminal', label: 'Terminal', icon: <Terminal className="w-5 h-5" /> },
      { path: '/queue', label: 'Queue', icon: <Clock className="w-5 h-5" /> },
      { path: '/cron', label: 'Cron', icon: <CalendarClock className="w-5 h-5" /> },
      { path: '/logs', label: 'Logs', icon: <ScrollText className="w-5 h-5" /> },
    ],
  },
  {
    title: 'Management',
    items: [
      { path: '/health', label: 'Health', icon: <Activity className="w-5 h-5" /> },
      { path: '/metrics', label: 'Metrics', icon: <BarChart3 className="w-5 h-5" /> },
      { path: '/webhooks', label: 'Webhooks', icon: <Webhook className="w-5 h-5" /> },
      { path: '/plugins', label: 'Plugins', icon: <Puzzle className="w-5 h-5" /> },
      { path: '/api-keys', label: 'API Keys', icon: <Key className="w-5 h-5" /> },
    ],
  },
  {
    title: 'Advanced',
    items: [
      { path: '/settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
      { path: '/audit-logs', label: 'Audit Logs', icon: <Shield className="w-5 h-5" /> },
      { path: '/git', label: 'Git', icon: <GitBranch className="w-5 h-5" /> },
      { path: '/swarm', label: 'Swarm', icon: <Network className="w-5 h-5" /> },
      { path: '/workspaces', label: 'Workspaces', icon: <Building2 className="w-5 h-5" /> },
      { path: '/memory', label: 'Memory', icon: <Brain className="w-5 h-5" /> },
    ],
  },
];

// ── Global Search Modal ──────────────────────────────────────────────────────

interface SearchResult {
  path: string;
  label: string;
  section: string;
  icon: React.ReactNode;
}

function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const allItems: SearchResult[] = navSections.flatMap((section) =>
    section.items.map((item) => ({
      ...item,
      section: section.title,
    }))
  );

  const filtered = query.trim()
    ? allItems.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.path.toLowerCase().includes(query.toLowerCase())
      )
    : allItems;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = useCallback(
    (path: string) => {
      navigate(path);
      onClose();
    },
    [navigate, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault();
        handleSelect(filtered[selectedIndex].path);
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [filtered, selectedIndex, handleSelect, onClose]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg mx-4 card border-border-light overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Search className="w-5 h-5 text-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages..."
            className="flex-1 bg-transparent text-text-primary text-sm outline-none placeholder:text-text-muted"
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-mono text-text-muted bg-deep border border-border rounded">
            ESC
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-text-muted text-sm">
              No results found
            </div>
          ) : (
            filtered.map((item, index) => (
              <button
                key={item.path}
                onClick={() => handleSelect(item.path)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={classNames(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                  index === selectedIndex
                    ? 'bg-[rgba(0,242,254,0.08)] text-cyan'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                <span className="shrink-0 opacity-70">{item.icon}</span>
                <span className="flex-1 text-start">{item.label}</span>
                <span className="text-xs text-text-muted">{item.section}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Notification Panel ───────────────────────────────────────────────────────

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { notifications, markAsRead, markAllAsRead, clearNotifications } = useNotifications();

  const typeColors: Record<string, string> = {
    info: 'text-cyan',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-pink',
  };

  return (
    <div className="absolute top-full end-0 mt-2 w-80 card border-border-light overflow-hidden z-50 shadow-lg">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <span className="font-heading font-semibold text-sm text-text-primary">Notifications</span>
        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <>
              <button onClick={markAllAsRead} className="text-xs text-text-muted hover:text-cyan transition-colors">
                Mark all read
              </button>
              <button onClick={clearNotifications} className="text-xs text-text-muted hover:text-pink transition-colors">
                Clear
              </button>
            </>
          )}
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-text-muted text-sm">
            No notifications
          </div>
        ) : (
          notifications.slice(0, 20).map((notif) => (
            <button
              key={notif.id}
              onClick={() => markAsRead(notif.id)}
              className={classNames(
                'w-full text-start px-3 py-2.5 border-b border-border hover:bg-card-hover transition-colors',
                !notif.read && 'bg-[rgba(0,242,254,0.03)]'
              )}
            >
              <div className="flex items-start gap-2">
                {!notif.read && (
                  <Circle className="w-2 h-2 mt-1.5 fill-cyan text-cyan shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className={classNames('text-xs font-medium', typeColors[notif.type] || 'text-text-secondary')}>
                    {notif.title}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5 truncate">{notif.message}</p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Layout Component ─────────────────────────────────────────────────────────

export default function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const location = useLocation();
  const { logout } = useAuth();
  const { unreadCount } = useNotifications();

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Get page title from current path
  const pageTitle = (() => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    for (const section of navSections) {
      const item = section.items.find((i) => i.path === path);
      if (item) return item.label;
    }
    return 'Titan';
  })();

  const sidebarWidth = sidebarCollapsed ? 'w-[72px]' : 'w-[260px]';

  return (
    <div className="flex h-screen overflow-hidden bg-deep">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={classNames(
          'fixed lg:relative inset-y-0 start-0 z-40 flex flex-col glass-deep border-e border-border transition-all duration-300',
          sidebarWidth,
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
          <TitanLogo size={32} />
          {!sidebarCollapsed && (
            <span className="font-heading text-lg font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan to-violet">
              TITAN
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
          {navSections.map((section) => (
            <div key={section.title}>
              {!sidebarCollapsed && (
                <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                  {section.title}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) =>
                      classNames(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group relative',
                        isActive
                          ? 'text-cyan bg-[rgba(0,242,254,0.05)]'
                          : 'text-text-secondary hover:text-text-primary hover:bg-card-hover'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <div className="absolute inset-y-1 start-0 w-[3px] bg-cyan rounded-full" />
                        )}
                        <span className={classNames(
                          'shrink-0 transition-colors',
                          isActive ? 'text-cyan' : 'text-text-muted group-hover:text-text-secondary'
                        )}>
                          {item.icon}
                        </span>
                        {!sidebarCollapsed && <span>{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-border px-2 py-3 space-y-1 shrink-0">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-text-muted hover:text-pink hover:bg-[rgba(255,0,122,0.05)] transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-text-muted hover:text-text-secondary hover:bg-card-hover transition-colors"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5 shrink-0" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5 shrink-0" />
                <span>Collapse</span>
              </>
            )}
          </button>

          {!sidebarCollapsed && (
            <div className="px-3 pt-1 text-[10px] text-text-muted">
              Titan v1.0
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 glass border-b border-border flex items-center justify-between px-4 lg:px-6 shrink-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden btn btn-ghost p-2"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-heading text-lg font-semibold text-text-primary">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Search button */}
            <button
              onClick={() => setSearchOpen(true)}
              className="btn btn-ghost p-2 gap-2"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline text-xs text-text-muted">Search</span>
              <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-text-muted bg-deep border border-border rounded">
                Ctrl+K
              </kbd>
            </button>

            {/* Notification bell */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="btn btn-ghost p-2 relative"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 end-1 w-4 h-4 flex items-center justify-center text-[9px] font-bold bg-pink text-white rounded-full">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
            </div>

            {/* Status indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)]">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs text-success font-medium">Online</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      {/* Global search modal */}
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
