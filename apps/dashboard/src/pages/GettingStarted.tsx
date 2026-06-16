import { Link } from 'react-router-dom';
import {
  Rocket,
  MessageSquare,
  Bot,
  FileCode,
  Bug,
  Users,
  Settings,
  KeyRound,
  Zap,
  ArrowRight,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';

const STEPS = [
  {
    icon: <Settings className="h-5 w-5" />,
    title: 'Configure Settings',
    desc: 'Set up your profile and add LLM provider keys.',
    to: '/settings',
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  },
  {
    icon: <MessageSquare className="h-5 w-5" />,
    title: 'Start a Chat',
    desc: 'Talk to Titan — ask questions, delegate tasks, or brainstorm ideas.',
    to: '/chat',
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    icon: <Bot className="h-5 w-5" />,
    title: 'Create an Agent',
    desc: 'Browse agents or build custom agent profiles for specific workflows.',
    to: '/agents',
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  },
  {
    icon: <FileCode className="h-5 w-5" />,
    title: 'Save a Template',
    desc: 'Save agent configurations as reusable templates and share them.',
    to: '/templates',
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: 'Invite Your Team',
    desc: 'Add members to workspaces and collaborate on agent tasks.',
    to: '/teams',
    color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  },
  {
    icon: <KeyRound className="h-5 w-5" />,
    title: 'Generate API Keys',
    desc: 'Create programmatic API keys to integrate Titan into your stack.',
    to: '/api-keys',
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  },
];

const FEATURES = [
  { icon: <Zap className="h-4 w-4" />, label: 'Real-time streaming', desc: 'Watch agents think step-by-step' },
  { icon: <Bug className="h-4 w-4" />, label: 'Swarm mode', desc: 'Multi-agent collaboration' },
  { icon: <BookOpen className="h-4 w-4" />, label: 'API-first', desc: 'Every feature is HTTP/WS addressable' },
  { icon: <CheckCircle2 className="h-4 w-4" />, label: 'Audit logs', desc: 'Immutable tamper-evident trail' },
];

export default function GettingStartedPage() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Hero */}
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/20 text-indigo-400 mb-4">
          <Rocket className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Welcome to Titan</h1>
        <p className="text-slate-400 text-sm max-w-lg mx-auto">
          Your universal autonomous agent framework. Chat, delegate, and orchestrate AI agents — all from one dashboard.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {FEATURES.map((f) => (
          <div key={f.label} className="card p-3 flex items-center gap-3">
            <div className="text-indigo-400">{f.icon}</div>
            <div>
              <div className="text-xs font-medium text-slate-200">{f.label}</div>
              <div className="text-[10px] text-slate-500">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Steps */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Getting Started</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {STEPS.map((step, i) => (
            <Link
              key={step.title}
              to={step.to}
              className="card p-4 hover:bg-slate-800/40 transition-colors group"
            >
              <div className="flex items-start justify-between mb-2">
                <div className={`flex items-center justify-center w-9 h-9 rounded-lg border ${step.color}`}>
                  {step.icon}
                </div>
                <span className="text-xs text-slate-600">{i + 1}</span>
              </div>
              <h3 className="text-sm font-medium text-slate-200 mb-1 group-hover:text-white transition-colors">
                {step.title}
              </h3>
              <p className="text-xs text-slate-500">{step.desc}</p>
              <div className="mt-2 flex items-center gap-1 text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                Go <ArrowRight className="h-3 w-3" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Links */}
      <div className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white">Resources</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <a href="https://github.com/Nabilkarem911/The-Titan" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800 transition-colors text-xs text-slate-300">
            <BookOpen className="h-4 w-4 text-slate-500" />
            GitHub Repository
          </a>
          <Link to="/api-docs" className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800 transition-colors text-xs text-slate-300">
            <BookOpen className="h-4 w-4 text-slate-500" />
            API Documentation
          </Link>
          <Link to="/health" className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800 transition-colors text-xs text-slate-300">
            <Zap className="h-4 w-4 text-slate-500" />
            System Health
          </Link>
        </div>
      </div>
    </div>
  );
}
