const log = { info: (..._args: unknown[]) => {}, warn: (..._args: unknown[]) => {} };

export interface DataExportRequest {
  userId: string;
  requestedAt: Date;
  format: 'json' | 'csv';
  status: 'pending' | 'processing' | 'ready' | 'expired';
  downloadUrl?: string;
  expiresAt?: Date;
}

export interface DeletionRequest {
  userId: string;
  requestedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  tablesAffected: string[];
  rowsDeleted: number;
  completedAt?: Date;
}

export interface ConsentRecord {
  userId: string;
  purpose: string;
  granted: boolean;
  grantedAt: Date;
  revokedAt?: Date;
  ipAddress?: string;
}

export class GDPRToolkit {
  private exports: Map<string, DataExportRequest> = new Map();
  private deletions: Map<string, DeletionRequest> = new Map();
  private consents: Map<string, ConsentRecord[]> = new Map();

  requestExport(userId: string, format: 'json' | 'csv' = 'json'): DataExportRequest {
    const request: DataExportRequest = {
      userId,
      requestedAt: new Date(),
      format,
      status: 'pending',
    };
    this.exports.set(userId, request);
    log.info({ userId, format }, 'data export requested');
    return request;
  }

  requestDeletion(userId: string): DeletionRequest {
    const request: DeletionRequest = {
      userId,
      requestedAt: new Date(),
      status: 'pending',
      tablesAffected: [],
      rowsDeleted: 0,
    };
    this.deletions.set(userId, request);
    log.info({ userId }, 'data deletion requested');
    return request;
  }

  recordConsent(userId: string, purpose: string, granted: boolean, ipAddress?: string): void {
    const records = this.consents.get(userId) ?? [];
    records.push({
      userId,
      purpose,
      granted,
      grantedAt: new Date(),
      ipAddress,
    });
    this.consents.set(userId, records);
  }

  revokeConsent(userId: string, purpose: string): void {
    const records = this.consents.get(userId) ?? [];
    const latest = records.filter((r) => r.purpose === purpose && r.granted).pop();
    if (latest) {
      latest.revokedAt = new Date();
      latest.granted = false;
    }
  }

  hasConsent(userId: string, purpose: string): boolean {
    const records = this.consents.get(userId) ?? [];
    const latest = records.filter((r) => r.purpose === purpose).pop();
    return latest?.granted ?? false;
  }

  getConsentHistory(userId: string): ConsentRecord[] {
    return this.consents.get(userId) ?? [];
  }

  getExportStatus(userId: string): DataExportRequest | undefined {
    return this.exports.get(userId);
  }

  getDeletionStatus(userId: string): DeletionRequest | undefined {
    return this.deletions.get(userId);
  }

  getAffectedTables(): string[] {
    return [
      'users', 'sessions', 'api_keys', 'agent_runs', 'agent_steps',
      'memory_messages', 'memory_items', 'user_context', 'user_projects',
      'audit_logs', 'webhooks', 'user_long_term_memory', 'conversation_summaries',
      'project_context',
    ];
  }
}
