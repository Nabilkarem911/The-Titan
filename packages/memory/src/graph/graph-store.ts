import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';
import type { Entity, Relation, GraphQueryResult } from './types.js';

const log = getLogger().child({ component: 'graph-store' });

const MAX_ENTITIES = 5000;
const MAX_RELATIONS = 10000;

export class GraphStore {
  private entities: Map<string, Entity> = new Map();
  private relations: Map<string, Relation> = new Map();
  private nameIndex: Map<string, string> = new Map(); // name -> entityId

  addEntity(name: string, type: Entity['type'], properties?: Record<string, unknown>): Entity {
    const normalized = name.toLowerCase().trim();
    const existingId = this.nameIndex.get(normalized);

    if (existingId) {
      const existing = this.entities.get(existingId)!;
      existing.mentionCount++;
      existing.lastSeen = new Date();
      if (properties) Object.assign(existing.properties, properties);
      return existing;
    }

    const entity: Entity = {
      id: randomUUID(),
      name: normalized,
      type,
      properties: properties ?? {},
      mentionCount: 1,
      firstSeen: new Date(),
      lastSeen: new Date(),
    };

    this.entities.set(entity.id, entity);
    this.nameIndex.set(normalized, entity.id);

    if (this.entities.size > MAX_ENTITIES) {
      this.evictLeastMentioned();
    }

    return entity;
  }

  addRelation(sourceName: string, targetName: string, type: string, metadata?: Record<string, unknown>): Relation | null {
    const sourceId = this.nameIndex.get(sourceName.toLowerCase().trim());
    const targetId = this.nameIndex.get(targetName.toLowerCase().trim());
    if (!sourceId || !targetId) return null;

    // Check for existing relation
    const existing = Array.from(this.relations.values()).find(
      (r) => r.sourceId === sourceId && r.targetId === targetId && r.type === type,
    );
    if (existing) {
      existing.weight++;
      return existing;
    }

    const relation: Relation = {
      id: randomUUID(),
      sourceId,
      targetId,
      type,
      weight: 1,
      metadata,
      createdAt: new Date(),
    };

    this.relations.set(relation.id, relation);

    if (this.relations.size > MAX_RELATIONS) {
      this.evictWeakRelations();
    }

    return relation;
  }

  getEntity(name: string): Entity | undefined {
    const id = this.nameIndex.get(name.toLowerCase().trim());
    return id ? this.entities.get(id) : undefined;
  }

  getEntityById(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  getRelatedEntities(entityName: string, relationType?: string): Entity[] {
    const entityId = this.nameIndex.get(entityName.toLowerCase().trim());
    if (!entityId) return [];

    const relatedIds = new Set<string>();

    for (const rel of this.relations.values()) {
      if (relationType && rel.type !== relationType) continue;

      if (rel.sourceId === entityId) relatedIds.add(rel.targetId);
      if (rel.targetId === entityId) relatedIds.add(rel.sourceId);
    }

    return Array.from(relatedIds)
      .map((id) => this.entities.get(id))
      .filter((e): e is Entity => !!e);
  }

  getRelations(entityName: string): Relation[] {
    const entityId = this.nameIndex.get(entityName.toLowerCase().trim());
    if (!entityId) return [];

    return Array.from(this.relations.values()).filter(
      (r) => r.sourceId === entityId || r.targetId === entityId,
    );
  }

  query(entityNames: string[]): GraphQueryResult {
    const entities: Entity[] = [];
    const entityIds = new Set<string>();

    for (const name of entityNames) {
      const entity = this.getEntity(name);
      if (entity) {
        entities.push(entity);
        entityIds.add(entity.id);
      }
    }

    const relations = Array.from(this.relations.values()).filter(
      (r) => entityIds.has(r.sourceId) || entityIds.has(r.targetId),
    );

    // Include connected entities
    for (const rel of relations) {
      for (const id of [rel.sourceId, rel.targetId]) {
        if (!entityIds.has(id)) {
          const entity = this.entities.get(id);
          if (entity) {
            entities.push(entity);
            entityIds.add(id);
          }
        }
      }
    }

    return { entities, relations };
  }

  searchEntities(query: string, limit = 10): Entity[] {
    const queryLower = query.toLowerCase();

    return Array.from(this.entities.values())
      .filter((e) => e.name.includes(queryLower) || queryLower.includes(e.name))
      .sort((a, b) => b.mentionCount - a.mentionCount)
      .slice(0, limit);
  }

  removeEntity(name: string): void {
    const id = this.nameIndex.get(name.toLowerCase().trim());
    if (!id) return;

    this.entities.delete(id);
    this.nameIndex.delete(name.toLowerCase().trim());

    // Remove connected relations
    for (const [relId, rel] of this.relations) {
      if (rel.sourceId === id || rel.targetId === id) {
        this.relations.delete(relId);
      }
    }
  }

  stats(): { entities: number; relations: number; topEntities: Array<{ name: string; mentions: number }> } {
    const topEntities = Array.from(this.entities.values())
      .sort((a, b) => b.mentionCount - a.mentionCount)
      .slice(0, 10)
      .map((e) => ({ name: e.name, mentions: e.mentionCount }));

    return {
      entities: this.entities.size,
      relations: this.relations.size,
      topEntities,
    };
  }

  clear(): void {
    this.entities.clear();
    this.relations.clear();
    this.nameIndex.clear();
  }

  private evictLeastMentioned(): void {
    const sorted = Array.from(this.entities.entries())
      .sort((a, b) => a[1].mentionCount - b[1].mentionCount);

    const toRemove = sorted.slice(0, sorted.length - MAX_ENTITIES);
    for (const [id, entity] of toRemove) {
      this.entities.delete(id);
      this.nameIndex.delete(entity.name);
    }
  }

  private evictWeakRelations(): void {
    const sorted = Array.from(this.relations.entries())
      .sort((a, b) => a[1].weight - b[1].weight);

    const toRemove = sorted.slice(0, sorted.length - MAX_RELATIONS);
    for (const [id] of toRemove) {
      this.relations.delete(id);
    }
  }
}
