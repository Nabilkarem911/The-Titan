import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/layout/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PageSkeleton } from './components/LoadingSkeleton';

// ── Lazy-loaded pages ──
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Chat = lazy(() => import('./pages/Chat'));
const Agents = lazy(() => import('./pages/Agents'));
const Runs = lazy(() => import('./pages/Runs'));
const Files = lazy(() => import('./pages/Files'));
const Terminal = lazy(() => import('./pages/Terminal'));
const Swarm = lazy(() => import('./pages/Swarm'));
const Playground = lazy(() => import('./pages/Playground'));
const Queue = lazy(() => import('./pages/Queue'));
const Health = lazy(() => import('./pages/Health'));
const Metrics = lazy(() => import('./pages/Metrics'));
const ApiKeys = lazy(() => import('./pages/ApiKeys'));
const Webhooks = lazy(() => import('./pages/Webhooks'));
const Cron = lazy(() => import('./pages/Cron'));
const Plugins = lazy(() => import('./pages/Plugins'));
const Workspaces = lazy(() => import('./pages/Workspaces'));
const Settings = lazy(() => import('./pages/Settings'));
const Memory = lazy(() => import('./pages/Memory'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));

// ── Protected Layout ──
function ProtectedLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-void">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-text-muted text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout />;
}

// ── App ──
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="chat" element={<Chat />} />
              <Route path="agents" element={<Agents />} />
              <Route path="runs" element={<Runs />} />
              <Route path="files" element={<Files />} />
              <Route path="terminal" element={<Terminal />} />
              <Route path="swarm" element={<Swarm />} />
              <Route path="playground" element={<Playground />} />
              <Route path="queue" element={<Queue />} />
              <Route path="health" element={<Health />} />
              <Route path="metrics" element={<Metrics />} />
              <Route path="api-keys" element={<ApiKeys />} />
              <Route path="webhooks" element={<Webhooks />} />
              <Route path="cron" element={<Cron />} />
              <Route path="plugins" element={<Plugins />} />
              <Route path="workspaces" element={<Workspaces />} />
              <Route path="settings" element={<Settings />} />
              <Route path="memory" element={<Memory />} />
              <Route path="audit-logs" element={<AuditLogs />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1A2234',
              border: '1px solid #334155',
              color: '#F1F5F9',
            },
          }}
        />
      </AuthProvider>
    </ErrorBoundary>
  );
}
