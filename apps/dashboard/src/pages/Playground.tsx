import { useState } from 'react';
import { FlaskConical, Send } from 'lucide-react';
import { api } from '../api/client';

export default function Playground() {
  const [method, setMethod] = useState('GET');
  const [path, setPath] = useState('/health/ready');
  const [body, setBody] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-h1 text-text-primary flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-accent-tertiary" />
          Playground
        </h1>
        <p className="text-small text-text-secondary mt-1">Test API endpoints directly</p>
      </div>

      <div className="card p-4 mb-4">
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
