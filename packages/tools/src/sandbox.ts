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
  'rm -r -f /',
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

// Dangerous shell metacharacters that enable command chaining, substitution, or redirection
const DANGEROUS_METACHAR_PATTERNS: readonly RegExp[] = [
  /`[^`]*`/,                    // Backtick command substitution
  /\$\([^)]*\)/,                // $(...) command substitution
  /\$\{[^}]*\}/,                // ${...} variable expansion (can be used for obfuscation)
  /<\([^)]*\)/,                 // <(...) process substitution
  />\([^)]*\)/,                 // >(...) process substitution
  /\\x[0-9a-f]{2}/i,           // Hex escape sequences (e.g. \x72 for 'r')
  /\\u[0-9a-f]{4}/i,           // Unicode escape sequences
  /\\[0-7]{3}/,                // Octal escape sequences
];

// Commands that are inherently dangerous regardless of arguments
const FORBIDDEN_BASE_COMMANDS: readonly string[] = [
  'shred', 'mkfs', 'sudo', 'reboot', 'shutdown',
  'halt', 'poweroff', 'nsenter', 'unshare',
];

function normalizeCommand(cmd: string): string {
  return cmd
    .replace(/\s+/g, ' ')  // collapse multiple whitespace into single space
    .replace(/\\\s/g, '')   // remove escaped whitespace (line continuations)
    .trim()
    .toLowerCase();
}

export function validateCommand(command: string, config: SandboxConfig = DEFAULT_CONFIG): void {
  const forbidden = config.forbiddenCommands ?? DEFAULT_CONFIG.forbiddenCommands!;

  // Null byte check first
  if (command.includes('\0')) {
    throw new Error('Command contains null bytes');
  }

  // Normalize: collapse whitespace, remove line continuations
  const normalized = normalizeCommand(command);
  const checkTarget = normalized;

  // Check for dangerous shell metacharacters that enable obfuscation or chaining
  for (const pattern of DANGEROUS_METACHAR_PATTERNS) {
    if (pattern.test(command)) {
      log.warn({ command: command.substring(0, 200), pattern: pattern.source }, 'dangerous shell metacharacter detected');
      throw new Error(`Command contains dangerous shell metacharacter: ${pattern.source}`);
    }
  }

  // Check forbidden base commands (these are dangerous regardless of arguments)
  const baseCmd = checkTarget.split(/[|\s;&]+/)[0] ?? '';
  for (const base of FORBIDDEN_BASE_COMMANDS) {
    if (baseCmd === base || baseCmd.endsWith(`/${base}`)) {
      log.warn({ command: command.substring(0, 200), base }, 'forbidden base command detected');
      throw new Error(`Command uses forbidden base command: "${base}"`);
    }
  }

  // Check forbidden patterns against normalized command
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
}

export function truncateOutput(data: string, maxBytes: number = DEFAULT_CONFIG.maxOutputBytes!): string {
  const buf = Buffer.from(data);
  if (buf.length <= maxBytes) return data;
  return buf.subarray(0, maxBytes).toString('utf-8') + '\n[...output truncated...]';
}
