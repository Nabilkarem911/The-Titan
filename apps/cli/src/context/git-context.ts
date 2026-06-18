import { execSync } from 'node:child_process';

export interface GitContext {
  branch: string;
  status: string;
  recentCommits: string[];
  hasUncommitted: boolean;
  remoteUrl?: string;
}

export function getGitContext(cwd: string): GitContext | null {
  try {
    const branch = exec('git rev-parse --abbrev-ref HEAD', cwd).trim();
    const status = exec('git status --short', cwd).trim();
    const commits = exec('git log --oneline -5', cwd).trim().split('\n').filter(Boolean);
    const remoteUrl = exec('git remote get-url origin', cwd).trim() || undefined;

    return {
      branch,
      status,
      recentCommits: commits,
      hasUncommitted: status.length > 0,
      remoteUrl,
    };
  } catch {
    return null;
  }
}

export function getGitSummary(ctx: GitContext): string {
  const parts = [`Branch: ${ctx.branch}`];
  if (ctx.hasUncommitted) parts.push('Uncommitted changes');
  if (ctx.recentCommits.length > 0) parts.push(`Last commit: ${ctx.recentCommits[0]}`);
  return parts.join(' | ');
}

function exec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    return '';
  }
}
