import { useState } from 'react';
import {
  GitBranch,
  Send,
  Tag,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import { api } from '../api/client';

export default function Git() {
  // Form state
  const [message, setMessage] = useState('');
  const [branch, setBranch] = useState('main');
  const [remote, setRemote] = useState('origin');
  const [addAll, setAddAll] = useState(true);
  const [tag, setTag] = useState('');

  // Submit state
  const [pushing, setPushing] = useState(false);
  const [pushError, setPushError] = useState('');

  // Result
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    command?: string;
    output?: string;
  } | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handlePush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setPushing(true);
    setPushError('');
    setResult(null);

    try {
      const res = await api.gitPush(branch);
      setResult({
        success: true,
        message: typeof res.message === 'string' ? res.message : 'Push completed successfully',
        command: `git push ${remote} ${branch}`,
        output: typeof res.message === 'string' ? res.message : JSON.stringify(res),
      });
      setMessage('');
      setTag('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Push failed';
      setPushError(msg);
      setResult({
        success: false,
        message: msg,
        command: `git push ${remote} ${branch}`,
      });
    } finally {
      setPushing(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <GitBranch size={28} style={{ color: '#00F2FE' }} />
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#F8FAFC' }}
          >
            Git Operations
          </h1>
          <p className="text-sm" style={{ color: '#94A3B8' }}>
            Commit and push changes to remote repository
          </p>
        </div>
      </div>

      {/* Push Form */}
      <div className="card p-6 rounded-xl max-w-2xl">
        <h3
          className="text-lg font-semibold mb-4"
          style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#F8FAFC' }}
        >
          Push Changes
        </h3>

        <form onSubmit={handlePush} className="space-y-4">
          {/* Commit Message */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#94A3B8' }}>
              Commit Message <span style={{ color: '#FF007A' }}>*</span>
            </label>
            <textarea
              className="input"
              rows={3}
              placeholder="Describe your changes..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              style={{ resize: 'vertical', minHeight: 80 }}
            />
          </div>

          {/* Branch + Remote */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#94A3B8' }}>Branch</label>
              <input
                className="input"
                placeholder="main"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#94A3B8' }}>Remote</label>
              <input
                className="input"
                placeholder="origin"
                value={remote}
                onChange={(e) => setRemote(e.target.value)}
              />
            </div>
          </div>

          {/* Tag */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#94A3B8' }}>
              Tag (optional)
            </label>
            <div className="flex items-center gap-2">
              <Tag size={16} style={{ color: '#64748B' }} />
              <input
                className="input"
                placeholder="e.g. v1.0.0"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
              />
            </div>
          </div>

          {/* Add All Checkbox */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={addAll}
                onChange={(e) => setAddAll(e.target.checked)}
                className="w-4 h-4 rounded"
                style={{ accentColor: '#7000FF' }}
              />
              <span className="text-sm" style={{ color: '#94A3B8' }}>
                Add all changes before committing
              </span>
            </label>
          </div>

          {/* Error */}
          {pushError && !result && (
            <div className="p-3 rounded-lg flex items-center gap-2" style={{ background: 'rgba(255,0,122,0.1)', border: '1px solid rgba(255,0,122,0.2)' }}>
              <AlertCircle size={16} style={{ color: '#FF007A' }} />
              <p className="text-sm" style={{ color: '#FF007A' }}>{pushError}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={pushing || !message.trim()}
          >
            <Send size={16} />
            {pushing ? 'Pushing...' : 'Commit & Push'}
          </button>
        </form>
      </div>

      {/* Result Display */}
      {result && (
        <div
          className="card p-5 rounded-xl mt-6 max-w-2xl"
          style={{
            borderColor: result.success ? '#10B981' : '#FF007A',
            boxShadow: result.success
              ? '0 0 20px rgba(16, 185, 129, 0.15)'
              : '0 0 20px rgba(255, 0, 122, 0.15)',
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            {result.success ? (
              <CheckCircle2 size={24} style={{ color: '#10B981' }} />
            ) : (
              <XCircle size={24} style={{ color: '#FF007A' }} />
            )}
            <h3
              className="text-lg font-semibold"
              style={{
                fontFamily: 'Space Grotesk, sans-serif',
                color: result.success ? '#10B981' : '#FF007A',
              }}
            >
              {result.success ? 'Push Successful' : 'Push Failed'}
            </h3>
          </div>

          <p className="text-sm mb-3" style={{ color: '#94A3B8' }}>
            {result.message}
          </p>

          {/* Expandable Details */}
          {result.command && (
            <div>
              <button
                className="btn btn-ghost btn-sm mb-2"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showDetails ? 'Hide Details' : 'Show Details'}
              </button>

              {showDetails && (
                <div className="space-y-2">
                  <div className="p-3 rounded-lg" style={{ background: '#0A0F1D', border: '1px solid #1E294B' }}>
                    <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#64748B' }}>
                      Command
                    </p>
                    <code className="text-sm font-mono" style={{ color: '#00F2FE' }}>
                      {result.command}
                    </code>
                  </div>
                  {result.output && (
                    <div className="p-3 rounded-lg" style={{ background: '#0A0F1D', border: '1px solid #1E294B' }}>
                      <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#64748B' }}>
                        Output
                      </p>
                      <pre className="text-sm font-mono whitespace-pre-wrap" style={{ color: '#94A3B8' }}>
                        {result.output}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
