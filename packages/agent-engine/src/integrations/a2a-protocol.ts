import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

const log = getLogger().child({ component: 'a2a-protocol' });

export type A2ATaskState = 'pending' | 'working' | 'completed' | 'failed' | 'canceled';
export type A2AMessageRole = 'user' | 'agent';

export interface A2AAgentCard {
  id: string;
  name: string;
  description: string;
  url: string;
  capabilities: string[];
  protocolVersion: string;
  authentication?: {
    type: 'none' | 'api_key' | 'oauth2' | 'bearer';
    credentials?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface A2ATask {
  id: string;
  name: string;
  description?: string;
  state: A2ATaskState;
  createdAt: Date;
  updatedAt: Date;
  assignedAgentId?: string;
  input: A2AMessage;
  output?: A2AMessage;
  artifacts?: A2AArtifact[];
  history: A2AMessage[];
  metadata?: Record<string, unknown>;
}

export interface A2AMessage {
  id: string;
  role: A2AMessageRole;
  taskId: string;
  content: string;
  parts?: A2APart[];
  createdAt: Date;
}

export interface A2APart {
  type: 'text' | 'data' | 'file' | 'error';
  text?: string;
  data?: Record<string, unknown>;
  file?: { name: string; mimeType: string; bytes?: string; uri?: string };
  error?: { code: number; message: string };
}

export interface A2AArtifact {
  id: string;
  name: string;
  description?: string;
  mimeType: string;
  bytes?: string;
  uri?: string;
  createdAt: Date;
}

export interface A2ARegistration {
  agentCard: A2AAgentCard;
  registeredAt: Date;
  lastSeen: Date;
  healthy: boolean;
}

export interface A2AStats {
  registeredAgents: number;
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalMessages: number;
  totalArtifacts: number;
  byCapability: Array<{ capability: string; count: number }>;
}

export class A2AProtocolAdapter extends EventEmitter {
  private agents: Map<string, A2ARegistration> = new Map();
  private tasks: Map<string, A2ATask> = new Map();
  private maxTasks = 500;
  private selfCard: A2AAgentCard | null = null;

  constructor() {
    super();
  }

  registerSelf(card: Omit<A2AAgentCard, 'id' | 'protocolVersion'> & { id?: string }): A2AAgentCard {
    this.selfCard = {
      id: card.id ?? randomUUID().slice(0, 8),
      name: card.name,
      description: card.description,
      url: card.url,
      capabilities: card.capabilities,
      protocolVersion: '0.3',
      authentication: card.authentication,
      metadata: card.metadata,
    };

    this.agents.set(this.selfCard.id, {
      agentCard: this.selfCard,
      registeredAt: new Date(),
      lastSeen: new Date(),
      healthy: true,
    });

    incCounter('a2a_agent_registered', 'A2A agents registered', 1);
    log.info({ agentId: this.selfCard.id, name: this.selfCard.name }, 'self registered as A2A agent');
    this.emit('self:registered', this.selfCard);
    return this.selfCard;
  }

  registerAgent(card: A2AAgentCard): void {
    const existing = this.agents.get(card.id);
    this.agents.set(card.id, {
      agentCard: card,
      registeredAt: existing?.registeredAt ?? new Date(),
      lastSeen: new Date(),
      healthy: true,
    });

    incCounter('a2a_agent_registered', 'A2A agents registered', 1);
    log.info({ agentId: card.id, name: card.name, capabilities: card.capabilities }, 'external agent registered');
    this.emit('agent:registered', card);
  }

  unregisterAgent(agentId: string): boolean {
    const removed = this.agents.delete(agentId);
    if (removed) {
      log.info({ agentId }, 'agent unregistered');
      this.emit('agent:unregistered', agentId);
    }
    return removed;
  }

  getAgent(agentId: string): A2AAgentCard | null {
    return this.agents.get(agentId)?.agentCard ?? null;
  }

  getRegisteredAgents(): A2AAgentCard[] {
    return Array.from(this.agents.values()).map((r) => r.agentCard);
  }

  findAgentsByCapability(capability: string): A2AAgentCard[] {
    return Array.from(this.agents.values())
      .filter((r) => r.healthy && r.agentCard.capabilities.includes(capability))
      .map((r) => r.agentCard);
  }

  sendTask(agentId: string, input: {
    name: string;
    description?: string;
    content: string;
    parts?: A2APart[];
    metadata?: Record<string, unknown>;
  }): A2ATask {
    const registration = this.agents.get(agentId);
    if (!registration) {
      throw new Error(`Agent ${agentId} not registered`);
    }

    const taskId = randomUUID().slice(0, 8);
    const task: A2ATask = {
      id: taskId,
      name: input.name,
      description: input.description,
      state: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedAgentId: agentId,
      input: {
        id: randomUUID().slice(0, 8),
        role: 'user',
        taskId,
        content: input.content,
        parts: input.parts,
        createdAt: new Date(),
      },
      history: [],
      metadata: input.metadata,
    };

    this.tasks.set(taskId, task);
    if (this.tasks.size > this.maxTasks) {
      const oldest = Array.from(this.tasks.values())
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
      if (oldest) this.tasks.delete(oldest.id);
    }

    incCounter('a2a_task_sent', 'A2A tasks sent', 1);
    log.info({ taskId, agentId, name: input.name }, 'task sent to agent');
    this.emit('task:sent', task);
    return task;
  }

  updateTaskState(taskId: string, state: A2ATaskState, output?: {
    content: string;
    parts?: A2APart[];
    artifacts?: A2AArtifact[];
  }): A2ATask | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    task.state = state;
    task.updatedAt = new Date();

    if (output) {
      const outputMessage: A2AMessage = {
        id: randomUUID().slice(0, 8),
        role: 'agent',
        taskId,
        content: output.content,
        parts: output.parts,
        createdAt: new Date(),
      };
      task.output = outputMessage;
      task.history.push(outputMessage);
      task.artifacts = output.artifacts;
    }

    incCounter('a2a_task_updated', 'A2A tasks updated', 1, { state });
    log.info({ taskId, state }, 'task state updated');
    this.emit('task:updated', task);
    return task;
  }

  addMessage(taskId: string, role: A2AMessageRole, content: string, parts?: A2APart[]): A2AMessage | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const message: A2AMessage = {
      id: randomUUID().slice(0, 8),
      role,
      taskId,
      content,
      parts,
      createdAt: new Date(),
    };
    task.history.push(message);
    task.updatedAt = new Date();

    incCounter('a2a_message', 'A2A messages', 1);
    this.emit('message:added', message);
    return message;
  }

