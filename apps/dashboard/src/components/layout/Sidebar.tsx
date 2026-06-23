import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut, Menu, X } from 'lucide-react';
import { TitanLogo } from '../TitanLogo';
import { NAV_GROUPS } from '../../utils/constants';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../utils/cn';
import { useI18n } from '../../i18n/I18nContext';
import type { TranslationKey } from '../../i18n/translations';

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebarContent = (
    <>
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
                {group.labelKey ? t(group.labelKey as TranslationKey) : group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.filter((item) => !item.hidden).map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2 rounded-btn text-sm font-medium transition-all duration-150 relative group',
                      collapsed && 'justify-center',
                      isActive
                        ? 'bg-accent-primary/10 text-accent-primary'
                        : 'text-text-secondary hover:bg-elevated hover:text-text-primary',
                    )
                  }
                  title={collapsed ? (item.labelKey ? t(item.labelKey as TranslationKey) : item.label) : undefined}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-accent-primary" />
                      )}
                      <item.icon className="w-5 h-5 shrink-0" />
                      {!collapsed && <span>{item.labelKey ? t(item.labelKey as TranslationKey) : item.label}</span>}
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
          title={collapsed ? t('expand') : t('collapse')}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span>{t('collapse')}</span>}
        </button>
        <button
          onClick={handleLogout}
          className="btn-ghost w-full !justify-center text-error hover:text-error mt-1"
          title={t('logout')}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>{t('logout')}</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button — fixed top-left on small screens */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-40 w-10 h-10 rounded-btn bg-surface border border-border-subtle flex items-center justify-center text-text-secondary"
        title={t('openMenu')}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col bg-sidebar border-r border-border-subtle transition-all duration-250 ease-in-out shrink-0',
          collapsed ? 'w-[72px]' : 'w-[260px]',
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      <aside
        className={cn(
          'lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[260px] bg-sidebar border-r border-border-subtle transition-transform duration-250 ease-in-out flex flex-col',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3 right-3 w-8 h-8 rounded-btn hover:bg-elevated flex items-center justify-center text-text-muted"
        >
          <X className="w-4 h-4" />
        </button>
        {sidebarContent}
      </aside>
    </>
  );
}
