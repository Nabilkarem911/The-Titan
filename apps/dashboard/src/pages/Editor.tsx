import { Code } from 'lucide-react';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/PageState';

export default function Editor() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/10">
          <Code className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Editor</h2>
          <p className="text-sm text-slate-400">In-browser code editor</p>
        </div>
      </div>

      <div className="card min-h-[500px] flex items-center justify-center">
        <EmptyState
          icon={<Code className="h-6 w-6 text-slate-400" />}
          title="Code Editor"
          description="Monaco editor integration coming in Phase 2."
        />
      </div>
    </div>
  );
}

// Prevent unused import warning — PageSkeleton is available for loading state
void PageSkeleton;
