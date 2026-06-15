import { createHash, createHmac, randomBytes } from 'node:crypto';

export interface HashCryptoResult {
  input: string;
  algorithm: string;
  hash: string;
}

export async function hashCrypto(params: {
  text: string;
  algorithm: 'md5' | 'sha1' | 'sha256' | 'sha512';
  hmacSecret?: string;
}): Promise<HashCryptoResult> {
  const { text, algorithm, hmacSecret } = params;

  if (!text) throw new Error('text is required');

  let hash: string;
  if (hmacSecret) {
    hash = createHmac(algorithm, hmacSecret).update(text).digest('hex');
  } else {
    hash = createHash(algorithm).update(text).digest('hex');
  }

  return { input: text, algorithm, hash };
}

export async function randomToken(params: { bytes?: number }): Promise<{ token: string }> {
  const bytes = params.bytes ?? 32;
  return { token: randomBytes(bytes).toString('hex') };
}
