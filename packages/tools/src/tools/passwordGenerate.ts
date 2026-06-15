import { randomBytes } from 'node:crypto';

export interface PasswordGenerateResult {
  password: string;
  length: number;
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  entropy: number;
}

export async function passwordGenerate(params: {
  length?: number;
  includeUppercase?: boolean;
  includeLowercase?: boolean;
  includeNumbers?: boolean;
  includeSymbols?: boolean;
  count?: number;
}): Promise<{ passwords: PasswordGenerateResult[] }> {
  const {
    length = 16,
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
    includeSymbols = true,
    count = 1,
  } = params;

  if (length < 4 || length > 128) throw new Error('length must be between 4 and 128');

  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  let charset = '';
  if (includeUppercase) charset += upper;
  if (includeLowercase) charset += lower;
  if (includeNumbers) charset += numbers;
  if (includeSymbols) charset += symbols;
  if (!charset) throw new Error('At least one character set must be enabled');

  const charsetSize = charset.length;
  const entropy = Math.log2(Math.pow(charsetSize, length));

  const getStrength = (e: number): PasswordGenerateResult['strength'] => {
    if (e < 40) return 'weak';
    if (e < 60) return 'medium';
    if (e < 80) return 'strong';
    return 'very-strong';
  };

  const generateOne = (): string => {
    const bytes = randomBytes(length * 2);
    let pwd = '';
    for (let i = 0; i < bytes.length && pwd.length < length; i++) {
      const idx = bytes[i] % charsetSize;
      pwd += charset[idx];
    }
    return pwd;
  };

  const passwords: PasswordGenerateResult[] = Array.from({ length: Math.min(count, 20) }, () => ({
    password: generateOne(),
    length,
    strength: getStrength(entropy),
    entropy: Math.round(entropy),
  }));

  return { passwords };
}
