import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-6">
        <AlertCircle className="h-8 w-8 text-red-400" />
      </div>
      <h1 className="text-4xl font-bold text-white mb-2">404</h1>
      <p className="text-lg text-slate-400 mb-1">Page not found</p>
      <p className="text-sm text-slate-500 mb-6 max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link to="/" className="btn-primary">
        Go to Dashboard
      </Link>
    </div>
  );
}
