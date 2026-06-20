import type { LucideIcon } from 'lucide-react';
import { cn } from '../utils/cn';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}>
      <div className="w-16 h-16 rounded-card bg-elevated flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-text-muted" />
      </div>
      <h3 className="text-h3 text-text-primary mb-1">{title}</h3>
      {description && <p className="text-small text-text-secondary max-w-sm mb-6">{description}</p>}
      {action && (
        <button onClick={action.onClick} className="btn-primary">
          {action.label}
        </button>
      )}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}>
      <div className="w-16 h-16 rounded-card bg-error/10 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <h3 className="text-h3 text-text-primary mb-1">Something went wrong</h3>
      <p className="text-small text-text-secondary max-w-sm mb-6">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary">
          Try again
        </button>
      )}
    </div>
  );
}
