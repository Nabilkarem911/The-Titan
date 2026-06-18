import { getLogger } from '@titan/logging';
import type { LlmProvider, ToolCall, ToolResult } from '../types.js';
import { buildCodebaseIndex, type CodebaseIndex } from '../code-intel/indexer/codebase-index.js';
import { buildSmartContext, formatContextForLlm } from '../code-intel/analysis/smart-context.js';
import { runTypeCheck, runTests, type VerificationResult } from './verification/verify-runner.js';
import { AutoFixer, type FixResult } from './fix-loop/auto-fixer.js';
import { GitManager } from './git-ops/git-manager.js';
import { readFileSync, writeFileSync } from 'node:fs';

const log = getLogger().child({ component: 'task-executor' });

export interface TaskExecutorDeps {
  llm: LlmProvider;
  executeTool: (call: ToolCall, runId: string) => Promise<ToolResult>;
  cwd: string;
  autoCommit?: boolean;
  autoFix?: boolean;
  maxFixAttempts?: number;
}

export interface TaskExecutionResult {
  success: boolean;
  filesChanged: string[];
  verificationResults: VerificationResult[];
  fixResults: FixResult[];
  commitHash?: string;
  summary: string;
  durationMs: number;
}

export class TaskExecutor {
  private deps: TaskExecutorDeps;
  private index: CodebaseIndex | null = null;
  private autoFixer: AutoFixer;
  private git: GitManager;

  constructor(deps: TaskExecutorDeps) {
    this.deps = deps;
    this.autoFixer = new AutoFixer(
      deps.llm,
      async (path) => readFileSync(path, 'utf-8'),
      async (path, content) => writeFileSync(path, content),
    );
    this.git = new GitManager(deps.cwd, deps.llm);
  }

  async execute(task: string): Promise<TaskExecutionResult> {
    const start = performance.now();
    const filesChanged: string[] = [];
    const verifications: VerificationResult[] = [];
    const fixes: FixResult[] = [];

    log.info({ task: task.slice(0, 100) }, 'autonomous task started');

    // Step 1: Index the codebase
    if (!this.index) {
      this.index = buildCodebaseIndex(this.deps.cwd);
    }

    // Step 2: Build smart context
    const contextChunks = buildSmartContext(this.index, task);
    const codeContext = formatContextForLlm(contextChunks);

    // Step 3: Plan and execute with LLM
    const plan = await this.planTask(task, codeContext);

    for (const step of plan) {
      try {
        const result = await this.deps.executeTool(step.call, 'autonomous');
        if (result.success && step.call.name === 'write_file') {
          const params = step.call.params as { path?: string };
          if (params.path) filesChanged.push(params.path);
        }
        if (result.success && step.call.name === 'patch_file') {
          const params = step.call.params as { path?: string };
          if (params.path) filesChanged.push(params.path);
        }
      } catch (err) {
        log.warn({ step: step.description, err: err instanceof Error ? err.message : 'Unknown' }, 'step failed');
      }
    }

    // Step 4: Verify
    const typeCheck = runTypeCheck(this.deps.cwd);
    verifications.push(typeCheck);

    // Step 5: Auto-fix if enabled and there are errors
    if (this.deps.autoFix !== false && !typeCheck.passed) {
      log.info({ errors: typeCheck.errors.length }, 'running auto-fix');
      const fixResult = await this.autoFixer.fixErrors(typeCheck.errors, this.deps.maxFixAttempts ?? 3);
      fixes.push(fixResult);

      if (fixResult.success) {
        // Re-verify
        const reCheck = runTypeCheck(this.deps.cwd);
        verifications.push(reCheck);

        if (!reCheck.passed) {
          await this.autoFixer.rollback(fixResult.attempts);
          log.warn('auto-fix made things worse — rolled back');
        } else {
          for (const attempt of fixResult.attempts) {
            filesChanged.push(attempt.file);
          }
        }
      }
    }

    // Step 6: Run tests
    const testResult = runTests(this.deps.cwd);
    verifications.push(testResult);

    // Step 7: Commit if all passed
    let commitHash: string | undefined;
    const allPassed = verifications.every((v) => v.passed);

    if (this.deps.autoCommit && allPassed && filesChanged.length > 0) {
      this.git.stageAll();
      const commitResult = await this.git.commit(task);
      commitHash = commitResult.commitHash;
    }

    const durationMs = Math.round(performance.now() - start);
    const summary = this.buildSummary(task, filesChanged, verifications, allPassed, commitHash);

    log.info({
      success: allPassed,
      files: filesChanged.length,
      durationMs,
      commit: commitHash,
    }, 'autonomous task completed');

    return {
      success: allPassed,
      filesChanged,
      verificationResults: verifications,
      fixResults: fixes,
      commitHash,
      summary,
      durationMs,
    };
  }

  reindex(): void {
    this.index = buildCodebaseIndex(this.deps.cwd);
  }

  private async planTask(task: string, codeContext: string): Promise<Array<{ description: string; call: ToolCall }>> {
    const completion = await this.deps.llm.complete([
      {
        role: 'system',
        content: `You are an autonomous coding agent. Given a task and relevant code context, plan the tool calls needed.

Respond ONLY with JSON array:
[
  { "description": "what this step does", "call": { "name": "tool_name", "params": { ... } } }
]

Available tools: write_file (path, content), patch_file (path, search, replace), read_file_content (path), execute_bash (command)`,
      },
      { role: 'user', content: `Task: ${task}\n\n${codeContext}` },
    ], { temperature: 0.2 });

    try {
      const match = completion.content.match(/\[[\s\S]*\]/);
      if (!match) return [];

      const parsed = JSON.parse(match[0]) as Array<{ description: string; call: { name: string; params: Record<string, unknown> } }>;
      return parsed.filter((s) => s.call?.name && s.call?.params);
    } catch {
      return [];
    }
  }

  private buildSummary(
    task: string,
    files: string[],
    verifications: VerificationResult[],
    allPassed: boolean,
    commitHash?: string,
  ): string {
    const parts = [`Task: ${task}`];
    parts.push(`Files changed: ${files.length > 0 ? files.join(', ') : 'none'}`);

    for (const v of verifications) {
      parts.push(`${v.type}: ${v.passed ? '✓' : '✗'} ${v.errors.length > 0 ? `(${v.errors.length} errors)` : ''}`);
    }

    if (commitHash) parts.push(`Committed: ${commitHash}`);
    parts.push(`Result: ${allPassed ? '✓ All checks passed' : '✗ Some checks failed'}`);

    return parts.join('\n');
  }
}
