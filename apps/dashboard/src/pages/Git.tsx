import { useState } from 'react';
import { GitBranch, Send } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';

export default function Git() {
  const [form, setForm] = useState({
    cwd: '/',
    commitMessage: '',
    remote: 'origin',
    branch: 'main',
    addAll: true,
    skipPush: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handlePush = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResult(null);
    try {
      const res = await api.post<{ success: boolean; message: string; details: unknown[] }>('/git/push', form);
      setResult(res.message);
      toast.success(res.success ? 'Git push successful' : 'Git operation completed', { description: res.message });
    } catch (err) {
      toast.error('Git operation failed', { description: err instanceof Error ? err.message : undefined });
      setResult(err instanceof Error ? err.message : 'Failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto animate-fade-in">
      <PageHeader
        pageKey="git"
        icon={GitBranch}
        title="Git"
        subtitle="Push changes to your repository"
        description="The Git page lets you push code changes from Titan to your Git repository. You can stage files, write commit messages, and push — all from the dashboard. This is useful when Titan makes code changes (through Self-Forge or Evolution) and you want to push them to GitHub."
        tips={[
          'Specify the working directory of your Git repo',
          'Write a clear commit message describing the changes',
          'From chat: titan chat "commit and push my changes"',
        ]}
      />

      <form onSubmit={handlePush} className="card p-6 space-y-4">
        <div>
          <label className="block text-label text-text-secondary mb-1.5">Working Directory</label>
          <input value={form.cwd} onChange={(e) => setForm({ ...form, cwd: e.target.value })} className="input font-mono" />
        </div>
        <div>
          <label className="block text-label text-text-secondary mb-1.5">Commit Message</label>
          <textarea value={form.commitMessage} onChange={(e) => setForm({ ...form, commitMessage: e.target.value })} className="input" rows={3} placeholder="Update files..." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-label text-text-secondary mb-1.5">Remote</label>
            <input value={form.remote} onChange={(e) => setForm({ ...form, remote: e.target.value })} className="input" />
          </div>
          <div>
            <label className="block text-label text-text-secondary mb-1.5">Branch</label>
            <input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} className="input" />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <input type="checkbox" checked={form.addAll} onChange={(e) => setForm({ ...form, addAll: e.target.checked })} className="accent-accent-primary" />
            Stage all changes
          </label>
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <input type="checkbox" checked={form.skipPush} onChange={(e) => setForm({ ...form, skipPush: e.target.checked })} className="accent-accent-primary" />
            Skip push (commit only)
          </label>
        </div>
        <button type="submit" disabled={isLoading} className="btn-primary">
          {isLoading ? <span className="w-4 h-4 border-2 border-void border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
          Push Changes
        </button>
      </form>

      {result && (
        <div className="card p-4 mt-4">
          <pre className="text-small font-mono text-text-secondary whitespace-pre-wrap">{result}</pre>
        </div>
      )}
    </div>
  );
}
