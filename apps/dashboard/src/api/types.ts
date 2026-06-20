export interface AgentProfile {
  id: string;
  name: string;
  model: string;
  system_prompt: string;
  tools: string[];
  temperature: number;
  max_tokens: number;
  description?: string;
  avatar?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface ApiRun {
  id: string;
  agent_id: string;
  agent_name?: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  input: string;
  output?: string;
  error?: string;
  tokens_used?: number;
  cost?: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  duration_ms?: number;
  steps?: ApiStep[];
}

export interface ApiStep {
  id: string;
  run_id: string;
  type: 'llm' | 'tool' | 'user' | 'system';
  content: string;
  tool_name?: string;
  tool_input?: string;
  tool_output?: string;
  tokens?: number;
  duration_ms?: number;
  created_at: string;
}

export interface QueueStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  total: number;
  workers: number;
  throughput: number;
}

export interface QueueJob {
  id: string;
  agent_id: string;
  agent_name?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  priority: number;
  input: string;
  output?: string;
  error?: string;
  retries: number;
  max_retries: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface CronJob {
  id: string;
  name: string;
  agent_id: string;
  agent_name?: string;
  schedule: string;
  input: string;
  enabled: boolean;
  last_run?: string;
  next_run?: string;
  run_count: number;
  created_at: string;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret?: string;
  enabled: boolean;
  last_triggered?: string;
  failure_count: number;
  created_at: string;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  capabilities: string[];
  installed_at: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  last_used?: string;
  expires_at?: string;
  created_at: string;
}

export interface UserKey {
  id: string;
  provider: string;
  name: string;
  key_prefix: string;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  member_count: number;
  agent_count: number;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  user_id: string;
  username: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joined_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  username: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details?: Record<string, unknown>;
  ip_address: string;
  timestamp: string;
}

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  mime_type?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_name?: string;
  tool_input?: string;
  tool_output?: string;
  tokens?: number;
  created_at: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  checks: Record<string, {
    status: 'pass' | 'warn' | 'fail';
    message?: string;
    latency_ms?: number;
  }>;
}

export interface MetricsData {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  active_connections: number;
  requests_per_minute: number;
  avg_response_time: number;
  error_rate: number;
  total_runs: number;
  total_tokens: number;
  total_cost: number;
}

export interface GitRepo {
  name: string;
  path: string;
  branch: string;
  status: string;
  last_commit?: string;
  remote?: string;
}

export interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  namespace: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SwarmConfig {
  id: string;
  name: string;
  agents: string[];
  topology: 'sequential' | 'parallel' | 'graph';
  description?: string;
  config?: Record<string, unknown>;
  created_at: string;
}

export interface LogEntry {
  id: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  source: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface Settings {
  general: {
    site_name: string;
    default_model: string;
    max_concurrent_runs: number;
    allow_registration: boolean;
  };
  models: {
    providers: Array<{
      name: string;
      enabled: boolean;
      api_key_set: boolean;
      models: string[];
    }>;
  };
  security: {
    session_timeout: number;
    max_login_attempts: number;
    require_2fa: boolean;
    allowed_origins: string[];
  };
}
