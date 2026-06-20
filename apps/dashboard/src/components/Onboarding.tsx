import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, MessageSquare, Puzzle, Check, X, ArrowRight, ArrowLeft } from 'lucide-react';
import { cn } from '../utils/cn';

const STORAGE_KEY = 'titan:onboardingComplete';

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');
  const navigate = useNavigate();

  if (dismissed) return null;

  const steps = [
    {
      icon: MessageSquare,
      title: 'Start a Chat',
      description: 'Chat with Titan to get things done. Ask questions, write code, or manage files.',
      action: { label: 'Open Chat', path: '/chat' },
    },
    {
      icon: Puzzle,
      title: 'Install Plugins',
      description: 'Browse the plugin library to add new tools and capabilities to your agent.',
      action: { label: 'Browse Plugins', path: '/plugins' },
    },
    {
      icon: Rocket,
      title: 'Run an Agent',
      description: 'Launch autonomous agents that can think, use tools, and complete multi-step tasks.',
      action: { label: 'Go to Agents', path: '/agents' },
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem(STORAGE_KEY, 'true');
      setDismissed(true);
    } else {
      setStep(step + 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 w-80 card p-5 shadow-2xl animate-scale-in origin-bottom-right">
      <button onClick={handleSkip} className="absolute top-3 right-3 btn-icon !w-7 !h-7 text-text-muted hover:text-text-primary">
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === step ? 'w-6 bg-accent-primary' : i < step ? 'w-1.5 bg-accent-primary/50' : 'w-1.5 bg-border-default',
              )}
            />
          ))}
        </div>
        <span className="text-caption text-text-muted ml-auto">Step {step + 1}/{steps.length}</span>
      </div>

      <div className="w-12 h-12 rounded-card bg-accent-primary/10 flex items-center justify-center mb-3">
        <current.icon className="w-6 h-6 text-accent-primary" />
      </div>

      <h3 className="text-h3 text-text-primary mb-1">{current.title}</h3>
      <p className="text-small text-text-secondary mb-4">{current.description}</p>

      <div className="flex items-center gap-2">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="btn-secondary flex items-center gap-1 text-sm">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
        )}
        <button
          onClick={() => navigate(current.action.path)}
          className="btn-secondary flex items-center gap-1 text-sm"
        >
          {current.action.label}
        </button>
        <button onClick={handleNext} className="btn-primary flex items-center gap-1 text-sm ml-auto">
          {isLast ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Done
            </>
          ) : (
            <>
              Next
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
