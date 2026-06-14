export interface SandboxContainer {
  id: string;
  dockerId: string;
  status: 'warm' | 'active' | 'recycling' | 'destroyed';
  createdAt: Date;
  lastUsedAt: Date | null;
  execCount: number;
  labels: Record<string, string>;
}

export interface SandboxLimits {
  cpu?: string;       // e.g. '0.5' for half a CPU
  memory?: string;    // e.g. '512m'
  timeoutMs: number;  // max execution time
  pids?: number;      // max processes
  network?: boolean;  // allow network access
}

export interface SandboxExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  oomKilled: boolean;
}

export interface SandboxPoolConfig {
  image: string;
  minSize: number;
  maxSize: number;
  recycleAfterExecutions: number;
  recycleAfterSeconds: number;
  healthCheckIntervalMs: number;
  startupTimeoutMs: number;
  defaultLimits: SandboxLimits;
  workspaceMount?: string; // host path to mount read-only
  labels?: Record<string, string>;
}
