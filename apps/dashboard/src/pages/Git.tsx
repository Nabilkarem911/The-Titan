import { useState } from 'react';
import { GitBranch, Upload } from 'lucide-react';
import { api } from '../api/client';
import { ErrorState } from '../components/PageState';

export default function Git() {
  const [remote, setRemote] = useState('origin');
  const [branch, setBranch] = useState('main');
  const [message, setMessage] = useState('');
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    details: Array<{ command: string; stdout: string; stderr: string; exitCode: number }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePush = async () => {
    setPushing(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.gitPush({ remote, branch, commitMessage: message || undefined });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Push failed');
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-500/10">
          <GitBranch className="h-5 w-5 text-orange-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Git</h2>
          <p className="text-sm text-slate-400">Push code changes to remote repositories</p>
        </div>
      </div>

      {/* Push form */}
      <div className="card space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Remote</label>
            <input
              value={remote}
              onChange={(e) => setRemote(e.target.value)}
              className="input w-full"
              placeholder="origin"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Branch</label>
            <input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="input w-full"
              placeholder="main"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Commit Message (optional)</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="input w-full h-20 resize-none"
            placeholder="Optional commit message..."
          />
        </div>
        <button onClick={handlePush} disabled={pushing} className="btn-primary">
          <Upload className="h-4 w-4" />
          {pushing ? 'Pushing...' : 'Push'}
        </button>
      </div>

      {/* Error */}
      {error && <ErrorState message={error} onRetry={() => setError(null)} />}

      {/* Result */}
      {result && (
        <div className={`card ${result.success ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-2.5 h-2.5 rounded-full ${result.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className={`text-sm font-medium ${result.success ? 'text-emerald-400' : 'text-red-400'}`}>
              {result.message}
            </span>
          </div>
          {result.details?.map((detail, i) => (
            <div key={i} className="mb-2 text-xs">
              <p className="text-slate-400 font-mono mb-1">$ {detail.command}</p>
              {detail.stdout && <pre className="text-slate-500 whitespace-pre-wrap">{detail.stdout}</pre>}
              {detail.stderr && <pre className="text-red-400/70 whitespace-pre-wrap">{detail.stderr}</pre>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
