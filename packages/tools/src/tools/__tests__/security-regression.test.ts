import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeFile } from '../writeFile.js';
import { excelRead } from '../excelRead.js';
import { logSearch } from '../logSearch.js';

describe('Security Regression Tests — P0 Fixes', () => {

  describe('processManager — command injection prevention', () => {
    it('should reject non-numeric pid', async () => {
      const { processManager } = await import('../processManager.js');
      await expect(
        processManager({ action: 'info', pid: '1; rm -rf /' as unknown as number })
      ).rejects.toThrow('Invalid pid');
    });

    it('should reject negative pid', async () => {
      const { processManager } = await import('../processManager.js');
      await expect(
        processManager({ action: 'info', pid: -1 })
      ).rejects.toThrow('Invalid pid');
    });

    it('should reject process name with shell metacharacters', async () => {
      const { processManager } = await import('../processManager.js');
      await expect(
        processManager({ action: 'find', name: '"; rm -rf / "' })
      ).rejects.toThrow('Invalid process name');
    });

    it('should reject process name with semicolon', async () => {
      const { processManager } = await import('../processManager.js');
      await expect(
        processManager({ action: 'find', name: 'foo; bar' })
      ).rejects.toThrow('Invalid process name');
    });
  });

  describe('databaseBackup — command injection prevention', () => {
    it('should reject database name with shell metacharacters', async () => {
      const { databaseBackup } = await import('../databaseBackup.js');
      await expect(
        databaseBackup({ action: 'backup', database: 'titan; rm -rf /' })
      ).rejects.toThrow('Invalid database name');
    });

    it('should reject output path with path traversal', async () => {
      const { databaseBackup } = await import('../databaseBackup.js');
      await expect(
        databaseBackup({ action: 'backup', outputPath: '/etc/passwd' })
      ).rejects.toThrow('Output path must be within /tmp or /var');
    });

    it('should reject output path with .. traversal', async () => {
      const { databaseBackup } = await import('../databaseBackup.js');
      await expect(
        databaseBackup({ action: 'backup', outputPath: '/tmp/../../etc/passwd.sql' })
      ).rejects.toThrow('Path traversal not allowed');
    });

    it('should reject output path not ending in .sql', async () => {
      const { databaseBackup } = await import('../databaseBackup.js');
      await expect(
        databaseBackup({ action: 'backup', outputPath: '/tmp/backup.sh' })
      ).rejects.toThrow('Output path must end with .sql');
    });
  });

  describe('writeFile — path traversal prevention', () => {
    it('should reject path outside workspace', async () => {
      await expect(
        writeFile({ filePath: '/etc/passwd', content: 'test' })
      ).rejects.toThrow();
    });

    it('should reject path with .. traversal', async () => {
      await expect(
        writeFile({ filePath: '../../../etc/passwd', content: 'test' })
      ).rejects.toThrow();
    });
  });

  describe('excelRead — path traversal prevention', () => {
    it('should reject path outside workspace', async () => {
      await expect(
        excelRead({ path: '/etc/shadow' })
      ).rejects.toThrow();
    });
  });

  describe('logSearch — path traversal prevention', () => {
    it('should reject path outside allowed log directories', async () => {
      await expect(
        logSearch({ query: 'test', path: '/etc' })
      ).rejects.toThrow('allowed directories');
    });

    it('should reject path traversal with ..', async () => {
      await expect(
        logSearch({ query: 'test', path: '/var/log/../../etc' })
      ).rejects.toThrow('allowed directories');
    });

    it('should accept /var/log', async () => {
      await expect(
        logSearch({ query: 'test', path: '/var/log' })
      ).resolves.toBeDefined();
    });
  });

  describe('plugin-runner — sandbox security', () => {
    it('should not expose require in sandbox', async () => {
      const { PluginRunner } = await import('@titan/agent-engine');
      const runner = new PluginRunner();

      await runner.load({
        name: 'test-require',
        version: '1.0.0',
        tools: [{ name: 'test', description: 'test' }],
        code: `module.exports.test = async () => { return typeof require }`,
      });

      const result = await runner.executeTool('test-require', 'test', {});
      expect(result).toBe('undefined');
    });

    it('should not expose fetch in sandbox', async () => {
      const { PluginRunner } = await import('@titan/agent-engine');
      const runner = new PluginRunner();

      await runner.load({
        name: 'test-fetch',
        version: '1.0.0',
        tools: [{ name: 'test', description: 'test' }],
        code: `module.exports.test = async () => { return typeof fetch }`,
      });

      const result = await runner.executeTool('test-fetch', 'test', {});
      expect(result).toBe('undefined');
    });

    it('should reject remote code without checksum', async () => {
      const { PluginRunner } = await import('@titan/agent-engine');
      const runner = new PluginRunner();

      await expect(
        runner.load({
          name: 'test-remote-no-checksum',
          version: '1.0.0',
          tools: [{ name: 'test', description: 'test' }],
          codeUrl: 'https://evil.example.com/plugin.js',
        })
      ).rejects.toThrow('checksum');
    });
  });
});
