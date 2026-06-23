import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { I18nProvider } from './i18n/I18nContext';
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
const AgentProfiles = lazy(() => import('./pages/AgentProfiles'));
const Git = lazy(() => import('./pages/Git'));
const Knowledge = lazy(() => import('./pages/Knowledge'));
const Workflows = lazy(() => import('./pages/Workflows'));
const Learning = lazy(() => import('./pages/Learning'));
const CodeIntel = lazy(() => import('./pages/CodeIntel'));
const Autonomous = lazy(() => import('./pages/Autonomous'));
const Marketplace = lazy(() => import('./pages/Marketplace'));
const Teams = lazy(() => import('./pages/Teams'));
const SkillBuilder = lazy(() => import('./pages/SkillBuilder'));
const MCPGovernance = lazy(() => import('./pages/MCPGovernance'));
const DAGWorkflow = lazy(() => import('./pages/DAGWorkflow'));
const Guardrails = lazy(() => import('./pages/Guardrails'));
const BiTemporalGraph = lazy(() => import('./pages/BiTemporalGraph'));
const DreamLab = lazy(() => import('./pages/DreamLab'));
const Safety = lazy(() => import('./pages/Safety'));
const Mirror = lazy(() => import('./pages/Mirror'));
const Evolution = lazy(() => import('./pages/Evolution'));
const BrowserAgentPage = lazy(() => import('./pages/BrowserAgentPage'));
const AgentNetwork = lazy(() => import('./pages/AgentNetwork'));
const SelfForgePage = lazy(() => import('./pages/SelfForgePage'));
const WorldModel = lazy(() => import('./pages/WorldModel'));
const MetaLearning = lazy(() => import('./pages/MetaLearning'));
const HiveMind = lazy(() => import('./pages/HiveMind'));
const Economy = lazy(() => import('./pages/Economy'));
const Constitution = lazy(() => import('./pages/Constitution'));

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
      <I18nProvider>
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
            <Route path="agent-profiles" element={<AgentProfiles />} />
            <Route path="git" element={<Git />} />
            <Route path="knowledge" element={<Knowledge />} />
            <Route path="workflows" element={<Workflows />} />
            <Route path="learning" element={<Learning />} />
            <Route path="code-intel" element={<CodeIntel />} />
            <Route path="autonomous" element={<Autonomous />} />
            <Route path="marketplace" element={<Marketplace />} />
            <Route path="teams" element={<Teams />} />
            <Route path="skill-builder" element={<SkillBuilder />} />
            <Route path="mcp-governance" element={<MCPGovernance />} />
            <Route path="dag-workflow" element={<DAGWorkflow />} />
            <Route path="guardrails" element={<Guardrails />} />
            <Route path="bi-temporal-graph" element={<BiTemporalGraph />} />
            <Route path="dream-lab" element={<DreamLab />} />
            <Route path="safety" element={<Safety />} />
            <Route path="mirror" element={<Mirror />} />
            <Route path="evolution" element={<Evolution />} />
            <Route path="browser-agent" element={<BrowserAgentPage />} />
            <Route path="agent-network" element={<AgentNetwork />} />
            <Route path="self-forge" element={<SelfForgePage />} />
            <Route path="world-model" element={<WorldModel />} />
            <Route path="meta-learning" element={<MetaLearning />} />
            <Route path="hive-mind" element={<HiveMind />} />
            <Route path="economy" element={<Economy />} />
            <Route path="constitution" element={<Constitution />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <Toaster
          theme={localStorage.getItem('titan:theme') === 'light' ? 'light' : 'dark'}
          position="bottom-right"
        />
        </AuthProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
