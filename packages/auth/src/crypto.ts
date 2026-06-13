import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export async function hashPassword(plain: string): Promise<string> {
  const bcrypt = await import('bcrypt');
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcrypt');
  return bcrypt.compare(plain, hash);
}

const API_KEY_PREFIX = 'tk_';
const API_KEY_BYTES = 32;

export interface GeneratedApiKey {
  plaintext: string;
  hash: string;
  keyPrefix: string;
}

export function generateApiKey(): GeneratedApiKey {
  const displayPrefix = randomBytes(4).toString('hex');
  const secret = randomBytes(API_KEY_BYTES).toString('base64url');
  const plaintext = `${API_KEY_PREFIX}${displayPrefix}_${secret}`;
  const hash = sha256Hex(plaintext);
  return { plaintext, hash, keyPrefix: `${API_KEY_PREFIX}${displayPrefix}` };
}

export function hashApiKey(plaintext: string): string {
  return sha256Hex(plaintext);
}

export function verifyApiKey(plaintext: string, expectedHash: string): boolean {
  const computed = sha256Hex(plaintext);
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

const REFRESH_TOKEN_BYTES = 48;

export function generateRefreshToken(): { plaintext: string; hash: string } {
  const plaintext = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  return { plaintext, hash: sha256Hex(plaintext) };
}

export function hashRefreshToken(plaintext: string): string {
  return sha256Hex(plaintext);
}

export function verifyRefreshToken(plaintext: string, expectedHash: string): boolean {
  const computed = sha256Hex(plaintext);
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
