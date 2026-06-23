import { useState } from 'react';
import { FlaskConical, Send, Globe, Heart, Brain, Clock, Loader2 } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';

export default function Playground() {
  const [method, setMethod] = useState('GET');
  const [path, setPath] = useState('/health/ready');
  const [body, setBody] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [quickResult, setQuickResult] = useState<string | null>(null);
  const [quickLoading, setQuickLoading] = useState<string | null>(null);

  const handleSend = async () => {
    setIsLoading(true);
    setResponse(null);
    try {
      let result: unknown;
      if (method === 'GET') result = await api.get(path);
      else if (method === 'POST') result = await api.post(path, body ? JSON.parse(body) : undefined);
      else if (method === 'PATCH') result = await api.patch(path, body ? JSON.parse(body) : undefined);
      else if (method === 'PUT') result = await api.put(path, body ? JSON.parse(body) : undefined);
      else if (method === 'DELETE') result = await api.delete(path);
      setResponse(JSON.stringify(result, null, 2));
    } catch (err) {
      setResponse(JSON.stringify({ error: err instanceof Error ? err.message : 'Failed' }, null, 2));
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = async (action: string, endpoint: string, payload?: Record<string, unknown>) => {
    setQuickLoading(action);
    setQuickResult(null);
    try {
      const result = await api.post(endpoint, payload ?? {});
      setQuickResult(JSON.stringify(result, null, 2));
      toast.success(`${action} completed`);
    } catch (err) {
      setQuickResult(JSON.stringify({ error: err instanceof Error ? err.message : 'Failed' }, null, 2));
      toast.error(`${action} failed`);
    } finally {
      setQuickLoading(null);
    }
  };

  const quickActions = [
    { label: 'Translate', icon: Globe, endpoint: '/reasoning/translate', payload: { text: 'Hello world', targetLang: 'ar' }, color: 'text-accent-primary' },
    { label: 'Emotion Analysis', icon: Heart, endpoint: '/emotion/analyze', payload: { message: 'I am feeling great today!' }, color: 'text-accent-secondary' },
    { label: 'Theory of Mind', icon: Brain, endpoint: '/tom/analyze', payload: { targetEntityId: 'user-1', messages: [{ role: 'user', content: 'I am confused about the API' }] }, color: 'text-accent-tertiary' },
    { label: 'Temporal Analysis', icon: Clock, endpoint: '/reasoning/temporal', payload: { text: 'What happened yesterday?' }, color: 'text-warning' },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <PageHeader
        icon={FlaskConical}
        title="Playground"
        subtitle="Test API endpoints and AI capabilities directly"
        description="The Playground is a sandbox for testing Titan's AI capabilities and API endpoints. You can send any HTTP request to the Titan API, or use quick actions to test specific features like translation, emotion analysis, theory of mind, and temporal reasoning. Perfect for developers exploring the API or users curious about what Titan can do."
        tips={[
          'Use the API tester below to send any GET/POST/PUT/DELETE request',
          'Quick Actions test specific AI features with pre-filled examples',
          'Try: POST /health/ready to check if the server is running',
          'Quick Actions are also available from chat: titan chat "translate Hello to Arabic"',
        ]}
      />

      {/* Quick Actions */}
      <div className="card p-4 mb-4">
        <h2 className="text-h3 text-text-primary mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => handleQuickAction(action.label, action.endpoint, action.payload)}
              disabled={quickLoading !== null}
              className="btn-secondary flex flex-col items-center gap-2 py-3"
            >
              {quickLoading === action.label ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <action.icon className={`w-5 h-5 ${action.color}`} />
              )}
              <span className="text-caption">{action.label}</span>
            </button>
          ))}
        </div>
        {quickResult && (
          <div className="mt-3">
            <pre className="text-small font-mono text-text-primary overflow-x-auto whitespace-pre-wrap bg-elevated p-3 rounded-btn">{quickResult}</pre>
          </div>
        )}
      </div>

      {/* API Tester */}
      <div className="card p-4 mb-4">
        <h2 className="text-h3 text-text-primary mb-3">API Tester</h2>
        <div className="flex gap-2 mb-3">
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="input w-32">
            <option>GET</option>
            <option>POST</option>
            <option>PATCH</option>
            <option>PUT</option>
            <option>DELETE</option>
          </select>
          <input value={path} onChange={(e) => setPath(e.target.value)} className="input flex-1 font-mono" placeholder="/api/v1/..." />
          <button onClick={handleSend} disabled={isLoading} className="btn-primary">
            {isLoading ? <span className="w-4 h-4 border-2 border-void border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
            Send
          </button>
        </div>
        {method !== 'GET' && method !== 'DELETE' && (
          <textarea value={body} onChange={(e) => setBody(e.target.value)} className="input font-mono" rows={4} placeholder='{"key": "value"}' />
        )}
      </div>

      {response && (
        <div className="card p-4">
          <p className="text-label text-text-secondary mb-2">Response</p>
          <pre className="text-small font-mono text-text-primary overflow-x-auto whitespace-pre-wrap">{response}</pre>
        </div>
      )}
    </div>
  );
}

