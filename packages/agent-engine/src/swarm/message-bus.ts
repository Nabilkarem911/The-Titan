import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';
import { swarmMessages as smRepo } from '@titan/database';

const log = getLogger().child({ component: 'swarm-message-bus' });

interface SwarmMessage {
  id: string;
  from: string;
  to: string | 'broadcast';
  type: 'data' | 'request' | 'response' | 'status' | 'error';
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export type MessageHandler = (message: SwarmMessage) => void | Promise<void>;

export class MessageBus {
  private subscribers: Map<string, MessageHandler[]> = new Map();
  private history: SwarmMessage[] = [];
  private maxHistory: number;

  constructor(maxHistory = 200) {
    this.maxHistory = maxHistory;
  }

  subscribe(agentId: string, handler: MessageHandler): () => void {
    const handlers = this.subscribers.get(agentId) ?? [];
    handlers.push(handler);
    this.subscribers.set(agentId, handlers);

    return () => {
      const current = this.subscribers.get(agentId) ?? [];
      this.subscribers.set(agentId, current.filter((h) => h !== handler));
    };
  }

  async send(message: Omit<SwarmMessage, 'id' | 'timestamp'>): Promise<SwarmMessage> {
    const full: SwarmMessage = {
      ...message,
      id: randomUUID(),
      timestamp: new Date(),
    };

    this.history.push(full);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
    smRepo.insert(full.id, { from_agent: full.from, to_agent: full.to, channel: full.type, content: full.content }).catch((err) => log.error({ err }, 'DB write failed'));

    if (full.to === 'broadcast') {
      const promises: Promise<void>[] = [];
      for (const [agentId, handlers] of this.subscribers) {
        if (agentId !== full.from) {
          for (const handler of handlers) {
            promises.push(Promise.resolve(handler(full)));
          }
        }
      }
      await Promise.all(promises);
    } else {
      const handlers = this.subscribers.get(full.to) ?? [];
      for (const handler of handlers) {
        await handler(full);
      }
    }

    log.debug({ from: full.from, to: full.to, type: full.type }, 'message sent');
    return full;
  }

  getHistory(agentId?: string, limit = 50): SwarmMessage[] {
    const filtered = agentId
      ? this.history.filter((m) => m.from === agentId || m.to === agentId || m.to === 'broadcast')
      : this.history;

    return filtered.slice(-limit);
  }

  getConversation(agentA: string, agentB: string): SwarmMessage[] {
    return this.history.filter(
      (m) =>
        (m.from === agentA && m.to === agentB) ||
        (m.from === agentB && m.to === agentA),
    );
  }

  clear(): void {
    this.history = [];
    this.subscribers.clear();
  }
}