  getTask(taskId: string): A2ATask | null {
    return this.tasks.get(taskId) ?? null;
  }

  getTasks(filter?: { agentId?: string; state?: A2ATaskState }): A2ATask[] {
    return Array.from(this.tasks.values()).filter((t) => {
      if (filter?.agentId && t.assignedAgentId !== filter.agentId) return false;
      if (filter?.state && t.state !== filter.state) return false;
      return true;
    });
  }

  cancelTask(taskId: string): A2ATask | null {
    return this.updateTaskState(taskId, 'canceled');
  }

  ping(agentId: string): boolean {
    const reg = this.agents.get(agentId);
    if (!reg) return false;
    reg.lastSeen = new Date();
    reg.healthy = true;
    this.emit('agent:ping', agentId);
    return true;
  }

  markUnhealthy(agentId: string): void {
    const reg = this.agents.get(agentId);
    if (reg) {
      reg.healthy = false;
      this.emit('agent:unhealthy', agentId);
    }
  }

  stats(): A2AStats {
    const tasks = Array.from(this.tasks.values());
    const capabilityMap = new Map<string, number>();

    for (const reg of this.agents.values()) {
      for (const cap of reg.agentCard.capabilities) {
        capabilityMap.set(cap, (capabilityMap.get(cap) ?? 0) + 1);
      }
    }

    return {
      registeredAgents: this.agents.size,
      activeTasks: tasks.filter((t) => t.state === 'pending' || t.state === 'working').length,
      completedTasks: tasks.filter((t) => t.state === 'completed').length,
      failedTasks: tasks.filter((t) => t.state === 'failed').length,
      totalMessages: tasks.reduce((s, t) => s + t.history.length, 0),
      totalArtifacts: tasks.reduce((s, t) => s + (t.artifacts?.length ?? 0), 0),
      byCapability: Array.from(capabilityMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([capability, count]) => ({ capability, count })),
    };
  }

  clear(): void {
    this.tasks.clear();
  }

  getSelfCard(): A2AAgentCard | null {
    return this.selfCard;
  }
}
