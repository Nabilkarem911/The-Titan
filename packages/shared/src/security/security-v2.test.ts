import { describe, it, expect } from 'vitest';
import { FileValidator } from './file-validator.js';
import { SecretRotation } from './secret-rotation.js';
import { SessionMonitor } from './session-monitor.js';

describe('FileValidator', () => {
  const v = new FileValidator();

  it('accepts valid files', () => {
    expect(v.validate('report.pdf', 1024 * 1024, 'application/pdf').valid).toBe(true);
    expect(v.validate('data.csv', 500, 'text/csv').valid).toBe(true);
  });

  it('rejects dangerous extensions', () => {
    expect(v.validate('virus.exe', 1024).valid).toBe(false);
    expect(v.validate('script.bat', 512).valid).toBe(false);
    expect(v.validate('hack.ps1', 256).valid).toBe(false);
  });

  it('rejects oversized files', () => {
    expect(v.validate('big.zip', 100 * 1024 * 1024).valid).toBe(false);
  });

  it('rejects path traversal', () => {
    expect(v.validate('../../../etc/passwd', 100).valid).toBe(false);
  });

  it('sanitizes filenames', () => {
    expect(v.sanitizeFilename('my<file>name.txt')).toBe('my_file_name.txt');
    expect(v.sanitizeFilename('../../../etc/passwd')).not.toContain('..');
  });
});

describe('SecretRotation', () => {
  it('registers and tracks secrets', () => {
    const rotation = new SecretRotation();
    rotation.register('jwt_secret', { maxAgeDays: 90, notifyBeforeDays: 14, autoRotate: false });
    const status = rotation.getStatus();
    expect(status.length).toBe(1);
    expect(status[0].status).toBe('ok');
  });

  it('detects expiring secrets', () => {
    const rotation = new SecretRotation();
    const record = rotation.register('old_key', { maxAgeDays: 0, notifyBeforeDays: 1, autoRotate: false });
    record.expiresAt = new Date(Date.now() + 86400000 * 0.5); // expires in 12 hours

    const expiring = rotation.checkExpiring();
    expect(expiring.length).toBe(1);
  });

  it('rotates secrets', () => {
    const rotation = new SecretRotation();
    rotation.register('api_key', { maxAgeDays: 30, notifyBeforeDays: 7, autoRotate: true });
    const result = rotation.rotate('api_key');
    expect(result).not.toBeNull();
    expect(result!.newValue.length).toBe(64); // 32 bytes = 64 hex chars
  });

  it('generates keys', () => {
    const rotation = new SecretRotation();
    const key = rotation.generateKey(16);
    expect(key.length).toBe(32); // 16 bytes = 32 hex chars
  });
});

describe('SessionMonitor', () => {
  it('tracks sessions per user', () => {
    const monitor = new SessionMonitor(3);
    monitor.register({ sessionId: 's1', userId: 'u1', ip: '1.1.1.1', userAgent: 'Chrome', createdAt: new Date(), lastActivity: new Date() });
    monitor.register({ sessionId: 's2', userId: 'u1', ip: '2.2.2.2', userAgent: 'Firefox', createdAt: new Date(), lastActivity: new Date() });

    expect(monitor.getUserSessions('u1').length).toBe(2);
  });

  it('evicts oldest session when limit reached', () => {
    const monitor = new SessionMonitor(2);
    monitor.register({ sessionId: 's1', userId: 'u1', ip: '1.1.1.1', userAgent: 'A', createdAt: new Date(), lastActivity: new Date() });
    monitor.register({ sessionId: 's2', userId: 'u1', ip: '2.2.2.2', userAgent: 'B', createdAt: new Date(), lastActivity: new Date() });
    const result = monitor.register({ sessionId: 's3', userId: 'u1', ip: '3.3.3.3', userAgent: 'C', createdAt: new Date(), lastActivity: new Date() });

    expect(result.evicted).toBe('s1');
    expect(monitor.getUserSessions('u1').length).toBe(2);
  });

  it('detects new device', () => {
    const monitor = new SessionMonitor();
    monitor.register({ sessionId: 's1', userId: 'u1', ip: '1.1.1.1', userAgent: 'Chrome/120', createdAt: new Date(), lastActivity: new Date() });

    expect(monitor.isNewDevice('u1', 'Safari/17')).toBe(true);
    expect(monitor.isNewDevice('u1', 'Chrome/120')).toBe(false);
  });

  it('detects anomalies', () => {
    const monitor = new SessionMonitor();
    monitor.register({ sessionId: 's1', userId: 'u1', ip: '1.1.1.1', userAgent: 'Chrome', createdAt: new Date(), lastActivity: new Date() });

    const anomalies = monitor.detectAnomaly('u1', '9.9.9.9', 'Firefox');
    expect(anomalies.length).toBe(2); // New device + new IP
  });

  it('removes sessions', () => {
    const monitor = new SessionMonitor();
    monitor.register({ sessionId: 's1', userId: 'u1', ip: '1.1.1.1', userAgent: 'A', createdAt: new Date(), lastActivity: new Date() });
    monitor.remove('s1');
    expect(monitor.getUserSessions('u1').length).toBe(0);
  });
});
