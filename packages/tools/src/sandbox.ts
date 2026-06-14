import { getLogger } from '@titan/logging';
import path from 'node:path';

const log = getLogger().child({ component: 'tool-sandbox' });

export interface SandboxConfig {
  allowedCwdPrefixes?: readonly string[];
  forbiddenCommands?: readonly string[];
  maxOutputBytes?: number;
  timeoutMs?: number;
}

const DEFAULT_CONFIG: SandboxConfig = {
  allowedCwdPrefixes: [process.cwd()],
  forbiddenCommands: ['rm -rf /', 'dd if=/dev/zero', ':(){ :|:& };:', 'mkfs'],
  maxOutputBytes: 1024 * 1024, // 1 MB
  timeoutMs: 10_000,
};

export function validateCwd(cwd: string, config: SandboxConfig = DEFAULT_CONFIG): string {
  const prefixes = config.allowedCwdPrefixes ?? DEFAULT_CONFIG.allowedCwdPrefixes!;
  const resolved = path.resolve(cwd);
  for (const prefix of prefixes) {
    const rel = path.relative(prefix, resolved);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
      return resolved;
    }
  }
  log.warn({ cwd: resolved, allowedPrefixes: prefixes }, 'cwd rejected by sandbox');
  throw new Error(`CWD "${cwd}" is outside allowed prefixes.`);
}

export function validateCommand(command: string, config: SandboxConfig = DEFAULT_CONFIG): void {
  const forbidden = config.forbiddenCommands ?? DEFAULT_CONFIG.forbiddenCommands!;
  for (const f of forbidden) {
    if (command.toLowerCase().includes(f.toLowerCase())) {
      log.warn({ command, forbidden: f }, 'forbidden command detected');
      throw new Error(`Command contains forbidden pattern: "${f}"`);
    }
  }
}

export function truncateOutput(data: string, maxBytes: number = DEFAULT_CONFIG.maxOutputBytes!): string {
  const buf = Buffer.from(data);
  if (buf.length <= maxBytes) return data;
  return buf.subarray(0, maxBytes).toString('utf-8') + '\n[...output truncated...]';
}
