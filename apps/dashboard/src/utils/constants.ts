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
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  badge?: string;
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
      { label: 'Terminal', path: '/terminal', icon: TerminalSquare },
    ],
  },
  {
    label: 'AI Operations',
    items: [
      { label: 'Swarm', path: '/swarm', icon: Network },
      { label: 'Playground', path: '/playground', icon: FlaskConical },
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
