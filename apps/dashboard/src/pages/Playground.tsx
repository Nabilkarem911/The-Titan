import { useState } from 'react';
import { Send, Loader2, Terminal } from 'lucide-react';
import { api } from '../api/client';

export default function Playground() {
  const [agentId, setAgentId] = useState('default-agent');
  const [prompt, setPrompt] = useState('');
  const [maxSteps, setMaxSteps] = useState(10);
  const [tokenBudget, setTokenBudget] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ runId: string; jobId: string; status: string; createdAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.triggerRun(agentId, {
        prompt: prompt.trim(),
        maxSteps,
        ...(tokenBudget ? { tokenBudget } : {}),
      });
      setResult(res);
      setPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger run');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Agent Playground</h1>
        <p className="text-slate-400 mt-1">Trigger agent runs and watch them execute in real-time.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="card space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Agent ID</label>
              <input
                className="input"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                placeholder="default-agent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Prompt</label>
              <textarea
                className="input min-h-[120px] resize-y"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="What would you like the agent to do?"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Max Steps</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  className="input"
                  value={maxSteps}
                  onChange={(e) => setMaxSteps(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Token Budget</label>
                <input
                  type="number"
                  min={1}
                  className="input"
                  value={tokenBudget ?? ''}
                  onChange={(e) => setTokenBudget(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Unlimited"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-slate-500">
                {prompt.length} characters
              </div>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {loading ? 'Triggering...' : 'Run Agent'}
              </button>
            </div>
          </form>

          {error && (
            <div className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {result && (
            <div className="card space-y-3 border-l-4 border-l-indigo-500">
              <div className="flex items-center gap-2 text-indigo-400">
                <Terminal className="h-4 w-4" />
                <span className="text-sm font-semibold">Run Triggered</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Run ID</span>
                  <div className="font-mono text-slate-200">{result.runId}</div>
                </div>
                <div>
                  <span className="text-slate-500">Job ID</span>
                  <div className="font-mono text-slate-200">{result.jobId}</div>
                </div>
                <div>
                  <span className="text-slate-500">Status</span>
                  <div className="text-emerald-400 capitalize">{result.status}</div>
                </div>
                <div>
                  <span className="text-slate-500">Created</span>
                  <div className="text-slate-200">{new Date(result.createdAt).toLocaleString()}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-semibold text-white mb-3">Tips</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>Be specific in your prompts for better results.</li>
              <li>Use token budget to limit API costs.</li>
              <li>Check Run History to see step-by-step execution.</li>
              <li>Forbidden tools can be set per-run.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
