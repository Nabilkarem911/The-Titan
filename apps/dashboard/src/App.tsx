import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Agents from './pages/Agents';
import Playground from './pages/Playground';
import Runs from './pages/Runs';
import Queue from './pages/Queue';
import Metrics from './pages/Metrics';
import Files from './pages/Files';
import Settings from './pages/Settings';
import Editor from './pages/Editor';
import Terminal from './pages/Terminal';
import Git from './pages/Git';
import Cron from './pages/Cron';
import Projects from './pages/Projects';
import Logs from './pages/Logs';
import Webhooks from './pages/Webhooks';
import ApiKeys from './pages/ApiKeys';
import Plugins from './pages/Plugins';
import Teams from './pages/Teams';
import Templates from './pages/Templates';
import AuditLogs from './pages/AuditLogs';
import Swarm from './pages/Swarm';
import Memory from './pages/Memory';
import Login from './pages/Login';
import { useAuth } from './hooks/useAuth';
import { NotificationProvider } from './contexts/NotificationContext';
import { ThemeProvider } from './contexts/ThemeContext';

function ProtectedLayout() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <ThemeProvider>
      <NotificationProvider>
        <Layout>
          <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/runs" element={<Runs />} />
        <Route path="/queue" element={<Queue />} />
        <Route path="/metrics" element={<Metrics />} />
        <Route path="/files" element={<Files />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/terminal" element={<Terminal />} />
        <Route path="/git" element={<Git />} />
        <Route path="/cron" element={<Cron />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/webhooks" element={<Webhooks />} />
        <Route path="/api-keys" element={<ApiKeys />} />
        <Route path="/plugins" element={<Plugins />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/audit-logs" element={<AuditLogs />} />
        <Route path="/swarm" element={<Swarm />} />
        <Route path="/memory" element={<Memory />} />
      </Routes>
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
