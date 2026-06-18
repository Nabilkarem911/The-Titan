export interface AnomalyEvent {
  type: 'burst_requests' | 'odd_hours' | 'geo_change' | 'failed_auth' | 'unusual_tool' | 'large_payload';
  userId?: string;
  ip?: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  timestamp: Date;
}

export class AnomalyDetector {
  private requestCounts: Map<string, { count: number; windowStart: number }> = new Map();
  private failedAuths: Map<string, number> = new Map();
  private alerts: AnomalyEvent[] = [];

  trackRequest(userId: string, ip: string): AnomalyEvent | null {
    const key = `${userId}:${ip}`;
    const now = Date.now();
    const bucket = this.requestCounts.get(key);

    if (!bucket || now - bucket.windowStart > 60000) {
      this.requestCounts.set(key, { count: 1, windowStart: now });
      return null;
    }

    bucket.count++;

    if (bucket.count > 100) {
      const event: AnomalyEvent = {
        type: 'burst_requests',
        userId, ip,
        severity: bucket.count > 500 ? 'high' : 'medium',
        description: `${bucket.count} requests in 60s from ${ip}`,
        timestamp: new Date(),
      };
      this.alerts.push(event);
      return event;
    }

    return null;
  }

  trackFailedAuth(ip: string): AnomalyEvent | null {
    const count = (this.failedAuths.get(ip) ?? 0) + 1;
    this.failedAuths.set(ip, count);

    if (count >= 5) {
      const event: AnomalyEvent = {
        type: 'failed_auth',
        ip,
        severity: count >= 10 ? 'high' : 'medium',
        description: `${count} failed auth attempts from ${ip}`,
        timestamp: new Date(),
      };
      this.alerts.push(event);
      return event;
    }

    return null;
  }

  checkPayloadSize(sizeBytes: number, userId?: string): AnomalyEvent | null {
    if (sizeBytes > 10 * 1024 * 1024) {
      const event: AnomalyEvent = {
        type: 'large_payload',
        userId,
        severity: sizeBytes > 50 * 1024 * 1024 ? 'high' : 'medium',
        description: `Large payload: ${Math.round(sizeBytes / 1024 / 1024)}MB`,
        timestamp: new Date(),
      };
      this.alerts.push(event);
      return event;
    }
    return null;
  }

  getAlerts(since?: Date): AnomalyEvent[] {
    if (!since) return [...this.alerts];
    return this.alerts.filter((a) => a.timestamp >= since);
  }

  getHighSeverity(): AnomalyEvent[] {
    return this.alerts.filter((a) => a.severity === 'high');
  }

  isBlocked(ip: string): boolean {
    return (this.failedAuths.get(ip) ?? 0) >= 10;
  }

  resetIp(ip: string): void {
    this.failedAuths.delete(ip);
    for (const key of this.requestCounts.keys()) {
      if (key.endsWith(`:${ip}`)) this.requestCounts.delete(key);
    }
  }

  clear(): void {
    this.requestCounts.clear();
    this.failedAuths.clear();
    this.alerts = [];
  }
}
