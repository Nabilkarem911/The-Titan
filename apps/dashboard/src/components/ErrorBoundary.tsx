import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-void p-8">
          <div className="card p-8 max-w-md w-full text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-error/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-error" />
            </div>
            <h2 className="text-h3 text-text-primary mb-2">Something went wrong</h2>
            <p className="text-small text-text-secondary mb-6">
              {this.state.error?.message ?? 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
