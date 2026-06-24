import {
  LayoutDashboard,
  MessageSquare,
  Bot,
  Activity,
  FolderTree,
  TerminalSquare,
  Network,
  Layers,
  HeartPulse,
  Puzzle,
  Webhook,
  Clock,
  KeyRound,
  Settings,
  Building2,
  Brain,
  ShieldCheck,
  BarChart3,
  FlaskConical,
  Users,
  GitBranch,
  Workflow,
  GraduationCap,
  Code2,
  Store,
  Wrench,
  Shield,
  GitGraph,
  Moon,
  Sparkles,
  Globe,
  Orbit,
  Coins,
  Scroll,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  labelKey?: string;
  path: string;
  icon: LucideIcon;
  badge?: string;
  hidden?: boolean;
}

export const NAV_GROUPS: { label: string; labelKey?: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    labelKey: 'navOverview',
    items: [
      { label: 'Dashboard', labelKey: 'navDashboard', path: '/', icon: LayoutDashboard },
      { label: 'Chat', labelKey: 'navChat', path: '/chat', icon: MessageSquare },
      { label: 'Agents', labelKey: 'navAgents', path: '/agents', icon: Bot },
      { label: 'Profiles', labelKey: 'navProfiles', path: '/agent-profiles', icon: Users },
      { label: 'Runs', labelKey: 'navRuns', path: '/runs', icon: Activity },
    ],
  },
  {
    label: 'Workspace',
    labelKey: 'navWorkspace',
    items: [
      { label: 'Files', labelKey: 'navFiles', path: '/files', icon: FolderTree },
      { label: 'Terminal', labelKey: 'navTerminal', path: '/terminal', icon: TerminalSquare, hidden: true },
      { label: 'Git', labelKey: 'navGit', path: '/git', icon: GitBranch, hidden: true },
      { label: 'Code Intel', labelKey: 'navCodeIntel', path: '/code-intel', icon: Code2 },
      { label: 'Marketplace', labelKey: 'navMarketplace', path: '/marketplace', icon: Store },
      { label: 'Skill Builder', labelKey: 'navSkillBuilder', path: '/skill-builder', icon: Wrench },
    ],
  },
  {
    label: 'AI Operations',
    labelKey: 'navAIOperations',
    items: [
      { label: 'Swarm', labelKey: 'navSwarm', path: '/swarm', icon: Network },
      { label: 'Playground', labelKey: 'navPlayground', path: '/playground', icon: FlaskConical },
      { label: 'Knowledge', labelKey: 'navKnowledge', path: '/knowledge', icon: Brain },
      { label: 'Workflows', labelKey: 'navWorkflows', path: '/workflows', icon: Workflow },
      { label: 'Learning', labelKey: 'navLearning', path: '/learning', icon: GraduationCap },
      { label: 'Autonomous', labelKey: 'navAutonomous', path: '/autonomous', icon: Bot },
      { label: 'Teams', labelKey: 'navTeams', path: '/teams', icon: Users },
    ],
  },
  {
    label: 'V5 Capabilities',
    labelKey: 'navV5Capabilities',
    items: [
      { label: 'MCP Governance', labelKey: 'navMCPGovernance', path: '/mcp-governance', icon: ShieldCheck },
      { label: 'DAG Workflow', labelKey: 'navDAGWorkflow', path: '/dag-workflow', icon: Workflow },
      { label: 'Guardrails', labelKey: 'navGuardrails', path: '/guardrails', icon: Shield },
      { label: 'Bi-Temporal Graph', labelKey: 'navBiTemporalGraph', path: '/bi-temporal-graph', icon: GitGraph },
    ],
  },
  {
    label: 'Cognitive Systems',
    labelKey: 'navCognitiveSystems',
    items: [
      { label: 'Dream Lab', labelKey: 'navDreamLab', path: '/dream-lab', icon: Moon },
      { label: 'Safety', labelKey: 'navSafety', path: '/safety', icon: Shield },
      { label: 'MIRROR', labelKey: 'navMirror', path: '/mirror', icon: Brain },
      { label: 'Evolution', labelKey: 'navEvolution', path: '/evolution', icon: Sparkles },
      { label: 'Meta-Learning', labelKey: 'navMetaLearning', path: '/meta-learning', icon: GraduationCap },
    ],
  },
  {
    label: 'Integrations',
    labelKey: 'navIntegrations',
    items: [
      { label: 'Browser Agent', labelKey: 'navBrowserAgent', path: '/browser-agent', icon: Globe },
      { label: 'Agent Network', labelKey: 'navAgentNetwork', path: '/agent-network', icon: Network },
      { label: 'Self-Forge', labelKey: 'navSelfForge', path: '/self-forge', icon: Wrench },
      { label: 'World Model', labelKey: 'navWorldModel', path: '/world-model', icon: Orbit },
      { label: 'Hive Mind', labelKey: 'navHiveMind', path: '/hive-mind', icon: Network },
      { label: 'Economy', labelKey: 'navEconomy', path: '/economy', icon: Coins },
      { label: 'Constitution', labelKey: 'navConstitution', path: '/constitution', icon: Scroll },
      { label: 'Collaboration', labelKey: 'navCollaboration', path: '/collaboration', icon: Users },
    ],
  },
  {
    label: 'Infrastructure',
    labelKey: 'navInfrastructure',
    items: [
      { label: 'Queue', labelKey: 'navQueue', path: '/queue', icon: Layers },
      { label: 'Health', labelKey: 'navHealth', path: '/health', icon: HeartPulse },
      { label: 'Metrics', labelKey: 'navMetrics', path: '/metrics', icon: BarChart3 },
    ],
  },
  {
    label: 'Management',
    labelKey: 'navManagement',
    items: [
      { label: 'API Keys', labelKey: 'navApiKeys', path: '/api-keys', icon: KeyRound },
      { label: 'Webhooks', labelKey: 'navWebhooks', path: '/webhooks', icon: Webhook },
      { label: 'Cron Jobs', labelKey: 'navCronJobs', path: '/cron', icon: Clock },
      { label: 'Plugins', labelKey: 'navPlugins', path: '/plugins', icon: Puzzle },
      { label: 'Workspaces', labelKey: 'navWorkspaces', path: '/workspaces', icon: Building2 },
      { label: 'Memory', labelKey: 'navMemory', path: '/memory', icon: Brain },
      { label: 'Audit Logs', labelKey: 'navAuditLogs', path: '/audit-logs', icon: ShieldCheck },
      { label: 'Settings', labelKey: 'navSettings', path: '/settings', icon: Settings },
    ],
  },
];

export const API_BASE = '/api/v1';
export const TOKEN_KEY = 'titan_access_token';
export const REFRESH_TOKEN_KEY = 'titan_refresh_token';
