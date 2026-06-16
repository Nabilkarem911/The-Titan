import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getLogger } from '@titan/logging';

const execFileAsync = promisify(execFile);
const log = getLogger().child({ component: 'tool-git-push' });

export interface GitPushInput {
  cwd: string;
  commitMessage?: string;
  remote?: string;
  branch?: string;
  addAll?: boolean;
  files?: string[];
  skipCommit?: boolean;
  skipPush?: boolean;
  createTag?: string;
}

export async function gitPush(input: GitPushInput): Promise<{
  success: boolean;
  message: string;
  details: Array<{ command: string; stdout: string; stderr: string; exitCode: number }>;
}> {
  const {
    cwd,
    commitMessage = 'chore: update from Titan',
    remote = 'origin',
    branch = 'main',
    addAll = false,
    files = [],
    skipCommit = false,
    skipPush = false,
    createTag,
  } = input;

  const details: Array<{ command: string; stdout: string; stderr: string; exitCode: number }> = [];

  async function run(command: string, args: string[]): Promise<{ command: string; stdout: string; stderr: string; exitCode: number }> {
    log.info({ cwd, command: `${command} ${args.join(' ')}` }, 'git command');
    try {
      const { stdout, stderr } = await execFileAsync(command, args, {
        cwd,
        maxBuffer: 5 * 1024 * 1024,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      });
      return { command: `${command} ${args.join(' ')}`, stdout, stderr, exitCode: 0 };
    } catch (err) {
      const execErr = err as { stdout?: string; stderr?: string; code?: number };
      return {
        command: `${command} ${args.join(' ')}`,
        stdout: execErr.stdout ?? '',
        stderr: execErr.stderr ?? '',
        exitCode: execErr.code ?? 1,
      };
    }
  }

  // Check if in a git repo
  const statusCheck = await run('git', ['rev-parse', '--git-dir']);
  if (statusCheck.exitCode !== 0) {
    return { success: false, message: 'Not a git repository', details: [statusCheck] };
  }

  // Stage files
  if (addAll) {
    const r = await run('git', ['add', '-A']);
    details.push(r);
    if (r.exitCode !== 0) {
      return { success: false, message: 'Failed to stage files', details };
    }
  } else if (files.length > 0) {
    const r = await run('git', ['add', ...files]);
    details.push(r);
    if (r.exitCode !== 0) {
      return { success: false, message: 'Failed to stage files', details };
    }
  }

  // Check if there are changes to commit
  const diffCheck = await run('git', ['diff', '--cached', '--quiet']);
  if (diffCheck.exitCode === 0 && !skipCommit) {
    return { success: false, message: 'No changes to commit', details };
  }

  // Commit
  if (!skipCommit) {
    const r = await run('git', ['commit', '-m', commitMessage]);
    details.push(r);
    if (r.exitCode !== 0) {
      return { success: false, message: 'Commit failed', details };
    }
  }

  // Create tag if specified
  if (createTag) {
    const r = await run('git', ['tag', createTag]);
    details.push(r);
    if (r.exitCode !== 0) {
      return { success: false, message: 'Tag creation failed', details };
    }
  }

  // Push
  if (!skipPush) {
    const pushArgs = ['push', remote, branch];
    if (createTag) pushArgs.push('--follow-tags');
    const r = await run('git', pushArgs);
    details.push(r);
    if (r.exitCode !== 0) {
      return { success: false, message: 'Push failed', details };
    }
  }

  return { success: true, message: 'Git operations completed', details };
}
