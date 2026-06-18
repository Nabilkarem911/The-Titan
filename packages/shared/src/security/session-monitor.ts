export interface SessionInfo {
  sessionId: string;
  userId: string;
  ip: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
}

export class SessionMonitor {
  private sessions: Map<string, SessionInfo[]> = new Map();
  private maxPerUser: number;

  constructor(maxPerUser = 5) {
    this.maxPerUser = maxPerUser;
  }

  register(session: SessionInfo): { allowed: boolean; evicted?: string } {
    const userSessions = this.sessions.get(session.userId) ?? [];
    userSessions.push(session);

    if (userSessions.length > this.maxPerUser) {
      const evicted = userSessions.shift()!;
      this.sessions.set(session.userId, userSessions);
      return { allowed: true, evicted: evicted.sessionId };
    }

    this.sessions.set(session.userId, userSessions);
    return { allowed: true };
  }

  getUserSessions(userId: string): SessionInfo[] {
    return this.sessions.get(userId) ?? [];
  }

  isNewDevice(userId: string, userAgent: string): boolean {
    const sessions = this.sessions.get(userId) ?? [];
    return !sessions.some((s) => s.userAgent === userAgent);
  }

  isNewIp(userId: string, ip: string): boolean {
    const sessions = this.sessions.get(userId) ?? [];
    return !sessions.some((s) => s.ip === ip);
  }

  detectAnomaly(userId: string, ip: string, userAgent: string): string[] {
    const anomalies: string[] = [];
    if (this.isNewDevice(userId, userAgent)) anomalies.push('New device detected');
    if (this.isNewIp(userId, ip)) anomalies.push('New IP address');

    const sessions = this.sessions.get(userId) ?? [];
    const uniqueIps = new Set(sessions.map((s) => s.ip));
    if (uniqueIps.size > 5) anomalies.push(`Multiple IPs: ${uniqueIps.size} unique addresses`);

    return anomalies;
  }

  remove(sessionId: string): void {
    for (const [userId, sessions] of this.sessions) {
      const filtered = sessions.filter((s) => s.sessionId !== sessionId);
      if (filtered.length !== sessions.length) {
        this.sessions.set(userId, filtered);
        return;
      }
    }
  }

  removeAllForUser(userId: string): number {
    const count = this.sessions.get(userId)?.length ?? 0;
    this.sessions.delete(userId);
    return count;
  }

  getActiveCount(): number {
    let count = 0;
    for (const sessions of this.sessions.values()) count += sessions.length;
    return count;
  }
}
