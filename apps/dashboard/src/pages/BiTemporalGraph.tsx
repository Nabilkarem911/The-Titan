import { useState, useCallback } from 'react';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { Network, RefreshCw, Plus, Search, Zap } from 'lucide-react';
import { ErrorState } from '../components/PageState';
import { PageHeader } from '../components/PageHeader';
import { SkeletonCard } from '../components/LoadingSkeleton';
import { toast } from 'sonner';

interface GraphStats {
  totalFacts: number;
  activeFacts: number;
  supersededFacts: number;
  totalConflicts: number;
  totalNodes: number;
  totalEdges: number;
  avgSalience: number;
}

interface BiTemporalFact {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  validTimeStart: string;
  transactionTimeStart: string;
  validTimeEnd?: string;
  transactionTimeEnd?: string;
  supersededBy?: string;
  salience: number;
  source: string;
}

export default function BiTemporalGraph() {
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useApi<GraphStats>('/graph/stats');
  const { data: conflictsData, refetch: refetchConflicts } = useApi<{ items: Array<{ id: string; type: string; resolution: string; resolvedAt: string }> }>('/graph/conflicts');
  const [showAddForm, setShowAddForm] = useState(false);
  const [facts, setFacts] = useState<BiTemporalFact[]>([]);
  const [querySubject, setQuerySubject] = useState('');
  const [querying, setQuerying] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    predicate: '',
    object: '',
    source: 'dashboard',
    salience: '50',
  });

  const handleAddFact = useCallback(async () => {
    if (!formData.subject.trim() || !formData.predicate.trim() || !formData.object.trim()) {
      toast.error('Subject, predicate, and object are required');
      return;
    }
    try {
      await api.post('/graph/facts', {
        subject: formData.subject,
        predicate: formData.predicate,
        object: formData.object,
        source: formData.source,
        salience: parseFloat(formData.salience) || 50,
      });
      toast.success('Fact added');
      setShowAddForm(false);
      setFormData({ subject: '', predicate: '', object: '', source: 'dashboard', salience: '50' });
      refetchStats();
      refetchConflicts();
    } catch {
      toast.error('Failed to add fact');
    }
  }, [formData, refetchStats, refetchConflicts]);

  const handleQuery = useCallback(async () => {
    if (!querySubject.trim()) {
      toast.error('Enter a subject to query');
      return;
    }
    setQuerying(true);
    try {
      const result = await api.get<{ items: BiTemporalFact[]; total: number }>(`/graph/facts?subject=${encodeURIComponent(querySubject)}`);
      setFacts(result.items);
    } catch {
      toast.error('Query failed');
    } finally {
      setQuerying(false);
    }
  }, [querySubject]);

  const handleReinforce = useCallback(async (factId: string) => {
    try {
      await api.post(`/graph/facts/${factId}/reinforce`, {});
      toast.success('Fact reinforced');
      handleQuery();
    } catch {
      toast.error('Failed to reinforce');
    }
  }, [handleQuery]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto animate-fade-in">
      <PageHeader
        icon={Network}
        title="Bi-Temporal Knowledge Graph"
        subtitle="Facts with valid-time + transaction-time, supersession & traversal"
        description="The Bi-Temporal Knowledge Graph stores facts with two timelines: valid-time (when the fact was true in reality) and transaction-time (when it was recorded in the system). This means Titan can answer questions like 'what did we know on Tuesday?' and 'when did this fact stop being true?'. Facts can be superseded by newer ones, and conflicts are tracked and resolved. Use this page to add facts, query the graph, and view conflicts."
        tips={[
          'Add facts as subject-predicate-object triples (e.g. Alice — works at — Acme)',
          'Query by subject to see all facts about an entity, including superseded ones',
          'Conflicts are detected when two facts contradict each other',
          'Salience controls how prominent a fact is in Titan\'s reasoning',
        ]}
        actions={
          <div className="flex gap-2">
            <button onClick={() => { refetchStats(); refetchConflicts(); }} className="btn-secondary">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary">
              <Plus className="w-4 h-4" />
              Add Fact
            </button>
          </div>
        }
      />

      {statsError && <ErrorState message={statsError} onRetry={refetchStats} />}

      {showAddForm && (
        <div className="card p-5 space-y-4">
          <h2 className="text-h3 text-text-primary">Add Fact</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-small text-text-secondary">Subject</label>
              <input className="input-field mt-1" value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} placeholder="user:alice" />
            </div>
            <div>
              <label className="text-small text-text-secondary">Predicate</label>
              <input className="input-field mt-1" value={formData.predicate} onChange={e => setFormData({ ...formData, predicate: e.target.value })} placeholder="lives_in" />
            </div>
            <div>
              <label className="text-small text-text-secondary">Object</label>
              <input className="input-field mt-1" value={formData.object} onChange={e => setFormData({ ...formData, object: e.target.value })} placeholder="Cairo" />
            </div>
            <div>
              <label className="text-small text-text-secondary">Source</label>
              <input className="input-field mt-1" value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })} />
            </div>
            <div>
              <label className="text-small text-text-secondary">Salience (0-100)</label>
              <input type="number" className="input-field mt-1" value={formData.salience} onChange={e => setFormData({ ...formData, salience: e.target.value })} />
            </div>
          </div>
          <button onClick={handleAddFact} className="btn-primary">Add Fact</button>
        </div>
      )}

      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-h2 font-bold text-accent-primary tabular-nums">{stats.totalFacts}</p>
            <p className="text-caption text-text-muted">Total Facts</p>
          </div>
          <div className="card p-4">
            <p className="text-h2 font-bold text-success tabular-nums">{stats.activeFacts}</p>
            <p className="text-caption text-text-muted">Active</p>
          </div>
          <div className="card p-4">
            <p className="text-h2 font-bold text-warning tabular-nums">{stats.supersededFacts}</p>
            <p className="text-caption text-text-muted">Superseded</p>
          </div>
          <div className="card p-4">
            <p className="text-h2 font-bold text-error tabular-nums">{stats.totalConflicts}</p>
            <p className="text-caption text-text-muted">Conflicts</p>
          </div>
        </div>
      ) : null}

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-5 h-5 text-accent-primary" />
          <h2 className="text-h3 text-text-primary">Query Facts</h2>
        </div>
        <div className="flex gap-2">
          <input
            className="input-field flex-1"
            placeholder="Enter subject (e.g. user:alice)..."
            value={querySubject}
            onChange={e => setQuerySubject(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleQuery()}
          />
          <button onClick={handleQuery} disabled={querying} className="btn-primary">
            <Search className="w-4 h-4" />
            {querying ? 'Querying...' : 'Query'}
          </button>
        </div>
        {facts.length > 0 && (
          <div className="mt-4 space-y-2">
            {facts.map((f) => (
              <div key={f.id} className={`p-3 rounded-btn border ${f.supersededBy ? 'border-border-subtle bg-void/50 opacity-60' : 'border-border-subtle bg-elevated'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-small font-medium text-text-primary">{f.subject}</span>
                  <span className="text-caption text-accent-primary">→{f.predicate}→</span>
                  <span className="text-small font-medium text-text-primary">{f.object}</span>
                  {f.supersededBy && <span className="px-2 py-0.5 rounded text-caption bg-warning/10 text-warning">SUPERSEDED</span>}
                  <span className="text-caption text-text-muted ml-auto">salience: {f.salience.toFixed(0)}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-caption text-text-muted">
                  <span>valid: {new Date(f.validTimeStart).toLocaleDateString()}</span>
                  <span>tx: {new Date(f.transactionTimeStart).toLocaleDateString()}</span>
                  <span>source: {f.source}</span>
                  {!f.supersededBy && (
                    <button onClick={() => handleReinforce(f.id)} className="text-accent-primary hover:text-accent-primary/80 ml-auto">
                      <Zap className="w-3 h-3 inline" /> Reinforce
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-h3 text-text-primary mb-3">Conflict Resolution History</h2>
        {conflictsData?.items.length ? (
          <div className="space-y-2">
            {conflictsData.items.map((c) => (
              <div key={c.id} className="p-3 rounded-btn bg-elevated">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-caption bg-warning/10 text-warning">{c.type}</span>
                  <span className="text-small text-text-secondary flex-1">{c.resolution}</span>
                  <span className="text-caption text-text-muted">{new Date(c.resolvedAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-small text-text-muted">No conflicts recorded</p>
        )}
      </div>
    </div>
  );
}
