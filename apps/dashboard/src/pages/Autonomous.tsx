import { useState, useEffect, useCallback } from 'react';
import { Bot, Play, CheckCircle, XCircle, Loader2, AlertTriangle, Clock, Wrench, Sparkles, Brain, Zap } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { cn } from '../utils/cn';

interface VerifyResult {
  type: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
  durationMs: number;
}

interface AutonomousTask {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  cwd: string;
  autoFix: boolean;
  results: VerifyResult[];
  startedAt: string;
  completedAt?: string;
  summary?: string;
}

interface HyperAgentStats {
  cycles: number;
  improvements: number;
  evaluations: number;
}

interface CuriosityStats {
  totalQuestions: number;
  explored: number;
  unanswered: number;
}

export default function Autonomous() {
  const [tasks, setTasks] = useState<AutonomousTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [taskDesc, setTaskDesc] = useState('');
  const [cwd, setCwd] = useState('.');
  const [autoFix, setAutoFix] = useState(false);
  const [verifyResults, setVerifyResults] = useState<VerifyResult[] | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [hyperStats, setHyperStats] = useState<HyperAgentStats | null>(null);
  const [curiosityStats, setCuriosityStats] = useState<CuriosityStats | null>(null);
  const [runningHyper, setRunningHyper] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, hyperRes, curiosityRes] = await Promise.all([
        api.get<{ items: AutonomousTask[]; total: number }>('/autonomous/tasks'),
        api.get<HyperAgentStats>('/hyper-agent/stats').catch(() => null),
        api.get<CuriosityStats>('/curiosity/stats').catch(() => null),
      ]);
      setTasks(tasksRes.items);
      setHyperStats(hyperRes);
      setCuriosityStats(curiosityRes);
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyResults(null);
    try {
      const res = await api.post<{ results: VerifyResult[]; allPassed: boolean }>('/autonomous/verify', { cwd, checks: ['typecheck', 'lint'] });
      setVerifyResults(res.results);
      if (res.allPassed) toast.success('All checks passed!');
      else toast.warning(`${res.results.reduce((s, r) => s + r.errors.length, 0)} errors found`);
    } catch {
      toast.error('Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleRunTask = async () => {
    if (!taskDesc.trim()) return;
    setRunning(true);
    try {
      const res = await api.post<AutonomousTask>('/autonomous/task', { description: taskDesc, cwd, autoFix });
      toast.success(`Task ${res.status}`, { description: res.summary });
      load();
      setTaskDesc('');
    } catch {
      toast.error('Task execution failed');
    } finally {
      setRunning(false);
    }
  };

  const handleHyperCycle = async () => {
    setRunningHyper(true);
    try {
      await api.post('/hyper-agent/cycle', {});
      toast.success('Hyper-agent cycle completed');
      load();
    } catch {
      toast.error('Hyper-agent cycle failed');
    } finally {
      setRunningHyper(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-h1 text-text-primary">Autonomous Mode</h1>
        <p className="text-small text-text-secondary mt-1">Automated verification, auto-fix, and task execution</p>
      </div>

      {/* Quick Verify */}
      <div className="card p-5">
        <h2 className="text-h3 text-text-primary mb-3 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-accent-primary" />
          Quick Verification
        </h2>
        <div className="flex items-center gap-2 mb-3">
          <input value={cwd} onChange={(e) => setCwd(e.target.value)} placeholder="Working directory" className="input flex-1" />
          <button onClick={handleVerify} disabled={verifying} className="btn-primary">
            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Verify
          </button>
        </div>

        {verifyResults && (
          <div className="space-y-2">
            {verifyResults.map((r, i) => (
              <div key={i} className={cn(
                'flex items-start gap-3 p-3 rounded-btn border',
                r.passed ? 'border-success/30 bg-success/5' : 'border-error/30 bg-error/5',
              )}>
                {r.passed ? <CheckCircle className="w-4 h-4 text-success shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text-primary capitalize">{r.type}</span>
                    <span className="text-caption text-text-muted">{(r.durationMs / 1000).toFixed(1)}s</span>
                  </div>
                  {r.errors.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {r.errors.slice(0, 5).map((err, j) => (
                        <p key={j} className="text-caption text-error font-mono">{err}</p>
                      ))}
                      {r.errors.length > 5 && <p className="text-caption text-text-muted">...and {r.errors.length - 5} more</p>}
                    </div>
                  )}
                  {r.warnings.length > 0 && (
                    <div className="mt-1">
                      {r.warnings.map((w, j) => (
                        <p key={j} className="text-caption text-warning flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{w}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Run Task */}
      <div className="card p-5">
        <h2 className="text-h3 text-text-primary mb-3 flex items-center gap-2">
          <Bot className="w-4 h-4 text-accent-secondary" />
          Run Autonomous Task
        </h2>
        <textarea
          value={taskDesc}
          onChange={(e) => setTaskDesc(e.target.value)}
          placeholder="Describe the task (e.g. 'Fix all TypeScript errors in the project')"
          rows={3}
          className="input resize-y mb-3"
        />
        <div className="flex items-center gap-3 mb-3">
          <input value={cwd} onChange={(e) => setCwd(e.target.value)} placeholder="Working directory" className="input flex-1" />
          <label className="flex items-center gap-2 text-small text-text-secondary cursor-pointer">
            <input type="checkbox" checked={autoFix} onChange={(e) => setAutoFix(e.target.checked)} className="rounded" />
            Auto-fix
          </label>
          <button onClick={handleRunTask} disabled={running || !taskDesc.trim()} className="btn-primary">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Task
          </button>
        </div>
      </div>

      {/* HyperAgent & Curiosity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-h3 text-text-primary flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent-primary" />
              Hyper-Agent
            </h2>
            <button onClick={handleHyperCycle} disabled={runningHyper} className="btn-secondary text-caption flex items-center gap-1">
              {runningHyper ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              Run Cycle
            </button>
          </div>
          {hyperStats ? (
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-small text-text-secondary">Cycles</span><span className="text-sm font-medium text-text-primary">{hyperStats.cycles}</span></div>
              <div className="flex justify-between"><span className="text-small text-text-secondary">Improvements</span><span className="text-sm font-medium text-success">{hyperStats.improvements}</span></div>
              <div className="flex justify-between"><span className="text-small text-text-secondary">Evaluations</span><span className="text-sm font-medium text-text-primary">{hyperStats.evaluations}</span></div>
            </div>
          ) : (
            <p className="text-small text-text-muted">No hyper-agent data yet</p>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-h3 text-text-primary flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-accent-secondary" />
            Curiosity Engine
          </h2>
          {curiosityStats ? (
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-small text-text-secondary">Total Questions</span><span className="text-sm font-medium text-text-primary">{curiosityStats.totalQuestions}</span></div>
              <div className="flex justify-between"><span className="text-small text-text-secondary">Explored</span><span className="text-sm font-medium text-success">{curiosityStats.explored}</span></div>
              <div className="flex justify-between"><span className="text-small text-text-secondary">Unanswered</span><span className="text-sm font-medium text-warning">{curiosityStats.unanswered}</span></div>
            </div>
          ) : (
            <p className="text-small text-text-muted">No curiosity data yet</p>
          )}
        </div>
      </div>

      {/* Task History */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 className="text-h3 text-text-primary">Task History</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bot className="w-10 h-10 text-text-muted mb-3" />
            <p className="text-small text-text-secondary">No tasks yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {tasks.map((task) => (
              <div key={task.id} className="px-5 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-text-primary truncate">{task.description}</span>
                  <span className={cn(
                    'badge text-caption',
                    task.status === 'completed' && 'bg-success/10 text-success',
                    task.status === 'failed' && 'bg-error/10 text-error',
                    task.status === 'running' && 'bg-accent-primary/10 text-accent-primary',
                  )}>
                    {task.status}
                  </span>
                </div>
                {task.summary && <p className="text-caption text-text-secondary">{task.summary}</p>}
                <div className="flex items-center gap-3 mt-1 text-caption text-text-muted">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(task.startedAt).toLocaleString()}</span>
                  <span>{task.results.length} checks</span>
                  {task.autoFix && <span className="flex items-center gap-1"><Wrench className="w-3 h-3" />auto-fix</span>}
                </div>
                {task.results.length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    {task.results.map((r, i) => (
                      <span key={i} className={cn(
                        'badge text-caption',
                        r.passed ? 'bg-success/10 text-success' : 'bg-error/10 text-error',
                      )}>
                        {r.type}: {r.passed ? '✓' : `${r.errors.length} errors`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
