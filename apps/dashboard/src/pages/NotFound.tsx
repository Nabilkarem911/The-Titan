import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-6xl font-bold text-cyan-400 mb-4">404</h1>
      <p className="text-xl text-slate-300 mb-8">Page not found</p>
      <Link
        to="/"
        className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
