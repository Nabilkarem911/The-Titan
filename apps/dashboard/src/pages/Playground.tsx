import { useState } from 'react';
import { Zap, Play } from 'lucide-react';
import { api } from '../api/client';
import type { AgentProfile } from '../api/client';
import { useApi } from '../hooks/useApi';
import { ErrorState } from '../components/PageState';
import { PageSkeleton } from '../components/LoadingSkeleton';

export default function Playground() {
  const { data: agents, loading, error, refetch } = useApi(() => api.listAgentProfiles(), []);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!selectedAgent || !prompt.trim()) return;
    setRunning(true);
    setRunError(null);
    setResult(null);
    try {
      const res = await api.triggerRun(selectedAgent, { prompt });
      setResult(`Run started: ${res.runId} (Job: ${res.jobId})`);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/10">
          <Zap className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Playground</h2>
          <p className="text-sm text-slate-400">Test agent runs interactively</p>
        </div>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Agent</label>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="input w-full"
          >
            <option value="">Select an agent...</option>
            {agents?.items?.map((a: AgentProfile) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt..."
            className="input w-full h-32 resize-none"
          />
        </div>

        <button
          onClick={handleRun}
          disabled={running || !selectedAgent || !prompt.trim()}
          className="btn-primary"
        >
          <Play className="h-4 w-4" />
          {running ? 'Running...' : 'Run'}
        </button>

        {runError && (
          <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{runError}</div>
        )}
        {result && (
          <div className="text-sm text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-lg">{result}</div>
        )}
      </div>
    </div>
  );
}
