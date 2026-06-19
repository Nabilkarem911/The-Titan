import { getLogger } from '@titan/logging';
import path from 'node:path';

const log = getLogger().child({ component: 'tool-sandbox' });

export interface SandboxConfig {
  allowedCwdPrefixes?: readonly string[];
  forbiddenCommands?: readonly string[];
  maxOutputBytes?: number;
  timeoutMs?: number;
}

const FORBIDDEN_PATTERNS: readonly string[] = [
  // Filesystem destruction
  'rm -rf /',
  'rm -rf ~',
  'rm -rf *',
  'shred',
  'mkfs',
  'dd if=/dev/zero',
  'dd if=/dev/random',
  // Fork bomb
  ':(){ :|:& };:',
  // Privilege escalation
  'sudo',
  'su -',
  'chmod 777 /',
  'chown root',
  // Exfiltration / reverse shells
  'curl | sh',
  'curl | bash',
  'wget | sh',
  'wget | bash',
  'bash -i',
  'sh -i',
  '/dev/tcp/',
  '/dev/udp/',
  'nc -e',
  'ncat -e',
  // System manipulation
  'reboot',
  'shutdown',
  'halt',
  'poweroff',
  'init 0',
  'init 6',
  'kill -9 1',
  // Credential theft
  '/etc/passwd',
  '/etc/shadow',
  '/etc/sudoers',
  // Container escape
  'docker.sock',
  'containerd.sock',
  'nsenter',
  'unshare',
];

const DEFAULT_CONFIG: SandboxConfig = {
  allowedCwdPrefixes: [process.cwd()],
  forbiddenCommands: FORBIDDEN_PATTERNS as string[],
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

  // For SSH commands, only validate the local part (the ssh command itself),
  // not the remote command inside quotes — the remote server has its own security.
  const isRemoteExec = /^(ssh|sshpass)\s/.test(command.trim().toLowerCase());
  const checkTarget = isRemoteExec
    ? command.substring(0, command.indexOf('"') >= 0 ? command.indexOf('"') : command.length).toLowerCase()
    : command.toLowerCase();

  for (const f of forbidden) {
    if (f === 'sh -i') {
      if (/(?<![s])sh\s+-i/.test(checkTarget)) {
        log.warn({ command: command.substring(0, 200), forbidden: f }, 'forbidden command detected');
        throw new Error(`Command contains forbidden pattern: "${f}"`);
      }
    } else if (f === 'bash -i') {
      if (/(?<![a-z])bash\s+-i/.test(checkTarget)) {
        log.warn({ command: command.substring(0, 200), forbidden: f }, 'forbidden command detected');
        throw new Error(`Command contains forbidden pattern: "${f}"`);
      }
    } else if (checkTarget.includes(f.toLowerCase())) {
      log.warn({ command: command.substring(0, 200), forbidden: f }, 'forbidden command detected');
      throw new Error(`Command contains forbidden pattern: "${f}"`);
    }
  }
  if (command.includes('\0')) {
    throw new Error('Command contains null bytes');
  }
}

export function truncateOutput(data: string, maxBytes: number = DEFAULT_CONFIG.maxOutputBytes!): string {
  const buf = Buffer.from(data);
  if (buf.length <= maxBytes) return data;
  return buf.subarray(0, maxBytes).toString('utf-8') + '\n[...output truncated...]';
}
