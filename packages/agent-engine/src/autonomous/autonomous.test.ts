import { describe, it, expect, vi } from 'vitest';
import { GitManager } from './git-ops/git-manager.js';
import { AutoFixer } from './fix-loop/auto-fixer.js';
import type { LlmProvider } from '../types.js';

function mockLlm(content: string): LlmProvider {
  return { complete: vi.fn().mockResolvedValue({ content, tokensUsed: 50, finishReason: 'stop' }) };
}

// ── Auto Fixer ──

describe('AutoFixer', () => {
  it('extracts file path from TypeScript error', async () => {
    const files: Record<string, string> = {
      'src/app.ts': 'const x: number = "hello";',
    };

    const fixer = new AutoFixer(
      mockLlm('const x: number = 42;'),
      async (path) => files[path] ?? '',
      async (path, content) => { files[path] = content; },
    );

    const result = await fixer.fixErrors(['src/app.ts(1,7): error TS2322: Type string not assignable']);
    expect(result.attempts.length).toBe(1);
    expect(files['src/app.ts']).toBe('const x: number = 42;');
  });

  it('rolls back on request', async () => {
    const files: Record<string, string> = { 'a.ts': 'original' };

    const fixer = new AutoFixer(
      mockLlm('fixed'),
      async (path) => files[path] ?? '',
      async (path, content) => { files[path] = content; },
    );

    const result = await fixer.fixErrors(['a.ts(1,1): error TS0000: test']);
    expect(files['a.ts']).toBe('fixed');

    await fixer.rollback(result.attempts);
    expect(files['a.ts']).toBe('original');
  });

  it('skips errors without file path', async () => {
    const fixer = new AutoFixer(
      mockLlm(''),
      async () => '',
      async () => {},
    );

    const result = await fixer.fixErrors(['some random error without file']);
    expect(result.attempts.length).toBe(0);
  });
});

// ── Git Manager ──

describe('GitManager', () => {
  it('gets current branch', () => {
    const git = new GitManager(process.cwd());
    const branch = git.getCurrentBranch();
    expect(branch).toBeTruthy();
    expect(typeof branch).toBe('string');
  });

  it('gets status', () => {
    const git = new GitManager(process.cwd());
    const status = git.getStatus();
    expect(typeof status).toBe('string');
  });

  it('gets diff', () => {
    const git = new GitManager(process.cwd());
    const diff = git.getDiff();
    expect(typeof diff).toBe('string');
  });
});
