import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

const log = getLogger().child({ component: 'collaboration-session' });

export interface CollaborationMessage {
  id: string;
  sessionId: string;
  agentId: string;
  agentRole: string;
  content: string;
  type: 'observation' | 'hypothesis' | 'result' | 'question' | 'proposal' | 'critique' | 'consensus';
  timestamp: Date;
  replyTo?: string;
}

export interface CollaborationAgent {
  id: string;
  role: string;
  name: string;
  status: 'idle' | 'thinking' | 'working' | 'waiting' | 'done';
  currentTask?: string;
  contributions: number;
  joinedAt: Date;
}

export interface CollaborationSession {
  id: string;
  topic: string;
  description: string;
  agents: Map<string, CollaborationAgent>;
  messages: CollaborationMessage[];
  status: 'active' | 'paused' | 'completed' | 'failed';
  consensus?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionResult {
  sessionId: string;
  status: CollaborationSession['status'];
  agentCount: number;
  messageCount: number;
  consensus?: string;
  topContributors: Array<{ agentId: string; role: string; contributions: number }>;
  keyFindings: string[];
  durationMs: number;
}

export class CollaborationSessionManager extends EventEmitter {
  private sessions = new Map<string, CollaborationSession>();
  private maxMessages = 1000;
  private maxSessions = 100;

  createSession(topic: string, description: string): CollaborationSession {
    const id = randomUUID().slice(0, 8);
    const session: CollaborationSession = {
      id,
      topic,
      description,
      agents: new Map(),
      messages: [],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (this.sessions.size >= this.maxSessions) {
      // Evict oldest completed session
      let oldestId: string | null = null;
      let oldestTime = Infinity;
      for (const [sid, s] of this.sessions) {
        if (s.status === 'completed' && s.createdAt.getTime() < oldestTime) {
          oldestTime = s.createdAt.getTime();
          oldestId = sid;
        }
      }
      if (oldestId) this.sessions.delete(oldestId);
    }

    this.sessions.set(id, session);
    log.info({ sessionId: id, topic }, 'collaboration session created');
    incCounter('collaboration_session_created', 'Collaboration sessions created', 1);
    this.emit('session:created', session);
    return session;
  }

  joinSession(sessionId: string, agent: Omit<CollaborationAgent, 'contributions' | 'joinedAt'>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'active') return false;

    const fullAgent: CollaborationAgent = {
      ...agent,
      contributions: 0,
      joinedAt: new Date(),
    };
    session.agents.set(agent.id, fullAgent);
    session.updatedAt = new Date();
    log.info({ sessionId, agentId: agent.id, role: agent.role }, 'agent joined session');
    this.emit('agent:joined', { sessionId, agent: fullAgent });
    return true;
  }

  leaveSession(sessionId: string, agentId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.agents.delete(agentId);
    session.updatedAt = new Date();
    this.emit('agent:left', { sessionId, agentId });
  }

  postMessage(
    sessionId: string,
    agentId: string,
    agentRole: string,
    content: string,
    type: CollaborationMessage['type'],
    replyTo?: string,
  ): CollaborationMessage | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'active') return null;

    const agent = session.agents.get(agentId);
    if (!agent) return null;

    const msg: CollaborationMessage = {
      id: randomUUID().slice(0, 8),
      sessionId,
      agentId,
      agentRole,
      content,
      type,
      timestamp: new Date(),
      replyTo,
    };

    session.messages.push(msg);
    if (session.messages.length > this.maxMessages) {
      session.messages = session.messages.slice(-this.maxMessages);
    }

    agent.contributions++;
    agent.status = type === 'result' ? 'done' : 'thinking';
    session.updatedAt = new Date();

    incCounter('collaboration_message', 'Collaboration messages posted', 1, { type });
    this.emit('message:posted', msg);

    // Auto-detect consensus when multiple agents agree
    if (type === 'consensus') {
      session.consensus = content;
      session.status = 'completed';
      this.emit('session:consensus', { sessionId, consensus: content });
    }

    return msg;
  }

  getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId);
  }

  getActiveSessions(): CollaborationSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.status === 'active');
  }

  getMessages(sessionId: string, sinceMs?: number): CollaborationMessage[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    if (sinceMs) {
      const cutoff = Date.now() - sinceMs;
      return session.messages.filter((m) => m.timestamp.getTime() > cutoff);
    }
    return session.messages;
  }

  getAgents(sessionId: string): CollaborationAgent[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    return Array.from(session.agents.values());
  }

  pauseSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.status = 'paused';
    this.emit('session:paused', { sessionId });
    return true;
  }

  resumeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.status = 'active';
    this.emit('session:resumed', { sessionId });
    return true;
  }

  completeSession(sessionId: string, consensus?: string): SessionResult | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.status = 'completed';
    if (consensus) session.consensus = consensus;

    const contributors = Array.from(session.agents.values())
      .sort((a, b) => b.contributions - a.contributions)
      .slice(0, 5)
      .map((a) => ({ agentId: a.id, role: a.role, contributions: a.contributions }));

    const keyFindings = session.messages
      .filter((m) => m.type === 'result' || m.type === 'consensus')
      .map((m) => m.content)
      .slice(0, 10);

    const result: SessionResult = {
      sessionId,
      status: 'completed',
      agentCount: session.agents.size,
      messageCount: session.messages.length,
      consensus: session.consensus,
      topContributors: contributors,
      keyFindings,
      durationMs: Date.now() - session.createdAt.getTime(),
    };

    incCounter('collaboration_session_completed', 'Collaboration sessions completed', 1);
    log.info({ sessionId, agents: result.agentCount, messages: result.messageCount }, 'session completed');
    this.emit('session:completed', result);
    return result;
  }

  getSessionResults(sessionId: string): SessionResult | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const contributors = Array.from(session.agents.values())
      .sort((a, b) => b.contributions - a.contributions)
      .slice(0, 5)
      .map((a) => ({ agentId: a.id, role: a.role, contributions: a.contributions }));

    const keyFindings = session.messages
      .filter((m) => m.type === 'result' || m.type === 'consensus')
      .map((m) => m.content)
      .slice(0, 10);

    return {
      sessionId,
      status: session.status,
      agentCount: session.agents.size,
      messageCount: session.messages.length,
      consensus: session.consensus,
      topContributors: contributors,
      keyFindings,
      durationMs: Date.now() - session.createdAt.getTime(),
    };
  }

  stats(): { totalSessions: number; activeSessions: number; totalAgents: number; totalMessages: number } {
    let totalAgents = 0;
    let totalMessages = 0;
    let active = 0;
    for (const s of this.sessions.values()) {
      totalAgents += s.agents.size;
      totalMessages += s.messages.length;
      if (s.status === 'active') active++;
    }
    return {
      totalSessions: this.sessions.size,
      activeSessions: active,
      totalAgents,
      totalMessages,
    };
  }
}

let globalManager: CollaborationSessionManager | null = null;

export function getCollaborationManager(): CollaborationSessionManager {
  if (!globalManager) {
    globalManager = new CollaborationSessionManager();
  }
  return globalManager;
}
