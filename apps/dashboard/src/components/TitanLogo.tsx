import { cn } from '../utils/cn';

export function TitanLogo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="titan-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#06B6D4" />
            <stop offset="1" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
        {/* Top triangle */}
        <path d="M16 4 L22 14 L10 14 Z" fill="url(#titan-grad)" opacity="0.9" />
        {/* Middle triangle */}
        <path d="M16 10 L24 22 L8 22 Z" fill="url(#titan-grad)" opacity="0.7" />
        {/* Bottom triangle */}
        <path d="M16 16 L26 28 L6 28 Z" fill="url(#titan-grad)" opacity="0.5" />
      </svg>
      <span className="text-text-primary font-bold text-lg tracking-tight">
        TITAN
      </span>
    </div>
  );
}

export function TitanMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
    >
      <defs>
        <linearGradient id="titan-mark-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#06B6D4" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <path d="M16 4 L22 14 L10 14 Z" fill="url(#titan-mark-grad)" opacity="0.9" />
      <path d="M16 10 L24 22 L8 22 Z" fill="url(#titan-mark-grad)" opacity="0.7" />
      <path d="M16 16 L26 28 L6 28 Z" fill="url(#titan-mark-grad)" opacity="0.5" />
    </svg>
  );
}
