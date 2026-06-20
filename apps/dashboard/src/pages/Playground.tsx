import React, { useState, useCallback } from 'react';
import { Play, Square, RotateCcw, Settings2, Copy, CheckCheck } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { classNames } from '../utils/format';
import { ErrorState } from '../components/PageState';
import type { AgentProfile } from '../api/client';

export default function Playground() {
  const [selectedAgent, setSelectedAgent] = useState('');
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [showSettings, setShowSettings] = useState(false);

  const { data: agents, error, isLoading, refetch } = useApi<AgentProfile[]>(
    () => api.getAgents(),
    []
  );

  const handleRun = useCallback(async () => {
    if (!prompt.trim() || !selectedAgent || isRunning) return;
    setIsRunning(true);
    setOutput('');

    try {
      const result = await api.sendMessage(selectedAgent, prompt);
      setOutput(result.message.content);
    } catch (err) {
      setOutput(`Error: ${err instanceof Error ? err.message : 'Request failed'}`);
    } finally {
      setIsRunning(false);
    }
  }, [prompt, selectedAgent, isRunning]);

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4 h-[calc(100vh-8rem)] flex flex-col">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="input w-64"
          disabled={isLoading}
        >
          <option value="">Select agent...</option>
          {agents?.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <button
          onClick={handleRun}
          disabled={isRunning || !prompt.trim() || !selectedAgent}
          className="btn btn-primary"
        >
          {isRunning ? (
            <><Square className="w-4 h-4" /> Running...</>
          ) : (
            <><Play className="w-4 h-4" /> Run</>
          )}
        </button>

        <button onClick={() => { setOutput(''); setPrompt(''); }} className="btn btn-secondary btn-sm">
          <RotateCcw className="w-4 h-4" /> Clear
        </button>

        <button
          onClick={() => setShowSettings(!showSettings)}
          className={classNames('btn btn-ghost btn-sm', showSettings && 'text-cyan')}
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="card p-4 flex gap-6 flex-wrap">
          <div>
            <label className="text-xs text-text-muted block mb-1">Temperature</label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-32"
            />
            <span className="text-xs text-text-secondary ms-2 font-mono">{temperature}</span>
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Max Tokens</label>
            <input
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              className="input w-28 text-sm"
            />
          </div>
        </div>
      )}

      {/* Split pane */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
        <div className="flex flex-col card overflow-hidden">
          <div className="px-4 py-2 border-b border-border text-xs font-semibold text-text-muted uppercase tracking-wider">Input</div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt..."
            className="flex-1 w-full p-4 bg-transparent text-text-primary text-sm font-mono outline-none resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleRun(); }
            }}
          />
        </div>

        <div className="flex flex-col card overflow-hidden">
          <div className="px-4 py-2 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Output</span>
            {output && (
              <button onClick={handleCopy} className="btn btn-ghost p-1">
                {copied ? <CheckCheck className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
            {isRunning ? (
              <div className="flex items-center gap-2 text-text-muted text-sm">
                <div className="w-4 h-4 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
                Processing...
              </div>
            ) : output ? (
              <pre className="text-sm text-text-primary whitespace-pre-wrap font-mono">{output}</pre>
            ) : (
              <p className="text-text-muted text-sm">Output will appear here</p>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-text-muted">Ctrl+Enter to run</p>
    </div>
  );
}
