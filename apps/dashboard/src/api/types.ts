// ── Auth ──
export interface User {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthMe {
  userId: string;
  sessionId: string | null;
  permissions: string[];
}

// ── Workspaces ──
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  created_at: string;
}

// ── Agent Profiles ──
export interface AgentProfile {
  id: string;
  name: string;
  slug: string;
  description?: string;
  systemPrompt: string;
  model?: string;
  allowedTools?: string[];
  forbiddenTools?: string[];
  maxSteps: number;
  temperature?: number;
  ownerId: string;
  workspaceId?: string;
  isPublic: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ── Agent Runs ──
export interface AgentRun {
  id: string;
  agentId: string;
  status: 'queued' | 'running' | 'paused' | 'completed' | 'failed';
  prompt: string;
  maxSteps: number;
  currentStep: number;
  tokensUsed: number;
  tokenBudget?: number;
  forbiddenTools?: string[];
  finalAnswer?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentStep {
  id: string;
  runId: string;
  stepIndex: number;
  status: 'pending' | 'planning' | 'executing' | 'observing' | 'reflecting' | 'completed' | 'failed';
  thought?: string;
  plan?: string;
  actionName?: string;
  actionParams?: unknown;
  observationSuccess?: boolean;
  observationData?: unknown;
  observationError?: string;
  reflection?: string;
  tokensUsed?: number;
  latencyMs?: number;
  createdAt: string;
}

// ── API Keys ──
export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  workspaceId?: string;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
}

export interface ApiKeyCreated extends ApiKey {
  key: string;
}

// ── Files ──
export interface FileEntry {
  name: string;
  type: 'directory' | 'file';
  size: number;
  modifiedAt: string;
}

// ── Webhooks ──
export interface Webhook {
  id: string;
  name: string;
  agentId: string;
  promptTemplate: string;
  enabled: boolean;
  events: string[];
  triggerCount: number;
  lastTriggeredAt?: string;
  createdAt: string;
  secret?: string;
  webhookUrl: string;
}

export interface WebhookDelivery {
  webhookId: string;
  runId: string;
  status: string;
  error?: string;
  deliveredAt: string;
}

// ── Cron Jobs ──
export interface CronJob {
  id: string;
  name: string;
  agentId: string;
  prompt: string;
  cronExpression: string;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
}

// ── Plugins ──
export interface Plugin {
  id: string;
  name: string;
  description?: string;
  author?: string;
  source: 'registry' | 'local' | 'marketplace';
  status: 'enabled' | 'disabled' | 'error';
  tags?: string[];
  capabilities?: string[];
  created_at: string;
  updated_at: string;
}

// ── Swarm ──
export interface SwarmTask {
  id: string;
  description: string;
  status: string;
  agentsCount: number;
  subTasksCount: number;
  completedSubTasks: number;
  finalAnswer?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Health ──
export interface HealthCheck {
  status: 'live' | 'ready' | 'degraded';
  checks?: Record<string, { ok: boolean; latencyMs?: number; error?: string }>;
  timestamp: string;
}

export interface HealthDashboard {
  dbPool: { total: number; idle: number; waiting: number } | null;
  queues: Record<string, unknown>;
  audit: unknown;
  auditIntegrity: unknown;
  auditArchival: unknown;
  timestamp: string;
}

// ── Metrics ──
export interface MetricsSnapshot {
  metrics: Record<string, unknown>;
  dbPool: { total: number; idle: number; waiting: number } | null;
  redis: { status: string; memory?: number };
  timestamp: string;
}

// ── Audit Logs ──
export interface AuditLog {
  id: string;
  actor_id: string;
  workspace_id: string;
  action: string;
  resource: string;
  resource_id: string;
  metadata: Record<string, unknown>;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

// ── User Keys ──
export interface UserKey {
  id: string;
  name: string;
  provider: string;
  maskedValue: string;
  createdAt: string;
}

// ── API List Response ──
export interface ListResponse<T> {
  items: T[];
  total: number;
}

// ── API Error ──
export interface ApiError {
  type?: string;
  title?: string;
  status?: number;
  code?: string;
  requestId?: string;
  details?: unknown;
  error?: string;
  message?: string;
}
