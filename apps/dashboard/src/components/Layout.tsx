import { useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

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
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/settings', icon: <Settings className="h-4 w-4" />, label: 'Settings' },
    ],
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
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
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800/50 bg-slate-900/30 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div>
              <h1 className="text-lg font-semibold text-white">{pageTitle}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400">Online</span>
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
