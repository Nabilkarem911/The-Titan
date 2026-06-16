import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  MessageSquare,
  Users,
  Terminal,
  History,
  Gauge,
  BarChart3,
  LogOut,
  FolderOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Zap,
  Code,
  Monitor,
  GitBranch,
  Clock,
  LayoutDashboard,
  ScrollText,
  Webhook,
  Bell,
  Check,
  Trash2 as TrashIcon,
  KeyRound,
  Puzzle,
  Sun,
  Moon,
  Search,
  FileCode,
  Shield,
  Bug,
  Brain,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../contexts/NotificationContext';
import { useTheme } from '../contexts/ThemeContext';

interface NavSection {
  title: string;
  items: { to: string; icon: React.ReactNode; label: string; end?: boolean }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Workspace',
    items: [
      { to: '/', icon: <LayoutDashboard className="h-4 w-4" />, label: 'Dashboard', end: true },
      { to: '/projects', icon: <FolderOpen className="h-4 w-4" />, label: 'Projects' },
      { to: '/chat', icon: <MessageSquare className="h-4 w-4" />, label: 'Chat' },
      { to: '/agents', icon: <Users className="h-4 w-4" />, label: 'Agents' },
      { to: '/playground', icon: <Terminal className="h-4 w-4" />, label: 'Playground' },
      { to: '/files', icon: <FolderOpen className="h-4 w-4" />, label: 'Files' },
      { to: '/editor', icon: <Code className="h-4 w-4" />, label: 'Editor' },
      { to: '/terminal', icon: <Monitor className="h-4 w-4" />, label: 'Terminal' },
      { to: '/git', icon: <GitBranch className="h-4 w-4" />, label: 'Git Push' },
      { to: '/teams', icon: <Users className="h-4 w-4" />, label: 'Teams' },
      { to: '/templates', icon: <FileCode className="h-4 w-4" />, label: 'Templates' },
      { to: '/swarm', icon: <Bug className="h-4 w-4" />, label: 'Swarm' },
      { to: '/memory', icon: <Brain className="h-4 w-4" />, label: 'Memory' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: '/runs', icon: <History className="h-4 w-4" />, label: 'Run History' },
      { to: '/queue', icon: <Gauge className="h-4 w-4" />, label: 'Queues' },
      { to: '/metrics', icon: <BarChart3 className="h-4 w-4" />, label: 'Metrics' },
      { to: '/cron', icon: <Clock className="h-4 w-4" />, label: 'Cron Jobs' },
      { to: '/logs', icon: <ScrollText className="h-4 w-4" />, label: 'Logs' },
      { to: '/webhooks', icon: <Webhook className="h-4 w-4" />, label: 'Webhooks' },
      { to: '/audit-logs', icon: <Shield className="h-4 w-4" />, label: 'Audit Logs' },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/settings', icon: <Settings className="h-4 w-4" />, label: 'Settings' },
      { to: '/api-keys', icon: <KeyRound className="h-4 w-4" />, label: 'API Keys' },
      { to: '/plugins', icon: <Puzzle className="h-4 w-4" />, label: 'Plugins' },
    ],
  },
];

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll, removeNotification } = useNotifications();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/50">
            <span className="text-sm font-medium text-white">Notifications</span>
            <div className="flex items-center gap-1">
              <button onClick={markAllAsRead} className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10" title="Mark all read">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button onClick={clearAll} className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10" title="Clear all">
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">No notifications yet</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => { markAsRead(n.id); if (n.link) window.location.href = n.link; }}
                  className={`px-4 py-2.5 border-b border-slate-800/20 cursor-pointer hover:bg-slate-800/40 transition-colors ${n.read ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      n.type === 'error' ? 'bg-red-400' : n.type === 'success' ? 'bg-emerald-400' : n.type === 'warning' ? 'bg-amber-400' : 'bg-indigo-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-200">{n.title}</div>
                      <div className="text-[11px] text-slate-500 truncate">{n.message}</div>
                      <div className="text-[10px] text-slate-600 mt-0.5">{n.timestamp.toLocaleTimeString()}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}
                      className="text-slate-600 hover:text-red-400 flex-shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const pages = [
    { label: 'Dashboard', path: '/' },
    { label: 'Projects', path: '/projects' },
    { label: 'Chat', path: '/chat' },
    { label: 'Agents', path: '/agents' },
    { label: 'Playground', path: '/playground' },
    { label: 'Run History', path: '/runs' },
    { label: 'Queues', path: '/queue' },
    { label: 'Metrics', path: '/metrics' },
    { label: 'Files', path: '/files' },
    { label: 'Editor', path: '/editor' },
    { label: 'Terminal', path: '/terminal' },
    { label: 'Git Push', path: '/git' },
    { label: 'Cron Jobs', path: '/cron' },
    { label: 'Logs', path: '/logs' },
    { label: 'Webhooks', path: '/webhooks' },
    { label: 'Settings', path: '/settings' },
    { label: 'API Keys', path: '/api-keys' },
  ];

  const results = query.trim()
    ? pages.filter((p) => p.label.toLowerCase().includes(query.toLowerCase()))
    : pages;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 text-xs hover:bg-slate-200 dark:hover:bg-slate-700/60 transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search...</span>
        <kbd className="ml-1 px-1 rounded bg-slate-200 dark:bg-slate-700 text-[10px]">Ctrl K</kbd>
      </button>
      <button
        onClick={() => setOpen(true)}
        className="sm:hidden p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Search className="h-5 w-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800/50">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages..."
                className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none"
              />
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {results.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-slate-500">No results</div>
              ) : (
                results.map((p) => (
                  <a
                    key={p.path}
                    href={p.path}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <span className="text-sm text-slate-700 dark:text-slate-300">{p.label}</span>
                    <span className="ml-auto text-xs text-slate-400">{p.path}</span>
                  </a>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const pageTitle = (() => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    const segment = path.slice(1).replace(/-/g, ' ');
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  })();

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-4 py-5 border-b border-slate-800/50`}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
          <Zap className="h-4 w-4 text-white" />
        </div>
        {!collapsed && <span className="text-lg font-bold text-white tracking-tight">Titan</span>}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto scrollbar-thin">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {section.title}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center ${collapsed ? 'justify-center' : 'gap-3'} rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-indigo-500/15 text-indigo-400 shadow-sm shadow-indigo-500/5'
                        : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                    }`
                  }
                  title={collapsed ? item.label : undefined}
                >
                  {item.icon}
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-slate-800/50 space-y-2">
        <button
          onClick={handleLogout}
          className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-2'} px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150`}
          title={collapsed ? 'Sign out' : undefined}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sign out</span>}
        </button>
        {!collapsed && (
          <div className="text-[10px] text-slate-600 px-3 text-center">Titan v1.0.0</div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-950">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-r border-slate-800/50 bg-slate-900/80 backdrop-blur-xl transition-all duration-300 ${
          collapsed ? 'w-[68px]' : 'w-64'
        }`}
      >
        <SidebarContent />
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute bottom-20 -right-3 z-50 flex items-center justify-center w-6 h-6 rounded-full border border-slate-700 bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          style={{ left: collapsed ? '56px' : '248px' }}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 flex flex-col bg-slate-900 border-r border-slate-800/50 shadow-2xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/30 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{pageTitle}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <GlobalSearch />
            <ThemeToggle />
            <NotificationBell />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Online</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default Layout;
