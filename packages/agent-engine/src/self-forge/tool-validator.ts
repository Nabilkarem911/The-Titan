import { writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { ForgedToolSpec } from './tool-forger.js';

export interface ValidationResult {
  passed: boolean;
  errors: string[];
  testResults: Array<{ passed: boolean; error?: string }>;
  durationMs: number;
}

export class ToolValidator {
  private forgeDir: string;

  constructor() {
    this.forgeDir = join(tmpdir(), 'titan-forged-tools');
    if (!existsSync(this.forgeDir)) {
      try { mkdirSync(this.forgeDir, { recursive: true }); } catch { /* may fail on some systems */ }
    }
  }

  async validate(spec: ForgedToolSpec): Promise<ValidationResult> {
    const errors: string[] = [];
    const testResults: Array<{ passed: boolean; error?: string }> = [];
    const start = performance.now();

    // 1. Static checks
    if (!spec.sourceCode.includes('export') && !spec.sourceCode.includes('handler')) {
      errors.push('Source code must export a handler function');
    }

    if (spec.sourceCode.length > 10_000) {
      errors.push('Source code exceeds 10KB limit');
    }

    // Check for forbidden patterns
    const forbidden = ['eval(', 'Function(', 'child_process', 'require(', 'process.exit', 'rmSync', 'unlinkSync'];
    const lowerCode = spec.sourceCode.toLowerCase();
    for (const pattern of forbidden) {
      if (lowerCode.includes(pattern.toLowerCase())) {
        errors.push(`Forbidden pattern detected: ${pattern}`);
      }
    }

    if (errors.length > 0) {
      return { passed: false, errors, testResults, durationMs: Math.round(performance.now() - start) };
    }

    // 2. Dynamic test — write to temp file and try to import
    const toolId = randomUUID().slice(0, 8);
    const tempFile = join(this.forgeDir, `forged_${toolId}.mjs`);

    try {
      // Wrap the code to make it importable
      const wrappedCode = `${spec.sourceCode}\nexport { handler };\n`;
      writeFileSync(tempFile, wrappedCode, 'utf-8');

      // Try to import dynamically
      const fileUrl = `file://${tempFile.replace(/\\/g, '/')}`;
      const mod = await import(fileUrl);

      if (typeof mod.handler !== 'function') {
        errors.push('Module does not export a handler function');
        return { passed: false, errors, testResults, durationMs: Math.round(performance.now() - start) };
      }

      // 3. Run test cases
      for (const tc of spec.testCases) {
        try {
          const result = await mod.handler(tc.params);
          const resultStr = typeof result === 'string' ? result : JSON.stringify(result);

          if (tc.expectedContains && !resultStr.includes(tc.expectedContains)) {
            testResults.push({ passed: false, error: `Expected to contain "${tc.expectedContains}" but got: ${resultStr.slice(0, 200)}` });
          } else {
            testResults.push({ passed: true });
          }
        } catch (err) {
          testResults.push({ passed: false, error: err instanceof Error ? err.message : String(err) });
        }
      }

      // Must pass at least 1 test case (or have no test cases = just import check)
      const allPassed = testResults.length === 0 || testResults.every((t) => t.passed);

      return {
        passed: errors.length === 0 && allPassed,
        errors,
        testResults,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (err) {
      errors.push(`Import/execution failed: ${err instanceof Error ? err.message : String(err)}`);
      return { passed: false, errors, testResults, durationMs: Math.round(performance.now() - start) };
    } finally {
      // Cleanup temp file
      try { if (existsSync(tempFile)) unlinkSync(tempFile); } catch { /* ignore */ }
    }
  }
}
