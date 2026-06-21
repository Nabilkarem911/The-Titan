import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateApiKey,
  hashApiKey,
  verifyApiKey,
  generateRefreshToken,
  hashRefreshToken,
  verifyRefreshToken,
} from './crypto.js';

describe('Password hashing (bcrypt)', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('my-secret-password');
    expect(hash).toMatch(/^\$2[aby]\$/);
    const ok = await verifyPassword('my-secret-password', hash);
    expect(ok).toBe(true);
  });

  it('rejects wrong password', async () => {
    const hash = await hashPassword('correct-password');
    const ok = await verifyPassword('wrong-password', hash);
    expect(ok).toBe(false);
  });

  it('rejects empty password against any hash', async () => {
    const hash = await hashPassword('some-password');
    const ok = await verifyPassword('', hash);
    expect(ok).toBe(false);
  });
});

describe('API key generation and verification', () => {
  it('generates a key with correct prefix format', () => {
    const key = generateApiKey();
    expect(key.plaintext).toMatch(/^tk_[a-f0-9]{8}_[A-Za-z0-9_-]+$/);
    expect(key.keyPrefix).toMatch(/^tk_[a-f0-9]{8}$/);
    expect(key.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces unique keys each time', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.plaintext).not.toBe(b.plaintext);
    expect(a.hash).not.toBe(b.hash);
  });

  it('hashApiKey matches generateApiKey hash', () => {
    const key = generateApiKey();
    const computed = hashApiKey(key.plaintext);
    expect(computed).toBe(key.hash);
  });

  it('verifyApiKey accepts correct key', () => {
    const key = generateApiKey();
    expect(verifyApiKey(key.plaintext, key.hash)).toBe(true);
  });

  it('verifyApiKey rejects tampered key', () => {
    const key = generateApiKey();
    const tampered = key.plaintext.slice(0, -1) + 'X';
    expect(verifyApiKey(tampered, key.hash)).toBe(false);
  });

  it('verifyApiKey rejects wrong hash length', () => {
    expect(verifyApiKey('tk_12345678_abc', 'short')).toBe(false);
  });
});

describe('Refresh token generation and verification', () => {
  it('generates plaintext and hash', () => {
    const token = generateRefreshToken();
    expect(token.plaintext).toBeTruthy();
    expect(token.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(token.plaintext.length).toBeGreaterThan(20);
  });

  it('produces unique tokens each time', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a.plaintext).not.toBe(b.plaintext);
    expect(a.hash).not.toBe(b.hash);
  });

  it('hashRefreshToken matches generated hash', () => {
    const token = generateRefreshToken();
    expect(hashRefreshToken(token.plaintext)).toBe(token.hash);
  });

  it('verifyRefreshToken accepts correct token', () => {
    const token = generateRefreshToken();
    expect(verifyRefreshToken(token.plaintext, token.hash)).toBe(true);
  });

  it('verifyRefreshToken rejects tampered token', () => {
    const token = generateRefreshToken();
    const tampered = token.plaintext.slice(0, -2) + (token.plaintext.slice(-2, -1) === 'X' ? 'Y' : 'X') + token.plaintext.slice(-1);
    expect(verifyRefreshToken(tampered, token.hash)).toBe(false);
  });

  it('verifyRefreshToken rejects wrong hash length', () => {
    expect(verifyRefreshToken('some-token', 'badhash')).toBe(false);
  });
});
