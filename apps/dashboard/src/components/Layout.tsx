import { NavLink, useNavigate } from 'react-router-dom';
import { Terminal, History, Gauge, Cpu, BarChart3, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-screen bg-slate-950">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
          <Cpu className="h-6 w-6 text-indigo-400" />
          <span className="text-lg font-bold text-white tracking-tight">Titan</span>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
            <Terminal className="h-4 w-4" />
            Playground
          </NavLink>
          <NavLink to="/runs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <History className="h-4 w-4" />
            Run History
          </NavLink>
          <NavLink to="/queue" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Gauge className="h-4 w-4" />
            Queue Monitor
          </NavLink>
          <NavLink to="/metrics" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <BarChart3 className="h-4 w-4" />
            Metrics
          </NavLink>
        </nav>

        <div className="px-4 py-4 border-t border-slate-800 space-y-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
          <div className="text-xs text-slate-600 px-3">Titan Dashboard v0.1.0</div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
