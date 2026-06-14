import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, encryptToJson, decryptFromJson } from './encryption.js';

describe('Encryption', () => {
  it('encrypts and decrypts a string', () => {
    const original = 'sensitive-data-123';
    const encrypted = encrypt(original);
    expect(encrypted.ciphertext).toBeTruthy();
    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.salt).toBeTruthy();
    expect(encrypted.tag).toBeTruthy();

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it('round-trips via JSON helpers', () => {
    const original = 'gdpr-personal-data';
    const json = encryptToJson(original);
    const decrypted = decryptFromJson(json);
    expect(decrypted).toBe(original);
  });

  it('produces different ciphertext for same plaintext', () => {
    const original = 'same-text';
    const e1 = encrypt(original);
    const e2 = encrypt(original);
    expect(e1.ciphertext).not.toBe(e2.ciphertext);
    expect(decrypt(e1)).toBe(original);
    expect(decrypt(e2)).toBe(original);
  });

  it('handles empty string', () => {
    const encrypted = encrypt('');
    expect(decrypt(encrypted)).toBe('');
  });

  it('handles unicode', () => {
    const original = 'مرحبا 🌍 你好';
    const encrypted = encrypt(original);
    expect(decrypt(encrypted)).toBe(original);
  });
});
