import { execFileSync } from 'node:child_process';
import { getLogger } from '@titan/logging';
import type { LlmProvider } from '../../types.js';

const log = getLogger().child({ component: 'git-manager' });

function sanitizeBranchName(name: string): string {
  const cleaned = name.replace(/[^\w.\-\/]/g, '');
  if (!cleaned) throw new Error('Invalid branch name');
  if (cleaned.length > 200) throw new Error('Branch name too long');
  if (cleaned.includes('..') || cleaned.startsWith('.') || cleaned.endsWith('.lock')) {
    throw new Error('Invalid branch name pattern');
  }
  return cleaned;
}

function sanitizeFilePath(file: string): string {
  if (file.includes('..')) throw new Error('Path traversal not allowed in file path');
  if (file.length > 500) throw new Error('File path too long');
  return file;
}

interface GitOpsResult {
  success: boolean;
  branch?: string;
  commitHash?: string;
  message?: string;
  error?: string;
}

export class GitManager {
  constructor(private cwd: string, private llm?: LlmProvider) {}

  createBranch(name: string): GitOpsResult {
    try {
      const safeName = sanitizeBranchName(name);
      this.exec('git', ['checkout', '-b', safeName]);
      return { success: true, branch: safeName };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create branch' };
    }
  }

  stageFiles(files: string[]): GitOpsResult {
    try {
      const safeFiles = files.map(sanitizeFilePath);
      this.exec('git', ['add', ...safeFiles]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to stage files' };
    }
  }

  stageAll(): GitOpsResult {
    try {
      this.exec('git', ['add', '-A']);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to stage' };
    }
  }

  async commit(description: string): Promise<GitOpsResult> {
    try {
      const message = this.llm
        ? await this.generateCommitMessage(description)
        : description;

      const output = this.exec('git', ['commit', '-m', message]);
      const hashMatch = output.match(/\[[\w-]+\s+([a-f0-9]+)\]/);

      return { success: true, commitHash: hashMatch?.[1], message };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Commit failed' };
    }
  }

  getDiff(): string {
    try {
      const staged = this.exec('git', ['diff', '--staged']);
      return staged || this.exec('git', ['diff']);
    } catch {
      return '';
    }
  }

  getStatus(): string {
    try {
      return this.exec('git', ['status', '--short']);
    } catch {
      return '';
    }
  }

  getCurrentBranch(): string {
    try {
      return this.exec('git', ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    } catch {
      return 'unknown';
    }
  }

  getChangedFiles(): string[] {
    try {
      const output = this.exec('git', ['diff', '--name-only', 'HEAD']);
      return output.split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  private async generateCommitMessage(description: string): Promise<string> {
    if (!this.llm) return description;

    try {
      const diff = this.getDiff().slice(0, 3000);
      const completion = await this.llm.complete([
        {
          role: 'system',
          content: 'Write a concise git commit message (1 line, max 72 chars) following conventional commits format (feat:, fix:, docs:, etc.). Be specific about what changed.',
        },
        { role: 'user', content: `Changes:\n${description}\n\nDiff:\n${diff}` },
      ], { temperature: 0.1, maxTokens: 100 });

      return completion.content.trim().replace(/^["']|["']$/g, '');
    } catch {
      return description;
    }
  }

  private exec(cmd: string, args: string[]): string {
    return execFileSync(cmd, args, { cwd: this.cwd, encoding: 'utf-8' });
  }
}
