import React from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Error', message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[300px] p-8">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[rgba(255,0,122,0.1)] mb-4">
          <AlertTriangle className="w-7 h-7 text-pink" />
        </div>
        <h3 className="font-heading text-lg font-semibold text-text-primary mb-2">{title}</h3>
        <p className="text-text-secondary text-sm mb-4">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="btn btn-secondary btn-sm">
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[300px] p-8">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[rgba(0,242,254,0.05)] border border-border mb-4">
          {icon || <Inbox className="w-7 h-7 text-text-muted" />}
        </div>
        <h3 className="font-heading text-lg font-semibold text-text-primary mb-2">{title}</h3>
        <p className="text-text-secondary text-sm mb-4">{message}</p>
        {action}
      </div>
    </div>
  );
}
