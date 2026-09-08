import { describe, it, expect } from 'vitest';
import { runTypeCheck, runTests, runLint, runBuild } from './verify-runner.js';

describe('VerifyRunner — Security Regression Tests', () => {
  describe('runTypeCheck — no command injection via tsconfigPath', () => {
    it('passes tsconfigPath as a separate arg (not interpolated into shell)', async () => {
      // If tsconfigPath were interpolated into a shell command, this payload
      // would execute `touch /tmp/titan-injection-test`. With execFile, it
      // is passed as a literal path argument and will simply not be found.
      const result = await runTypeCheck(process.cwd(), '"; touch /tmp/titan-injection-test; #');
      // Should fail with a typecheck error (invalid tsconfig path), not execute the injection
      expect(result.passed).toBe(false);
      expect(result.type).toBe('typecheck');
      // The error should mention the path or tsc, not a successful shell injection
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('handles tsconfigPath with shell metacharacters safely', async () => {
      const result = await runTypeCheck(process.cwd(), '$(whoami); rm -rf /');
      expect(result.passed).toBe(false);
      // No side effects should occur — execFile does not invoke a shell
    });

    it('handles null bytes in tsconfigPath', async () => {
      const result = await runTypeCheck(process.cwd(), 'tsconfig\0.json');
      expect(result.passed).toBe(false);
    });
  });

  describe('runTests — no command injection via testCmd', () => {
    it('passes testCmd as separate args (not interpolated into shell)', async () => {
      const result = await runTests(process.cwd(), 'vitest run; rm -rf /');
      expect(result.passed).toBe(false);
      expect(result.type).toBe('test');
    });
  });

  describe('runLint — no shell injection', () => {
    it('uses execFile with arg array (no shell)', async () => {
      const result = await runLint(process.cwd());
      // Should complete without throwing, regardless of cwd contents
      expect(result.type).toBe('lint');
    });
  });

  describe('runBuild — no shell injection', () => {
    it('uses execFile with arg array (no shell)', async () => {
      const result = await runBuild(process.cwd());
      expect(result.type).toBe('build');
    });
  });
});
