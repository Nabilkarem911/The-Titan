export function SkeletonCard({ count = 1 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card animate-pulse">
          <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-700/50 rounded mb-3" />
          <div className="h-8 w-1/2 bg-slate-200 dark:bg-slate-700/50 rounded mb-2" />
          <div className="h-3 w-2/3 bg-slate-100 dark:bg-slate-800/50 rounded" />
        </div>
      ))}
    </>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex gap-6">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 flex-1 bg-slate-200 dark:bg-slate-700/50 rounded" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="border-b border-slate-100 dark:border-slate-800/50 px-6 py-3 flex gap-6">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-3 flex-1 bg-slate-100 dark:bg-slate-800/50 rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 bg-slate-200 dark:bg-slate-700/50 rounded"
          style={{ width: `${70 + Math.random() * 30}%` }}
        />
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700/50" />
          <div>
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700/50 rounded mb-1" />
            <div className="h-3 w-48 bg-slate-100 dark:bg-slate-800/50 rounded" />
          </div>
        </div>
        <div className="h-9 w-24 bg-slate-200 dark:bg-slate-700/50 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SkeletonCard count={3} />
      </div>
    </div>
  );
}
