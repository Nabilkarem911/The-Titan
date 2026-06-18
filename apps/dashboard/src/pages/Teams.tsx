import { UsersRound } from 'lucide-react';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/PageState';

export default function Teams() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-rose-500/10">
          <UsersRound className="h-5 w-5 text-rose-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Teams</h2>
          <p className="text-sm text-slate-400">Team management and collaboration</p>
        </div>
      </div>

      <EmptyState
        icon={<UsersRound className="h-6 w-6 text-slate-400" />}
        title="Teams coming soon"
        description="Team management features are under development."
      />
    </div>
  );
}

// Keep PageSkeleton available for future loading state
void PageSkeleton;
