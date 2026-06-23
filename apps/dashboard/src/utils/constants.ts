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
  path: string;
  icon: LucideIcon;
  badge?: string;
  hidden?: boolean;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', path: '/', icon: LayoutDashboard },
      { label: 'Chat', path: '/chat', icon: MessageSquare },
      { label: 'Agents', path: '/agents', icon: Bot },
      { label: 'Profiles', path: '/agent-profiles', icon: Users },
      { label: 'Runs', path: '/runs', icon: Activity },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { label: 'Files', path: '/files', icon: FolderTree },
      { label: 'Terminal', path: '/terminal', icon: TerminalSquare, hidden: true },
      { label: 'Git', path: '/git', icon: GitBranch, hidden: true },
      { label: 'Code Intel', path: '/code-intel', icon: Code2 },
      { label: 'Marketplace', path: '/marketplace', icon: Store },
      { label: 'Skill Builder', path: '/skill-builder', icon: Wrench },
    ],
  },
  {
    label: 'AI Operations',
    items: [
      { label: 'Swarm', path: '/swarm', icon: Network },
      { label: 'Playground', path: '/playground', icon: FlaskConical },
      { label: 'Knowledge', path: '/knowledge', icon: Brain },
      { label: 'Workflows', path: '/workflows', icon: Workflow },
      { label: 'Learning', path: '/learning', icon: GraduationCap },
      { label: 'Autonomous', path: '/autonomous', icon: Bot },
      { label: 'Teams', path: '/teams', icon: Users },
    ],
  },
  {
    label: 'V5 Capabilities',
    items: [
      { label: 'MCP Governance', path: '/mcp-governance', icon: ShieldCheck },
      { label: 'DAG Workflow', path: '/dag-workflow', icon: Workflow },
      { label: 'Guardrails', path: '/guardrails', icon: Shield },
      { label: 'Bi-Temporal Graph', path: '/bi-temporal-graph', icon: GitGraph },
    ],
  },
  {
    label: 'Cognitive Systems',
    items: [
      { label: 'Dream Lab', path: '/dream-lab', icon: Moon },
      { label: 'Safety', path: '/safety', icon: Shield },
      { label: 'MIRROR', path: '/mirror', icon: Brain },
      { label: 'Evolution', path: '/evolution', icon: Sparkles },
      { label: 'Meta-Learning', path: '/meta-learning', icon: GraduationCap },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { label: 'Browser Agent', path: '/browser-agent', icon: Globe },
      { label: 'Agent Network', path: '/agent-network', icon: Network },
      { label: 'Self-Forge', path: '/self-forge', icon: Wrench },
      { label: 'World Model', path: '/world-model', icon: Orbit },
      { label: 'Hive Mind', path: '/hive-mind', icon: Network },
      { label: 'Economy', path: '/economy', icon: Coins },
      { label: 'Constitution', path: '/constitution', icon: Scroll },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { label: 'Queue', path: '/queue', icon: Layers },
      { label: 'Health', path: '/health', icon: HeartPulse },
      { label: 'Metrics', path: '/metrics', icon: BarChart3 },
    ],
  },
  {
    label: 'Management',
    items: [
      { label: 'API Keys', path: '/api-keys', icon: KeyRound },
      { label: 'Webhooks', path: '/webhooks', icon: Webhook },
      { label: 'Cron Jobs', path: '/cron', icon: Clock },
      { label: 'Plugins', path: '/plugins', icon: Puzzle },
      { label: 'Workspaces', path: '/workspaces', icon: Building2 },
      { label: 'Memory', path: '/memory', icon: Brain },
      { label: 'Audit Logs', path: '/audit-logs', icon: ShieldCheck },
      { label: 'Settings', path: '/settings', icon: Settings },
    ],
  },
];

export const API_BASE = '/api/v1';
export const TOKEN_KEY = 'titan_access_token';
export const REFRESH_TOKEN_KEY = 'titan_refresh_token';
