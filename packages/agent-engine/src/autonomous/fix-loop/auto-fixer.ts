import { getLogger } from '@titan/logging';
import type { LlmProvider } from '../../types.js';
import type { VerificationResult } from '../verification/verify-runner.js';

const log = getLogger().child({ component: 'auto-fixer' });

interface FixAttempt {
  file: string;
  originalContent: string;
  fixedContent: string;
  error: string;
  fixDescription: string;
}

export interface FixResult {
  success: boolean;
  attempts: FixAttempt[];
  remainingErrors: string[];
}

const FIX_PROMPT = `You are fixing a code error. Given the error message and the file content, provide the COMPLETE fixed file content.

Rules:
1. Fix ONLY the specific error — don't refactor or change other code
2. Preserve all existing functionality
3. Return ONLY the fixed file content, nothing else — no markdown, no explanation

Error: {error}

File ({filePath}):
{content}`;

export class AutoFixer {
  constructor(
    private llm: LlmProvider,
    private readFile: (path: string) => Promise<string>,
    private writeFile: (path: string, content: string) => Promise<void>,
  ) {}

  async fixErrors(errors: string[], maxAttempts = 3): Promise<FixResult> {
    const attempts: FixAttempt[] = [];
    const remaining = [...errors];

    for (let i = 0; i < maxAttempts && remaining.length > 0; i++) {
      const error = remaining[0];
      const filePath = this.extractFilePath(error);
      if (!filePath) {
        remaining.shift();
        continue;
      }

      try {
        const original = await this.readFile(filePath);
        const fixed = await this.generateFix(filePath, original, error);

        if (fixed && fixed !== original) {
          await this.writeFile(filePath, fixed);
          attempts.push({
            file: filePath,
            originalContent: original,
            fixedContent: fixed,
            error,
            fixDescription: `Fixed error in ${filePath}`,
          });
          remaining.shift();
          log.info({ file: filePath, attempt: i + 1 }, 'auto-fix applied');
        } else {
          remaining.shift();
          log.warn({ file: filePath }, 'no fix generated — skipping');
        }
      } catch (err) {
        log.error({ file: filePath, err: err instanceof Error ? err.message : 'Unknown' }, 'auto-fix failed');
        remaining.shift();
      }
    }

    return { success: remaining.length === 0, attempts, remainingErrors: remaining };
  }

  async rollback(attempts: FixAttempt[]): Promise<void> {
    for (const attempt of attempts.reverse()) {
      try {
        await this.writeFile(attempt.file, attempt.originalContent);
        log.info({ file: attempt.file }, 'rollback applied');
      } catch (err) {
        log.error({ file: attempt.file }, 'rollback failed');
      }
    }
  }

  private async generateFix(filePath: string, content: string, error: string): Promise<string | null> {
    const prompt = FIX_PROMPT
      .replace('{error}', error)
      .replace('{filePath}', filePath)
      .replace('{content}', content.slice(0, 10000));

    try {
      const completion = await this.llm.complete([
        { role: 'system', content: 'You fix code errors. Return ONLY the corrected file content.' },
        { role: 'user', content: prompt },
      ], { temperature: 0.1 });

      let fixed = completion.content.trim();
      // Strip markdown code fences if present
      fixed = fixed.replace(/^```\w*\n/, '').replace(/\n```$/, '');
      return fixed;
    } catch {
      return null;
    }
  }

  private extractFilePath(error: string): string | null {
    // TypeScript: "src/file.ts(10,5): error TS..."
    const tsMatch = error.match(/^([^\s(]+)\(\d+,\d+\)/);
    if (tsMatch) return tsMatch[1];

    // Generic: "/path/to/file.ts:10:5"
    const genericMatch = error.match(/([^\s:]+\.[a-z]+):\d+/);
    if (genericMatch) return genericMatch[1];

    return null;
  }
}
