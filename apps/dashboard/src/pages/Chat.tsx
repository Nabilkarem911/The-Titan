import { useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/PageState';

export default function Chat() {
  const [message, setMessage] = useState('');
  const [messages] = useState<Array<{ role: string; content: string }>>([]);
  const [loading] = useState(false);

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-500/10">
          <MessageSquare className="h-5 w-5 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Chat</h2>
          <p className="text-sm text-slate-400">Interact with your agents in real time</p>
        </div>
      </div>

      {/* Messages area */}
      <div className="card min-h-[400px] flex flex-col">
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-6 w-6 text-slate-400" />}
              title="No messages yet"
              description="Start a conversation with an agent."
            />
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`mb-3 p-3 rounded-lg text-sm ${
                  msg.role === 'user'
                    ? 'bg-indigo-500/10 text-indigo-200 ml-8'
                    : 'bg-slate-800 text-slate-300 mr-8'
                }`}
              >
                {msg.content}
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div className="border-t border-slate-800 p-4 flex gap-2">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="input flex-1"
          />
          <button className="btn-primary">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
