import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'verify-runner' });
const execFileAsync = promisify(execFile);

export interface VerificationResult {
  type: 'typecheck' | 'test' | 'lint' | 'build';
  passed: boolean;
  errors: string[];
  warnings: string[];
  durationMs: number;
}

export async function runTypeCheck(cwd: string, tsconfigPath?: string): Promise<VerificationResult> {
  const start = performance.now();
  const args = ['tsc', '--noEmit'];
  if (tsconfigPath) {
    args.push('-p', tsconfigPath);
  }

  try {
    await execFileAsync('npx', args, { cwd, encoding: 'utf-8', timeout: 120000 });
    return { type: 'typecheck', passed: true, errors: [], warnings: [], durationMs: elapsed(start) };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    const output = [e.stdout ?? '', e.stderr ?? ''].join('\n');
    const errors = parseTypeErrors(output);
    return { type: 'typecheck', passed: false, errors, warnings: [], durationMs: elapsed(start) };
  }
}

export async function runTests(cwd: string, testCmd?: string): Promise<VerificationResult> {
  const start = performance.now();

  try {
    const { stdout } = await execFileAsync('npx', testCmd ? testCmd.split(' ') : ['vitest', 'run', '--reporter=verbose'], {
      cwd,
      encoding: 'utf-8',
      timeout: 120000,
    });
    const warnings = stdout.includes('warn') ? ['Some warnings in test output'] : [];
    return { type: 'test', passed: true, errors: [], warnings, durationMs: elapsed(start) };
  } catch (err) {
    const e = err as { stdout?: string };
    const output = e.stdout ?? '';
    const errors = parseTestErrors(output);
    return { type: 'test', passed: false, errors, warnings: [], durationMs: elapsed(start) };
  }
}

export async function runLint(cwd: string): Promise<VerificationResult> {
  const start = performance.now();

  try {
    await execFileAsync('npx', ['eslint', '.', '--max-warnings', '0'], {
      cwd,
      encoding: 'utf-8',
      timeout: 60000,
    });
    return { type: 'lint', passed: true, errors: [], warnings: [], durationMs: elapsed(start) };
  } catch (err) {
    const e = err as { stdout?: string };
    const output = e.stdout ?? '';
    const errors = output.split('\n').filter((l) => l.includes('error')).slice(0, 20);
    const warnings = output.split('\n').filter((l) => l.includes('warning')).slice(0, 10);
    return { type: 'lint', passed: false, errors, warnings, durationMs: elapsed(start) };
  }
}

export async function runBuild(cwd: string, _buildCmd?: string): Promise<VerificationResult> {
  const start = performance.now();

  try {
    await execFileAsync('npm', ['run', 'build'], {
      cwd,
      encoding: 'utf-8',
      timeout: 120000,
    });
    return { type: 'build', passed: true, errors: [], warnings: [], durationMs: elapsed(start) };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    const output = e.stdout ?? e.stderr ?? '';
    return { type: 'build', passed: false, errors: [output.slice(0, 2000)], warnings: [], durationMs: elapsed(start) };
  }
}

export async function runFullVerification(cwd: string): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];

  results.push(await runTypeCheck(cwd));
  if (results[results.length - 1].passed) {
    results.push(await runTests(cwd));
  }

  log.info({
    passed: results.every((r) => r.passed),
    checks: results.map((r) => `${r.type}:${r.passed ? 'ok' : 'fail'}`).join(', '),
  }, 'verification complete');

  return results;
}

function parseTypeErrors(output: string): string[] {
  const tsErrors = output
    .split('\n')
    .filter((l) => l.includes('error TS'))
    .map((l) => l.trim())
    .slice(0, 20);
  if (tsErrors.length > 0) return tsErrors;
  // Fall back to any non-empty error-like output lines
  const genericErrors = output
    .split('\n')
    .filter((l) => l.trim().length > 0 && (l.includes('error') || l.includes('Error') || l.includes('not found') || l.includes('Cannot')))
    .map((l) => l.trim())
    .slice(0, 20);
  if (genericErrors.length > 0) return genericErrors;
  // Final fallback: if there's any non-empty output, report it as an error
  const lines = output.split('\n').filter((l) => l.trim().length > 0).slice(0, 5);
  return lines.length > 0 ? lines : ['Typecheck failed'];
}

function parseTestErrors(output: string): string[] {
  return output
    .split('\n')
    .filter((l) => l.includes('FAIL') || l.includes('AssertionError') || l.includes('Error:'))
    .map((l) => l.trim())
    .slice(0, 20);
}

function elapsed(start: number): number {
  return Math.round(performance.now() - start);
}
