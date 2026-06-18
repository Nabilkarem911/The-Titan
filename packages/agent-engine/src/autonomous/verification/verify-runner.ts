import { execSync } from 'node:child_process';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'verify-runner' });

export interface VerificationResult {
  type: 'typecheck' | 'test' | 'lint' | 'build';
  passed: boolean;
  errors: string[];
  warnings: string[];
  durationMs: number;
}

export function runTypeCheck(cwd: string, tsconfigPath?: string): VerificationResult {
  const start = performance.now();
  const cmd = tsconfigPath ? `npx tsc -p ${tsconfigPath} --noEmit` : 'npx tsc --noEmit';

  try {
    execSync(cmd, { cwd, encoding: 'utf-8', stdio: 'pipe' });
    return { type: 'typecheck', passed: true, errors: [], warnings: [], durationMs: elapsed(start) };
  } catch (err) {
    const output = (err as { stdout?: string; stderr?: string }).stdout ?? (err as { stderr?: string }).stderr ?? '';
    const errors = parseTypeErrors(output);
    return { type: 'typecheck', passed: false, errors, warnings: [], durationMs: elapsed(start) };
  }
}

export function runTests(cwd: string, testCmd?: string): VerificationResult {
  const start = performance.now();
  const cmd = testCmd ?? 'npx vitest run --reporter=verbose';

  try {
    const output = execSync(cmd, { cwd, encoding: 'utf-8', stdio: 'pipe', timeout: 120000 });
    const warnings = output.includes('warn') ? ['Some warnings in test output'] : [];
    return { type: 'test', passed: true, errors: [], warnings, durationMs: elapsed(start) };
  } catch (err) {
    const output = (err as { stdout?: string }).stdout ?? '';
    const errors = parseTestErrors(output);
    return { type: 'test', passed: false, errors, warnings: [], durationMs: elapsed(start) };
  }
}

export function runLint(cwd: string): VerificationResult {
  const start = performance.now();

  try {
    execSync('npx eslint . --max-warnings 0', { cwd, encoding: 'utf-8', stdio: 'pipe', timeout: 60000 });
    return { type: 'lint', passed: true, errors: [], warnings: [], durationMs: elapsed(start) };
  } catch (err) {
    const output = (err as { stdout?: string }).stdout ?? '';
    const errors = output.split('\n').filter((l) => l.includes('error')).slice(0, 20);
    const warnings = output.split('\n').filter((l) => l.includes('warning')).slice(0, 10);
    return { type: 'lint', passed: false, errors, warnings, durationMs: elapsed(start) };
  }
}

export function runBuild(cwd: string, buildCmd?: string): VerificationResult {
  const start = performance.now();
  const cmd = buildCmd ?? 'npm run build';

  try {
    execSync(cmd, { cwd, encoding: 'utf-8', stdio: 'pipe', timeout: 120000 });
    return { type: 'build', passed: true, errors: [], warnings: [], durationMs: elapsed(start) };
  } catch (err) {
    const output = (err as { stdout?: string; stderr?: string }).stdout ?? (err as { stderr?: string }).stderr ?? '';
    return { type: 'build', passed: false, errors: [output.slice(0, 2000)], warnings: [], durationMs: elapsed(start) };
  }
}

export function runFullVerification(cwd: string): VerificationResult[] {
  const results: VerificationResult[] = [];

  results.push(runTypeCheck(cwd));
  if (results[results.length - 1].passed) {
    results.push(runTests(cwd));
  }

  log.info({
    passed: results.every((r) => r.passed),
    checks: results.map((r) => `${r.type}:${r.passed ? 'ok' : 'fail'}`).join(', '),
  }, 'verification complete');

  return results;
}

function parseTypeErrors(output: string): string[] {
  return output
    .split('\n')
    .filter((l) => l.includes('error TS'))
    .map((l) => l.trim())
    .slice(0, 20);
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
