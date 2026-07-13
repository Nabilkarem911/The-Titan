import { getLogger } from '@titan/logging';
import { randomUUID } from 'node:crypto';
import { environmentEntities as eeRepo, environmentEvents as evRepo, environmentRelations as erRepo } from '@titan/database';

const log = getLogger().child({ component: 'world-model-graph' });

export interface EnvironmentEntity {
  id: string;
  type: 'server' | 'container' | 'database' | 'api' | 'file' | 'service' | 'user' | 'tool' | 'process';
  name: string;
  properties: Record<string, unknown>;
  lastObserved: Date;
}

export interface CausalRelation {
  id: string;
  sourceId: string;
  targetId: string;
  relation: 'affects' | 'depends_on' | 'triggers' | 'blocks' | 'produces' | 'consumes';
  strength: number;
  observations: number;
  lastObserved: Date;
}

export interface ObservedEvent {
  id: string;
  timestamp: Date;
  actor: string;
  action: string;
  target: string;
  result: 'success' | 'failure' | 'partial';
  durationMs: number;
  context: Record<string, unknown>;
}

export class EnvironmentGraph {
  private entities = new Map<string, EnvironmentEntity>();
  private relations = new Map<string, CausalRelation>();
  private events: ObservedEvent[] = [];
  private maxEvents = 5000;

  recordEntity(type: EnvironmentEntity['type'], name: string, properties: Record<string, unknown> = {}): string {
    const id = `${type}:${name}`;
    const existing = this.entities.get(id);
    if (existing) {
      existing.properties = { ...existing.properties, ...properties };
      existing.lastObserved = new Date();
      return id;
    }

    const entity: EnvironmentEntity = {
      id,
      type,
      name,
      properties,
      lastObserved: new Date(),
    };
    this.entities.set(id, entity);
    eeRepo.upsert(id, { type: entity.type, name: entity.name, properties: JSON.stringify(entity.properties) }, ['name', 'properties']).catch((err) => log.error({ err }, 'DB write failed'));
    log.debug({ entityId: id, type }, 'entity recorded');
    return id;
  }

  recordRelation(
    sourceId: string,
    targetId: string,
    relation: CausalRelation['relation'],
  ): void {
    const id = `${sourceId}:${relation}:${targetId}`;
    const existing = this.relations.get(id);
    if (existing) {
      existing.observations++;
      existing.strength = Math.min(1, existing.strength + 0.1);
      existing.lastObserved = new Date();
      return;
    }

    this.relations.set(id, {
      id,
      sourceId,
      targetId,
      relation,
      strength: 0.5,
      observations: 1,
      lastObserved: new Date(),
    });
    erRepo.insert(id, sourceId, targetId, relation, 0.5).catch((err) => log.error({ err }, 'DB write failed'));
  }

  recordEvent(event: Omit<ObservedEvent, 'id' | 'timestamp'>): void {
    const fullEvent: ObservedEvent = {
      ...event,
      id: randomUUID(),
      timestamp: new Date(),
    };
    this.events.push(fullEvent);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
    evRepo.insert(fullEvent.id, { entity_id: fullEvent.actor, event_type: fullEvent.action, data: JSON.stringify(fullEvent.context) }).catch((err) => log.error({ err }, 'DB write failed'));

    // Auto-extract relations from events
    const sourceId = this.recordEntity('tool', event.actor);
    const targetId = this.recordEntity('service', event.target);
    this.recordRelation(sourceId, targetId, event.result === 'success' ? 'produces' : 'blocks');
  }

  getEntity(id: string): EnvironmentEntity | undefined {
    return this.entities.get(id);
  }

  getRelations(entityId: string): CausalRelation[] {
    return Array.from(this.relations.values()).filter(
      (r) => r.sourceId === entityId || r.targetId === entityId,
    );
  }

  getRecentEvents(count = 50): ObservedEvent[] {
    return this.events.slice(-count);
  }

  getImpactGraph(action: string, target: string): string[] {
    const targetId = `${'service'}:${target}`;
    const visited = new Set<string>();
    const impact: string[] = [targetId];

    const traverse = (id: string, depth: number) => {
      if (depth > 3 || visited.has(id)) return;
      visited.add(id);

      for (const rel of this.relations.values()) {
        if (rel.sourceId === id && rel.strength > 0.3) {
          if (!impact.includes(rel.targetId)) {
            impact.push(rel.targetId);
          }
          traverse(rel.targetId, depth + 1);
        }
      }
    };

    traverse(targetId, 0);
    return impact;
  }

  stats(): { entities: number; relations: number; events: number } {
    return {
      entities: this.entities.size,
      relations: this.relations.size,
      events: this.events.length,
    };
  }

  clear(): void {
    this.entities.clear();
    this.relations.clear();
    this.events = [];
  }
}
