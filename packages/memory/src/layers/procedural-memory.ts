import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';
import type { MemoryLayer, MemoryEntry, Procedure } from './types.js';

const log = getLogger().child({ component: 'procedural-memory' });

const MAX_PROCEDURES = 200;

export class ProceduralMemory implements MemoryLayer {
  name = 'procedural';
  private entries: Map<string, MemoryEntry> = new Map();
  private procedures: Map<string, Procedure> = new Map();

  async store(entry: MemoryEntry): Promise<void> {
    this.entries.set(entry.id, { ...entry, type: 'procedural' });
  }

  learnProcedure(input: {
    name: string;
    description: string;
    steps: string[];
    applicableTo: string[];
  }): Procedure {
    const existing = this.findByName(input.name);
    if (existing) {
      existing.timesUsed++;
      existing.successRate = (existing.successRate * (existing.timesUsed - 1) + 1) / existing.timesUsed;
      existing.lastUsed = new Date();
      existing.steps = input.steps;
      return existing;
    }

    const procedure: Procedure = {
      id: randomUUID(),
      name: input.name,
      description: input.description,
      steps: input.steps,
      successRate: 1.0,
      timesUsed: 1,
      lastUsed: new Date(),
      applicableTo: input.applicableTo,
    };

    this.procedures.set(procedure.id, procedure);

    const entry: MemoryEntry = {
      id: procedure.id,
      content: `Procedure: ${procedure.name}\n${procedure.description}\nSteps: ${procedure.steps.join(' → ')}`,
      type: 'procedural',
      importance: 0.7,
      accessCount: 0,
      lastAccessed: new Date(),
      createdAt: new Date(),
      metadata: { applicableTo: procedure.applicableTo },
    };
    this.entries.set(entry.id, entry);

    if (this.procedures.size > MAX_PROCEDURES) {
      this.evictLeastUsed();
    }

    log.debug({ procedureId: procedure.id, name: procedure.name }, 'procedure learned');
    return procedure;
  }

  recordFailure(name: string): void {
    const proc = this.findByName(name);
    if (proc) {
      proc.timesUsed++;
      proc.successRate = (proc.successRate * (proc.timesUsed - 1)) / proc.timesUsed;
      proc.lastUsed = new Date();
    }
  }

  findApplicable(taskDescription: string, limit = 3): Procedure[] {
    const queryWords = new Set(taskDescription.toLowerCase().split(/\s+/));

    return Array.from(this.procedures.values())
      .map((proc) => {
        const keywords = new Set([
          ...proc.applicableTo.flatMap((a) => a.toLowerCase().split(/\s+/)),
          ...proc.name.toLowerCase().split(/\s+/),
          ...proc.description.toLowerCase().split(/\s+/),
        ]);
        const overlap = [...queryWords].filter((w) => keywords.has(w)).length;
        const score = overlap * proc.successRate;
        return { proc, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => r.proc);
  }

  getBestProcedures(limit = 10): Procedure[] {
    return Array.from(this.procedures.values())
      .sort((a, b) => b.successRate * b.timesUsed - a.successRate * a.timesUsed)
      .slice(0, limit);
  }

  async retrieve(query: string, limit = 5): Promise<MemoryEntry[]> {
    const applicable = this.findApplicable(query, limit);
    return applicable.map((proc) => this.entries.get(proc.id)).filter((e): e is MemoryEntry => !!e);
  }

  async remove(id: string): Promise<void> {
    this.entries.delete(id);
    this.procedures.delete(id);
  }

  async list(limit = 20): Promise<MemoryEntry[]> {
    return Array.from(this.entries.values())
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  size(): number {
    return this.procedures.size;
  }

  clear(): void {
    this.entries.clear();
    this.procedures.clear();
  }

  private findByName(name: string): Procedure | undefined {
    return Array.from(this.procedures.values()).find((p) => p.name === name);
  }

  private evictLeastUsed(): void {
    const sorted = Array.from(this.procedures.entries())
      .sort((a, b) => a[1].timesUsed * a[1].successRate - b[1].timesUsed * b[1].successRate);

    const toRemove = sorted.slice(0, sorted.length - MAX_PROCEDURES);
    for (const [id] of toRemove) {
      this.procedures.delete(id);
      this.entries.delete(id);
    }
  }
}
