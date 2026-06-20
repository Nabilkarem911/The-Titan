import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { TitanLogo } from '../TitanLogo';
import { NAV_GROUPS } from '../../utils/constants';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../utils/cn';

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside
      className={cn(
        'flex flex-col bg-sidebar border-r border-border-subtle transition-all duration-250 ease-in-out shrink-0',
        collapsed ? 'w-[72px]' : 'w-[260px]',
      )}
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-border-subtle shrink-0">
        {collapsed ? (
          <div className="flex items-center justify-center w-full">
            <TitanLogo size={28} className="!gap-0" />
            <span className="sr-only">TITAN</span>
          </div>
        ) : (
          <TitanLogo size={28} />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 mb-2 text-caption text-text-muted uppercase tracking-wider font-medium">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2 rounded-btn text-sm font-medium transition-all duration-150 relative group',
                      collapsed && 'justify-center',
                      isActive
                        ? 'bg-accent-primary/10 text-accent-primary'
                        : 'text-text-secondary hover:bg-elevated hover:text-text-primary',
                    )
                  }
                  title={collapsed ? item.label : undefined}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-accent-primary" />
                      )}
                      <item.icon className="w-5 h-5 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border-subtle p-2 shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="btn-ghost w-full !justify-center"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
        <button
          onClick={handleLogout}
          className="btn-ghost w-full !justify-center text-error hover:text-error mt-1"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
