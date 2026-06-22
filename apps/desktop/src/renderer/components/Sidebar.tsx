import { MessageSquare, FolderTree, TerminalSquare, Camera, Settings, Monitor } from 'lucide-react';
import { useAppStore, type Page } from '../stores/app-store.js';

const navItems: { page: Page; icon: typeof MessageSquare; label: string }[] = [
  { page: 'chat', icon: MessageSquare, label: 'Chat' },
  { page: 'files', icon: FolderTree, label: 'Files' },
  { page: 'terminal', icon: TerminalSquare, label: 'Terminal' },
  { page: 'screenshot', icon: Camera, label: 'Screenshot' },
  { page: 'devices', icon: Monitor, label: 'Devices' },
  { page: 'settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const currentPage = useAppStore((s) => s.currentPage);
  const setPage = useAppStore((s) => s.setPage);
  const connected = useAppStore((s) => s.connected);

  return (
    <div className="w-16 h-full bg-bg-secondary border-r border-border flex flex-col items-center py-4 gap-1">
      {/* Logo */}
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center mb-4">
        <span className="text-white font-bold text-lg">T</span>
      </div>

      {/* Nav items */}
      <div className="flex-1 flex flex-col gap-1 w-full items-center">
        {navItems.map(({ page, icon: Icon, label }) => (
          <button
            key={page}
            onClick={() => setPage(page)}
            title={label}
            className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-200 ${
              currentPage === page
                ? 'bg-accent/20 text-accent'
                : 'text-text-muted hover:bg-bg-tertiary hover:text-text-secondary'
            }`}
          >
            <Icon size={20} />
          </button>
        ))}
      </div>

      {/* Connection indicator */}
      <div className="flex items-center justify-center pb-2">
        <div
          className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-success pulse-dot' : 'bg-danger'}`}
          title={connected ? 'Connected' : 'Disconnected'}
        />
      </div>
    </div>
  );
}
