import { Compass } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-void p-8">
      <div className="w-20 h-20 rounded-card bg-elevated flex items-center justify-center mb-6">
        <Compass className="w-10 h-10 text-text-muted" />
      </div>
      <h1 className="text-display text-text-primary mb-2">404</h1>
      <p className="text-body text-text-secondary mb-6">This page drifted off course</p>
      <button onClick={() => navigate('/')} className="btn-primary">
        Back to dashboard
      </button>
    </div>
  );
}
