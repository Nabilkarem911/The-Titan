import { randomBytes } from 'node:crypto';

interface RotationPolicy {
  maxAgeDays: number;
  notifyBeforeDays: number;
  autoRotate: boolean;
}

interface SecretRecord {
  id: string;
  name: string;
  createdAt: Date;
  rotatedAt: Date;
  expiresAt: Date;
  policy: RotationPolicy;
}

export class SecretRotation {
  private secrets: Map<string, SecretRecord> = new Map();

  register(name: string, policy: RotationPolicy): SecretRecord {
    const now = new Date();
    const record: SecretRecord = {
      id: `secret_${Date.now()}`,
      name,
      createdAt: now,
      rotatedAt: now,
      expiresAt: new Date(now.getTime() + policy.maxAgeDays * 86400000),
      policy,
    };
    this.secrets.set(name, record);
    return record;
  }

  checkExpiring(): SecretRecord[] {
    const now = Date.now();
    return Array.from(this.secrets.values()).filter((s) => {
      const daysUntilExpiry = (s.expiresAt.getTime() - now) / 86400000;
      return daysUntilExpiry <= s.policy.notifyBeforeDays && daysUntilExpiry > 0;
    });
  }

  checkExpired(): SecretRecord[] {
    const now = Date.now();
    return Array.from(this.secrets.values()).filter((s) => s.expiresAt.getTime() <= now);
  }

  rotate(name: string): { newValue: string; record: SecretRecord } | null {
    const record = this.secrets.get(name);
    if (!record) return null;

    const newValue = randomBytes(32).toString('hex');
    record.rotatedAt = new Date();
    record.expiresAt = new Date(Date.now() + record.policy.maxAgeDays * 86400000);

    return { newValue, record };
  }

  generateKey(length = 32): string {
    return randomBytes(length).toString('hex');
  }

  getStatus(): Array<{ name: string; daysUntilExpiry: number; status: 'ok' | 'expiring' | 'expired' }> {
    const now = Date.now();
    return Array.from(this.secrets.values()).map((s) => {
      const days = Math.round((s.expiresAt.getTime() - now) / 86400000);
      return {
        name: s.name,
        daysUntilExpiry: days,
        status: days <= 0 ? 'expired' : days <= s.policy.notifyBeforeDays ? 'expiring' : 'ok',
      };
    });
  }
}
