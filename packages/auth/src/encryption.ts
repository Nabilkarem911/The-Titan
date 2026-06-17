import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;

function getKey(salt: Buffer): Buffer {
  const secret = process.env['ENCRYPTION_KEY'] ?? process.env['API_KEY_ENCRYPTION_KEY'];
  if (!secret) {
    throw new Error('ENCRYPTION_KEY or API_KEY_ENCRYPTION_KEY environment variable is required for encryption operations');
  }
  return scryptSync(secret, salt, 32);
}

export interface EncryptedField {
  ciphertext: string;
  salt: string;
  iv: string;
  tag: string;
}

export function encrypt(plaintext: string): EncryptedField {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = getKey(salt);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString('base64'),
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function decrypt(field: EncryptedField): string {
  const salt = Buffer.from(field.salt, 'base64');
  const iv = Buffer.from(field.iv, 'base64');
  const tag = Buffer.from(field.tag, 'base64');
  const key = getKey(salt);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(Buffer.from(field.ciphertext, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}

export function encryptToJson(plaintext: string): string {
  return JSON.stringify(encrypt(plaintext));
}

export function decryptFromJson(json: string): string {
  return decrypt(JSON.parse(json) as EncryptedField);
}
