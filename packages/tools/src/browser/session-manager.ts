import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'browser-session' });

export interface BrowserSession {
  id: string;
  cookies: Map<string, string>;
  headers: Record<string, string>;
  history: string[];
  localStorage: Map<string, string>;
  createdAt: Date;
  lastActivity: Date;
}

export class SessionManager {
  private sessions: Map<string, BrowserSession> = new Map();

  create(id: string): BrowserSession {
    const session: BrowserSession = {
      id,
      cookies: new Map(),
      headers: { 'User-Agent': 'TitanBot/1.0' },
      history: [],
      localStorage: new Map(),
      createdAt: new Date(),
      lastActivity: new Date(),
    };
    this.sessions.set(id, session);
    return session;
  }

  get(id: string): BrowserSession | undefined {
    const session = this.sessions.get(id);
    if (session) session.lastActivity = new Date();
    return session;
  }

  getOrCreate(id: string): BrowserSession {
    return this.get(id) ?? this.create(id);
  }

  setCookie(sessionId: string, name: string, value: string): void {
    const session = this.getOrCreate(sessionId);
    session.cookies.set(name, value);
  }

  getCookies(sessionId: string): Record<string, string> {
    const session = this.sessions.get(sessionId);
    if (!session) return {};
    return Object.fromEntries(session.cookies);
  }

  getCookieHeader(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) return '';
    return Array.from(session.cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  setHeader(sessionId: string, name: string, value: string): void {
    const session = this.getOrCreate(sessionId);
    session.headers[name] = value;
  }

  addToHistory(sessionId: string, url: string): void {
    const session = this.getOrCreate(sessionId);
    session.history.push(url);
    if (session.history.length > 100) session.history.shift();
  }

  getHistory(sessionId: string): string[] {
    return this.sessions.get(sessionId)?.history ?? [];
  }

  parseCookiesFromResponse(sessionId: string, setCookieHeaders: string[]): void {
    for (const header of setCookieHeaders) {
      const [pair] = header.split(';');
      const [name, value] = pair.split('=');
      if (name && value) {
        this.setCookie(sessionId, name.trim(), value.trim());
      }
    }
  }

  destroy(id: string): void {
    this.sessions.delete(id);
  }

  listSessions(): Array<{ id: string; urls: number; cookies: number; lastActivity: Date }> {
    return Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      urls: s.history.length,
      cookies: s.cookies.size,
      lastActivity: s.lastActivity,
    }));
  }

  cleanupInactive(maxAgeMs = 3600000): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity.getTime() > maxAgeMs) {
        this.sessions.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }
}
