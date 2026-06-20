import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { NotificationProvider } from './contexts/NotificationContext';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { PageSkeleton } from './components/LoadingSkeleton';

// ── Lazy-loaded pages ────────────────────────────────────────────────────────
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Chat = lazy(() => import('./pages/Chat'));
const Agents = lazy(() => import('./pages/Agents'));
const Playground = lazy(() => import('./pages/Playground'));
const Files = lazy(() => import('./pages/Files'));
const Runs = lazy(() => import('./pages/Runs'));
const TerminalPage = lazy(() => import('./pages/Terminal'));
const Queue = lazy(() => import('./pages/Queue'));
const Cron = lazy(() => import('./pages/Cron'));
const Logs = lazy(() => import('./pages/Logs'));
const Health = lazy(() => import('./pages/Health'));
const Metrics = lazy(() => import('./pages/Metrics'));
const Webhooks = lazy(() => import('./pages/Webhooks'));
const Plugins = lazy(() => import('./pages/Plugins'));
const ApiKeys = lazy(() => import('./pages/ApiKeys'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const Git = lazy(() => import('./pages/Git'));
const Swarm = lazy(() => import('./pages/Swarm'));
const Workspaces = lazy(() => import('./pages/Workspaces'));
const Memory = lazy(() => import('./pages/Memory'));
const NotFound = lazy(() => import('./pages/NotFound'));

// ── Protected Layout ─────────────────────────────────────────────────────────
function ProtectedLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-deep">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
          <span className="text-text-muted text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <NotificationProvider>
      <Layout />
    </NotificationProvider>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="chat" element={<Chat />} />
            <Route path="agents" element={<Agents />} />
            <Route path="playground" element={<Playground />} />
            <Route path="files" element={<Files />} />
            <Route path="runs" element={<Runs />} />
            <Route path="terminal" element={<TerminalPage />} />
            <Route path="queue" element={<Queue />} />
            <Route path="cron" element={<Cron />} />
            <Route path="logs" element={<Logs />} />
            <Route path="health" element={<Health />} />
            <Route path="metrics" element={<Metrics />} />
            <Route path="webhooks" element={<Webhooks />} />
            <Route path="plugins" element={<Plugins />} />
            <Route path="api-keys" element={<ApiKeys />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="git" element={<Git />} />
            <Route path="swarm" element={<Swarm />} />
            <Route path="workspaces" element={<Workspaces />} />
            <Route path="memory" element={<Memory />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
