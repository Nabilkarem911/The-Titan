import { useState, useEffect } from 'react';
import {
  GitBranch,
  Send,
  CheckCircle,
  AlertCircle,
  Terminal as TerminalIcon,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  FileCode,
  FilePlus,
  FileMinus,
  FileEdit,
} from 'lucide-react';
import { API_BASE, getToken } from '../api/client';
import { ErrorState } from '../components/PageState';

interface CommandResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface GitStatus {
  branch?: string;
  ahead?: number;
  behind?: number;
  staged?: Array<{ path: string; status: string }>;
  unstaged?: Array<{ path: string; status: string }>;
  untracked?: string[];
  clean?: boolean;
}

export default function GitPage() {
  const [commitMessage, setCommitMessage] = useState('');
  const [branch, setBranch] = useState('main');
  const [remote, setRemote] = useState('origin');
  const [tag, setTag] = useState('');
  const [addAll, setAddAll] = useState(true);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string; details: CommandResult[] } | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const res = await fetch(`${API_BASE}/git/status`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 404) {
        setStatusError(null);
        setStatusLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as GitStatus;
      setGitStatus(data);
      if (data.branch) setBranch(data.branch);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to load git status');
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const validate = () => {
    if (!commitMessage.trim()) {
      setValidationError('Commit message is required');
      return false;
    }
    if (commitMessage.trim().length < 3) {
      setValidationError('Commit message must be at least 3 characters');
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handlePush = async () => {
    if (!validate()) return;
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
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = await res.json() as { success: boolean; message: string; details: CommandResult[] };
      setResult(data);
      if (data.success) {
        setCommitMessage('');
        setTag('');
        fetchStatus();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Git push failed');
    } finally {
      setLoading(false);
    }
  };

  const totalChanges = (gitStatus?.staged?.length ?? 0) + (gitStatus?.unstaged?.length ?? 0) + (gitStatus?.untracked?.length ?? 0);

  const statusIcon = (status: string) => {
    if (status === 'added' || status === 'A') return <FilePlus className="h-3.5 w-3.5 text-emerald-400" />;
    if (status === 'deleted' || status === 'D') return <FileMinus className="h-3.5 w-3.5 text-red-400" />;
    return <FileEdit className="h-3.5 w-3.5 text-amber-400" />;
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Git Status Card */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-500/20 text-orange-400">
              <GitBranch className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Repository Status</h3>
              <p className="text-xs text-slate-500">Current workspace state</p>
            </div>
          </div>
          <button onClick={fetchStatus} className="btn-secondary" disabled={statusLoading}>
            {statusLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        </div>

        {statusError ? (
          <ErrorState message={statusError} onRetry={fetchStatus} />
        ) : !statusLoading && !gitStatus ? (
          <p className="text-xs text-slate-500">Git status preview not available. You can still commit and push below.</p>
        ) : statusLoading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 w-32 bg-slate-700/50 rounded" />
            <div className="h-4 w-48 bg-slate-800/50 rounded" />
          </div>
        ) : gitStatus ? (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-indigo-400">
                <GitBranch className="h-4 w-4" />
                {gitStatus.branch ?? 'unknown'}
              </span>
              {gitStatus.ahead != null && gitStatus.ahead > 0 && (
                <span className="text-emerald-400 text-xs">↑ {gitStatus.ahead} ahead</span>
              )}
              {gitStatus.behind != null && gitStatus.behind > 0 && (
                <span className="text-amber-400 text-xs">↓ {gitStatus.behind} behind</span>
              )}
              {gitStatus.clean && (
                <span className="badge-success"><CheckCircle className="h-3 w-3" /> Clean</span>
              )}
            </div>

            {totalChanges > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-slate-500">{totalChanges} change{totalChanges !== 1 ? 's' : ''}</div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {gitStatus.staged?.map((f) => (
                    <div key={`s-${f.path}`} className="flex items-center gap-2 text-xs">
                      {statusIcon(f.status)}
                      <span className="font-mono text-slate-300 truncate">{f.path}</span>
                      <span className="badge-success text-[10px] ml-auto">staged</span>
                    </div>
                  ))}
                  {gitStatus.unstaged?.map((f) => (
                    <div key={`u-${f.path}`} className="flex items-center gap-2 text-xs">
                      {statusIcon(f.status)}
                      <span className="font-mono text-slate-300 truncate">{f.path}</span>
                      <span className="badge-warning text-[10px] ml-auto">modified</span>
                    </div>
                  ))}
                  {gitStatus.untracked?.map((path) => (
                    <div key={`t-${path}`} className="flex items-center gap-2 text-xs">
                      <FileCode className="h-3.5 w-3.5 text-slate-500" />
                      <span className="font-mono text-slate-400 truncate">{path}</span>
                      <span className="badge text-[10px] ml-auto">untracked</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Push Form */}
      <div className="card space-y-4">
        <h4 className="text-sm font-medium text-white">Commit & Push</h4>

        <div>
          <label htmlFor="commit-msg" className="block text-xs font-medium text-slate-400 mb-1.5">Commit Message *</label>
          <input
            id="commit-msg"
            type="text"
            value={commitMessage}
            onChange={(e) => { setCommitMessage(e.target.value); setValidationError(null); }}
            placeholder="feat: add new feature"
            className={`input ${validationError ? 'border-red-500/50 focus:border-red-500' : ''}`}
            onKeyDown={(e) => e.key === 'Enter' && handlePush()}
          />
          {validationError && <p className="text-xs text-red-400 mt-1">{validationError}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="git-branch" className="block text-xs font-medium text-slate-400 mb-1.5">Branch</label>
            <input id="git-branch" type="text" value={branch} onChange={(e) => setBranch(e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="git-remote" className="block text-xs font-medium text-slate-400 mb-1.5">Remote</label>
            <input id="git-remote" type="text" value={remote} onChange={(e) => setRemote(e.target.value)} className="input" />
          </div>
        </div>

        <div>
          <label htmlFor="git-tag" className="block text-xs font-medium text-slate-400 mb-1.5">Tag (optional)</label>
          <input id="git-tag" type="text" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="v1.0.0" className="input" />
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

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={handlePush}
          disabled={loading || !commitMessage.trim()}
          className="btn-primary w-full justify-center"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {loading ? 'Pushing...' : 'Push to Remote'}
        </button>
      </div>

      {/* Result */}
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
