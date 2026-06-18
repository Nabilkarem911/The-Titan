import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorToast from './components/ErrorToast';
import Login from './pages/Login';
import { useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ThemeProvider } from './contexts/ThemeContext';

/* ── Lazy-loaded pages ────────────────────────────────────────────── */
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Chat = React.lazy(() => import('./pages/Chat'));
const Agents = React.lazy(() => import('./pages/Agents'));
const Playground = React.lazy(() => import('./pages/Playground'));
const Files = React.lazy(() => import('./pages/Files'));
const Editor = React.lazy(() => import('./pages/Editor'));
const Runs = React.lazy(() => import('./pages/Runs'));
const Terminal = React.lazy(() => import('./pages/Terminal'));
const Queue = React.lazy(() => import('./pages/Queue'));
const Cron = React.lazy(() => import('./pages/Cron'));
const Logs = React.lazy(() => import('./pages/Logs'));
const Health = React.lazy(() => import('./pages/Health'));
const Metrics = React.lazy(() => import('./pages/Metrics'));
const Webhooks = React.lazy(() => import('./pages/Webhooks'));
const Plugins = React.lazy(() => import('./pages/Plugins'));
const ApiKeys = React.lazy(() => import('./pages/ApiKeys'));
const Settings = React.lazy(() => import('./pages/Settings'));
const AuditLogs = React.lazy(() => import('./pages/AuditLogs'));
const Git = React.lazy(() => import('./pages/Git'));
const Swarm = React.lazy(() => import('./pages/Swarm'));
const Workspaces = React.lazy(() => import('./pages/Workspaces'));
const Teams = React.lazy(() => import('./pages/Teams'));
const Templates = React.lazy(() => import('./pages/Templates'));
const Memory = React.lazy(() => import('./pages/Memory'));
const NotFound = React.lazy(() => import('./pages/NotFound'));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-slate-400 text-lg">Loading...</div>
    </div>
  );
}

function ProtectedLayout() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <ThemeProvider>
      <NotificationProvider>
        <ErrorToast />
        <Layout>
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/agents" element={<Agents />} />
                <Route path="/playground" element={<Playground />} />
                <Route path="/files" element={<Files />} />
                <Route path="/editor" element={<Editor />} />
                <Route path="/runs" element={<Runs />} />
                <Route path="/terminal" element={<Terminal />} />
                <Route path="/queue" element={<Queue />} />
                <Route path="/cron" element={<Cron />} />
                <Route path="/logs" element={<Logs />} />
                <Route path="/health" element={<Health />} />
                <Route path="/metrics" element={<Metrics />} />
                <Route path="/webhooks" element={<Webhooks />} />
                <Route path="/plugins" element={<Plugins />} />
                <Route path="/api-keys" element={<ApiKeys />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/audit-logs" element={<AuditLogs />} />
                <Route path="/git" element={<Git />} />
                <Route path="/swarm" element={<Swarm />} />
                <Route path="/workspaces" element={<Workspaces />} />
                <Route path="/teams" element={<Teams />} />
                <Route path="/templates" element={<Templates />} />
                <Route path="/memory" element={<Memory />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Layout>
      </NotificationProvider>
    </ThemeProvider>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  );
}

export default App;
