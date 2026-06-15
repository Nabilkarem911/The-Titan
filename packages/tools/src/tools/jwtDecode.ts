export interface JwtDecodeResult {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  isExpired: boolean;
  expiresAt?: string;
  issuedAt?: string;
  issuer?: string;
  subject?: string;
}

export async function jwtDecode(params: { token: string }): Promise<JwtDecodeResult> {
  const { token } = params;
  if (!token) throw new Error('token is required');

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format — must have 3 parts separated by dots');

  const decode = (part: string): Record<string, unknown> => {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8')) as Record<string, unknown>;
  };

  const header = decode(parts[0]);
  const payload = decode(parts[1]);

  const exp = payload['exp'] as number | undefined;
  const iat = payload['iat'] as number | undefined;
  const isExpired = exp ? Date.now() / 1000 > exp : false;

  return {
    header,
    payload,
    isExpired,
    expiresAt: exp ? new Date(exp * 1000).toISOString() : undefined,
    issuedAt: iat ? new Date(iat * 1000).toISOString() : undefined,
    issuer: payload['iss'] as string | undefined,
    subject: payload['sub'] as string | undefined,
  };
}
