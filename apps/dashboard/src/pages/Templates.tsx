import { FileCode } from 'lucide-react';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/PageState';

export default function Templates() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-cyan-500/10">
          <FileCode className="h-5 w-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Templates</h2>
          <p className="text-sm text-slate-400">Pre-built agent and workflow templates</p>
        </div>
      </div>

      <EmptyState
        icon={<FileCode className="h-6 w-6 text-slate-400" />}
        title="Templates coming soon"
        description="Browse and use templates to quickly set up agents and workflows."
      />
    </div>
  );
}

// Keep PageSkeleton available for future loading state
void PageSkeleton;
