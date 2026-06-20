import { cn } from '../utils/cn';

type StatusType = 'success' | 'warning' | 'error' | 'info' | 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'pending' | 'enabled' | 'disabled';

const STATUS_STYLES: Record<StatusType, { bg: string; text: string; dot: string }> = {
  success: { bg: 'bg-success/10', text: 'text-success', dot: 'bg-success' },
  completed: { bg: 'bg-success/10', text: 'text-success', dot: 'bg-success' },
  enabled: { bg: 'bg-success/10', text: 'text-success', dot: 'bg-success' },
  warning: { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
  error: { bg: 'bg-error/10', text: 'text-error', dot: 'bg-error' },
  failed: { bg: 'bg-error/10', text: 'text-error', dot: 'bg-error' },
  disabled: { bg: 'bg-error/10', text: 'text-error', dot: 'bg-error' },
  info: { bg: 'bg-info/10', text: 'text-info', dot: 'bg-info' },
  queued: { bg: 'bg-queued/10', text: 'text-queued', dot: 'bg-queued' },
  pending: { bg: 'bg-queued/10', text: 'text-queued', dot: 'bg-queued' },
  running: { bg: 'bg-running/10', text: 'text-running', dot: 'bg-running' },
  paused: { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
  pulse?: boolean;
}

export function StatusBadge({ status, className, pulse }: StatusBadgeProps) {
  const type = (status.toLowerCase() as StatusType);
  const style = STATUS_STYLES[type] ?? STATUS_STYLES.info;

  return (
    <span className={cn('badge', style.bg, style.text, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', style.dot, pulse && 'animate-pulse-soft')} />
      <span className="capitalize">{status}</span>
    </span>
  );
}
