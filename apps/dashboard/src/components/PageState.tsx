import { AlertCircle, RefreshCw, Inbox } from 'lucide-react';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mb-4">
        <AlertCircle className="h-6 w-6 text-red-400" />
      </div>
      <p className="text-sm text-red-400 mb-1">Something went wrong</p>
      <p className="text-xs text-slate-500 mb-4 max-w-md">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-500/10 mb-4">
        {icon ?? <Inbox className="h-6 w-6 text-slate-400" />}
      </div>
      <p className="text-sm text-slate-300 mb-1">{title}</p>
      {description && <p className="text-xs text-slate-500 mb-4 max-w-md">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
