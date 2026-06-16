import { useState } from 'react';
import {
  GitBranch,
  Send,
  CheckCircle,
  AlertCircle,
  Terminal as TerminalIcon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const API_BASE = (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_BASE_URL ?? '/api/v1';
const getToken = () => localStorage.getItem('titan_access_token') ?? '';

interface CommandResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export default function GitPage() {
  const [commitMessage, setCommitMessage] = useState('');
  const [branch, setBranch] = useState('main');
  const [remote, setRemote] = useState('origin');
  const [tag, setTag] = useState('');
  const [addAll, setAddAll] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; details: CommandResult[] } | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePush = async () => {
    if (!commitMessage.trim()) {
      setError('Commit message is required');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/git/push`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cwd: '/',
          commitMessage: commitMessage.trim(),
          remote,
          branch,
          addAll,
          ...(tag.trim() ? { createTag: tag.trim() } : {}),
        }),
      });
      const data = await res.json() as { success: boolean; message: string; details: CommandResult[] };
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Git push failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="card space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800/50">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-500/20 text-orange-400">
            <GitBranch className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Git Push</h3>
            <p className="text-xs text-slate-500">Stage, commit, and push changes to your repository</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Commit Message</label>
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="feat: add new feature"
              className="input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Branch</label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Remote</label>
              <input
                type="text"
                value={remote}
                onChange={(e) => setRemote(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Tag (optional)</label>
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="v1.0.0"
              className="input"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={addAll}
              onChange={(e) => setAddAll(e.target.checked)}
              className="rounded border-slate-600 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-300">Stage all changes (git add -A)</span>
          </label>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <button
          onClick={handlePush}
          disabled={loading}
          className="btn-primary w-full justify-center"
        >
          <Send className="h-4 w-4" />
          {loading ? 'Pushing...' : 'Push to GitHub'}
        </button>
      </div>

      {result && (
        <div className="card space-y-3">
          <div className="flex items-center gap-3">
            {result.success ? (
              <CheckCircle className="h-6 w-6 text-emerald-400" />
            ) : (
              <AlertCircle className="h-6 w-6 text-red-400" />
            )}
            <div>
              <h4 className={`text-sm font-medium ${result.success ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.message}
              </h4>
              <p className="text-xs text-slate-500">{result.details.length} commands executed</p>
            </div>
          </div>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
          >
            {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showDetails ? 'Hide details' : 'Show details'}
          </button>

          {showDetails && (
            <div className="space-y-2">
              {result.details.map((detail, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/50 font-mono text-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <TerminalIcon className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-indigo-400">{detail.command}</span>
                    <span className={`ml-auto ${detail.exitCode === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      exit {detail.exitCode}
                    </span>
                  </div>
                  {detail.stdout && (
                    <pre className="text-slate-300 whitespace-pre-wrap">{detail.stdout}</pre>
                  )}
                  {detail.stderr && (
                    <pre className="text-red-400 whitespace-pre-wrap mt-1">{detail.stderr}</pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
