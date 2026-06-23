import { useState, useEffect, useCallback } from 'react';
import { Orbit, Loader2, RefreshCw, Network, Activity } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';

interface WorldSimStats {
  entities: number;
  relations: number;
  events: number;
}

interface DigitalTwinState {
  snapshotCount: number;
  entityCount: number;
  relationCount: number;
  lastSnapshot: unknown;
  trends: unknown[];
  alerts: unknown[];
}

export default function WorldModel() {
  const [graphStats, setGraphStats] = useState<WorldSimStats | null>(null);
  const [twinState, setTwinState] = useState<DigitalTwinState | null>(null);
  const [loading, setLoading] = useState(true);
  const [scenario, setScenario] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [graph, twin] = await Promise.all([
        api.get<WorldSimStats>('/world/graph/stats').catch(() => null),
        api.get<DigitalTwinState>('/digital-twin/state').catch(() => null),
      ]);
      setGraphStats(graph);
      setTwinState(twin);
    } catch {
      toast.error('Failed to load world model data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSimulate = async () => {
    if (!scenario.trim()) return;
    setSimulating(true);
    try {
      const res = await api.post('/world/simulate', { scenario });
      setSimResult(res);
      toast.success('Simulation complete');
    } catch {
      toast.error('Simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-text-primary flex items-center gap-2">
            <Orbit className="w-6 h-6 text-accent-primary" />
            World Model
          </h1>
          <p className="text-small text-text-secondary mt-1">World simulator, environment graph, digital twin, and causal replay</p>
        </div>
        <button onClick={load} className="btn-ghost flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {graphStats && (
          <>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2"><Network className="w-4 h-4 text-accent-primary" /><span className="text-small text-text-secondary">Entities</span></div>
              <p className="text-h2 font-bold text-text-primary">{graphStats.entities}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2"><Activity className="w-4 h-4 text-accent-secondary" /><span className="text-small text-text-secondary">Relations</span></div>
              <p className="text-h2 font-bold text-text-primary">{graphStats.relations}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2"><Orbit className="w-4 h-4 text-accent-tertiary" /><span className="text-small text-text-secondary">Events</span></div>
              <p className="text-h2 font-bold text-text-primary">{graphStats.events}</p>
            </div>
            {twinState && (
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-2"><Activity className="w-4 h-4 text-success" /><span className="text-small text-text-secondary">Snapshots</span></div>
                <p className="text-h2 font-bold text-text-primary">{twinState.snapshotCount}</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-h3 text-text-primary mb-4">Run World Simulation</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            placeholder="Scenario to simulate (e.g. 'restart database server')"
            className="input flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleSimulate()}
          />
          <button onClick={handleSimulate} disabled={simulating || !scenario.trim()} className="btn-primary flex items-center gap-2">
            {simulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Orbit className="w-4 h-4" />}
            Simulate
          </button>
        </div>
        {simResult !== null && (
          <div className="mt-4 p-4 rounded-btn bg-elevated">
            <pre className="text-small text-text-secondary overflow-x-auto">{JSON.stringify(simResult, null, 2)}</pre>
          </div>
        )}
      </div>

      {twinState && twinState.alerts && Array.isArray(twinState.alerts) && twinState.alerts.length > 0 && (
        <div className="card p-5">
          <h2 className="text-h3 text-text-primary mb-3">Predictive Alerts</h2>
          <div className="divide-y divide-border-subtle">
            {twinState.alerts.map((alert: any, i: number) => (
              <div key={i} className="py-2">
                <p className="text-sm text-text-primary">{String(alert?.description ?? alert?.message ?? 'Alert')}</p>
                <span className="text-caption text-text-muted">{alert?.severity ?? 'info'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
