import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft } from 'lucide-react';
import { NAV_GROUPS } from '../utils/constants';
import { cn } from '../utils/cn';

interface CommandItem {
  label: string;
  path: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Flatten nav items
  const allItems: CommandItem[] = useMemo(() => {
    return NAV_GROUPS.flatMap((group) =>
      group.items.filter((item) => !item.hidden).map((item) => ({
        label: item.label,
        path: item.path,
        group: group.label,
        icon: item.icon,
      })),
    );
  }, []);

  // Filter items by query
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return allItems;
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q),
    );
  }, [allItems, query]);

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selected when query changes
  useEffect(() => {
    setSelected(0);
  }, [query]);

  const handleSelect = (item: CommandItem) => {
    navigate(item.path);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selected]) {
        handleSelect(filtered[selected]);
      }
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="fixed left-1/2 top-[20%] -translate-x-1/2 z-50 w-full max-w-lg">
        <div className="card overflow-hidden shadow-2xl border border-border-subtle">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
            <Search className="w-4 h-4 text-text-muted shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search pages..."
              className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
              autoComplete="off"
            />
            <kbd className="text-caption text-text-muted bg-elevated px-1.5 py-0.5 rounded">ESC</kbd>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <div className="px-3 py-8 text-center text-small text-text-muted">
                No results found
              </div>
            ) : (
              filtered.map((item, i) => (
                <button
                  key={item.path}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelected(i)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-btn text-left transition-colors',
                    i === selected ? 'bg-accent-primary/10' : 'hover:bg-elevated',
                  )}
                >
                  <item.icon className={cn('w-4 h-4 shrink-0', i === selected ? 'text-accent-primary' : 'text-text-muted')} />
                  <span className={cn('text-sm flex-1', i === selected ? 'text-text-primary' : 'text-text-secondary')}>
                    {item.label}
                  </span>
                  <span className="text-caption text-text-muted">{item.group}</span>
                  {i === selected && <CornerDownLeft className="w-3.5 h-3.5 text-text-muted" />}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border-subtle flex items-center justify-between text-caption text-text-muted">
            <span>Navigate with ↑↓ • Enter to select</span>
            <span>{filtered.length} results</span>
          </div>
        </div>
      </div>
    </>
  );
}
