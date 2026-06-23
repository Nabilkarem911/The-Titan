import { useState, useCallback } from 'react';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { Shield, RefreshCw, ScanLine, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { ErrorState } from '../components/PageState';
import { PageHeader } from '../components/PageHeader';
import { SkeletonCard } from '../components/LoadingSkeleton';
import { toast } from 'sonner';

interface GuardrailStats {
  totalChecks: number;
  blocked: number;
  sanitized: number;
  allowed: number;
  warned: number;
  blockRate: number;
}

interface GuardrailResult {
  id: string;
  input: string;
  output?: string;
  finalAction: 'allow' | 'block' | 'warn' | 'sanitize';
  finalReason: string;
  sanitizedInput?: string;
  sanitizedOutput?: string;
  layerResults: Array<{
    layer: string;
    action: string;
    reason: string;
    severity: string;
  }>;
  durationMs: number;
  timestamp: string;
}

export default function Guardrails() {
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useApi<GuardrailStats>('/guardrails/stats');
  const { data: resultsData, refetch: refetchResults } = useApi<{ items: GuardrailResult[]; total: number }>('/guardrails/results');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [checkMode, setCheckMode] = useState<'input' | 'output'>('input');
  const [checking, setChecking] = useState(false);
  const [lastResult, setLastResult] = useState<GuardrailResult | null>(null);

  const handleCheck = useCallback(async () => {
    if (!inputText.trim()) {
      toast.error('Input text is required');
      return;
    }
    setChecking(true);
    try {
      const endpoint = checkMode === 'input' ? '/guardrails/check-input' : '/guardrails/check-output';
      const body = checkMode === 'input' ? { input: inputText } : { input: inputText, output: outputText };
      const result = await api.post<GuardrailResult>(endpoint, body);
      setLastResult(result);
      refetchResults();
      refetchStats();
      if (result.finalAction === 'block') {
        toast.error(`Blocked: ${result.finalReason}`);
      } else if (result.finalAction === 'sanitize') {
        toast.warning(`Sanitized: ${result.finalReason}`);
      } else {
        toast.success('Input allowed');
      }
    } catch {
      toast.error('Check failed');
    } finally {
      setChecking(false);
    }
  }, [inputText, outputText, checkMode, refetchResults, refetchStats]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto animate-fade-in">
      <PageHeader
        pageKey="guardrails"
        icon={Shield}
        title="Multi-Layer Guardrails"
        subtitle="5-layer defense: input validation → injection → PII → content → output"
        description="Multi-Layer Guardrails protect Titan from malicious inputs and unsafe outputs. Every request passes through 5 layers: (1) Input Validation — schema and type checks, (2) Injection Detection — prevents prompt injection attacks, (3) PII Filter — redacts personal information, (4) Content Filter — blocks harmful content, (5) Output Validation — ensures responses are safe. Use this page to test guardrails and view check results."
        tips={[
          'Type input text and output text below to test all 5 guardrail layers',
          'Each layer can block, warn, or allow the request',
          'PII filter automatically redacts emails, phone numbers, and SSNs',
          'From chat: titan chat "check guardrails for: <your text>"',
        ]}
        actions={
          <button onClick={() => { refetchStats(); refetchResults(); }} className="btn-secondary">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        }
      />

      {statsError && <ErrorState message={statsError} onRetry={refetchStats} />}

      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="card p-4">
            <p className="text-h2 font-bold text-accent-primary tabular-nums">{stats.totalChecks}</p>
            <p className="text-caption text-text-muted">Total Checks</p>
          </div>
          <div className="card p-4">
            <p className="text-h2 font-bold text-success tabular-nums">{stats.allowed}</p>
            <p className="text-caption text-text-muted">Allowed</p>
          </div>
          <div className="card p-4">
            <p className="text-h2 font-bold text-error tabular-nums">{stats.blocked}</p>
            <p className="text-caption text-text-muted">Blocked</p>
          </div>
          <div className="card p-4">
            <p className="text-h2 font-bold text-warning tabular-nums">{stats.sanitized}</p>
            <p className="text-caption text-text-muted">Sanitized</p>
          </div>
          <div className="card p-4">
            <p className="text-h2 font-bold text-text-secondary tabular-nums">{stats.blockRate}%</p>
            <p className="text-caption text-text-muted">Block Rate</p>
          </div>
        </div>
      ) : null}

      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-accent-primary" />
          <h2 className="text-h3 text-text-primary">Guardrail Check</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCheckMode('input')}
            className={checkMode === 'input' ? 'btn-primary' : 'btn-secondary'}
          >Check Input</button>
          <button
            onClick={() => setCheckMode('output')}
            className={checkMode === 'output' ? 'btn-primary' : 'btn-secondary'}
          >Check Output</button>
        </div>
        <div>
          <label className="text-small text-text-secondary">Input Text</label>
          <textarea
            className="input-field mt-1 min-h-[100px]"
            placeholder="Enter text to check..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
          />
        </div>
        {checkMode === 'output' && (
          <div>
            <label className="text-small text-text-secondary">Output Text</label>
            <textarea
              className="input-field mt-1 min-h-[100px]"
              placeholder="Enter output to validate..."
              value={outputText}
              onChange={e => setOutputText(e.target.value)}
            />
          </div>
        )}
        <button onClick={handleCheck} disabled={checking} className="btn-primary">
          <Shield className="w-4 h-4" />
          {checking ? 'Checking...' : 'Run Guardrail Check'}
        </button>
      </div>

      {lastResult && (
        <div className="card p-5 space-y-3">
          <h2 className="text-h3 text-text-primary">Last Check Result</h2>
          <div className="flex items-center gap-3">
            {lastResult.finalAction === 'allow' && <CheckCircle className="w-5 h-5 text-success" />}
            {lastResult.finalAction === 'block' && <XCircle className="w-5 h-5 text-error" />}
            {lastResult.finalAction === 'sanitize' && <AlertTriangle className="w-5 h-5 text-warning" />}
            {lastResult.finalAction === 'warn' && <AlertTriangle className="w-5 h-5 text-warning" />}
            <span className="text-small font-medium text-text-primary uppercase">{lastResult.finalAction}</span>
            <span className="text-small text-text-muted flex-1">{lastResult.finalReason}</span>
            <span className="text-caption text-text-muted">{lastResult.durationMs}ms</span>
          </div>
          {lastResult.sanitizedInput && (
            <div>
              <p className="text-caption text-text-muted mb-1">Sanitized Input</p>
              <pre className="text-small font-mono text-text-secondary bg-elevated p-3 rounded-btn overflow-x-auto">{lastResult.sanitizedInput}</pre>
            </div>
          )}
          <div>
            <p className="text-caption text-text-muted mb-1">Layer Results</p>
            <div className="space-y-1">
              {lastResult.layerResults.map((lr, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-btn bg-elevated text-small">
                  <span className={`px-2 py-0.5 rounded text-caption font-medium ${
                    lr.action === 'allow' ? 'bg-success/10 text-success' :
                    lr.action === 'block' ? 'bg-error/10 text-error' :
                    'bg-warning/10 text-warning'
                  }`}>{lr.action}</span>
                  <span className="text-text-primary font-medium">{lr.layer}</span>
                  <span className="text-text-muted flex-1 truncate">{lr.reason}</span>
                  <span className="text-caption text-text-muted">{lr.severity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="card p-5">
        <h2 className="text-h3 text-text-primary mb-3">Recent Results</h2>
        {resultsData?.items.length ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {resultsData.items.slice().reverse().map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-2 rounded-btn bg-elevated text-small">
                <span className={`px-2 py-0.5 rounded text-caption font-medium ${
                  r.finalAction === 'allow' ? 'bg-success/10 text-success' :
                  r.finalAction === 'block' ? 'bg-error/10 text-error' :
                  'bg-warning/10 text-warning'
                }`}>{r.finalAction}</span>
                <span className="text-text-muted flex-1 truncate">{r.input.slice(0, 80)}</span>
                <span className="text-caption text-text-muted">{r.durationMs}ms</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-small text-text-muted">No results yet</p>
        )}
      </div>
    </div>
  );
}
