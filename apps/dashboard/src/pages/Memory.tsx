import { Brain } from 'lucide-react';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/PageState';

export default function Memory() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-fuchsia-500/10">
          <Brain className="h-5 w-5 text-fuchsia-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Memory</h2>
          <p className="text-sm text-slate-400">Agent memory and knowledge storage</p>
        </div>
      </div>

      <EmptyState
        icon={<Brain className="h-6 w-6 text-slate-400" />}
        title="Memory management coming soon"
        description="View and manage agent memory entries, knowledge bases, and context stores."
      />
    </div>
  );
}

// Keep PageSkeleton available for future loading state
void PageSkeleton;
