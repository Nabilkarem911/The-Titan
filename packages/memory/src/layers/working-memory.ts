import { getLogger } from '@titan/logging';
import type { MemoryLayer, MemoryEntry, WorkingMemoryState } from './types.js';

const log = getLogger().child({ component: 'working-memory' });

const MAX_WORKING_ITEMS = 20;
const MAX_TOOL_RESULTS = 10;

export class WorkingMemory implements MemoryLayer {
  name = 'working';
  private entries: Map<string, MemoryEntry> = new Map();
  private state: WorkingMemoryState = {
    activeSteps: [],
    scratchpad: new Map(),
    recentToolResults: [],
  };

  async store(entry: MemoryEntry): Promise<void> {
    this.entries.set(entry.id, { ...entry, type: 'working', lastAccessed: new Date() });

    if (this.entries.size > MAX_WORKING_ITEMS) {
      this.evictLeastImportant();
    }
  }

  async retrieve(query: string, limit = 5): Promise<MemoryEntry[]> {
    const queryLower = query.toLowerCase();
    const scored = Array.from(this.entries.values())
      .map((entry) => {
        const contentMatch = entry.content.toLowerCase().includes(queryLower) ? 2 : 0;
        const recency = (Date.now() - entry.lastAccessed.getTime()) / 60000;
        const recencyScore = Math.max(0, 1 - recency / 30);
        return { entry, score: entry.importance + contentMatch + recencyScore };
      })
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map((s) => {
      s.entry.accessCount++;
      s.entry.lastAccessed = new Date();
      return s.entry;
    });
  }

  async remove(id: string): Promise<void> {
    this.entries.delete(id);
  }

  async list(limit = 20): Promise<MemoryEntry[]> {
    return Array.from(this.entries.values())
      .sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime())
      .slice(0, limit);
  }

  size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
    this.state = { activeSteps: [], scratchpad: new Map(), recentToolResults: [] };
  }

  setGoal(goal: string): void {
    this.state.currentGoal = goal;
  }

  getGoal(): string | undefined {
    return this.state.currentGoal;
  }

  addStep(step: string): void {
    this.state.activeSteps.push(step);
  }

  getSteps(): string[] {
    return [...this.state.activeSteps];
  }

  setScratchpad(key: string, value: unknown): void {
    this.state.scratchpad.set(key, value);
  }

  getScratchpad(key: string): unknown {
    return this.state.scratchpad.get(key);
  }

  addToolResult(tool: string, result: string): void {
    this.state.recentToolResults.push({ tool, result: result.slice(0, 2000), timestamp: new Date() });
    if (this.state.recentToolResults.length > MAX_TOOL_RESULTS) {
      this.state.recentToolResults.shift();
    }
  }

  getRecentToolResults(): Array<{ tool: string; result: string; timestamp: Date }> {
    return [...this.state.recentToolResults];
  }

  getContextSummary(): string {
    const parts: string[] = [];
    if (this.state.currentGoal) parts.push(`Goal: ${this.state.currentGoal}`);
    if (this.state.activeSteps.length > 0) parts.push(`Steps: ${this.state.activeSteps.join(' → ')}`);
    if (this.state.recentToolResults.length > 0) {
      const recent = this.state.recentToolResults.slice(-3);
      parts.push(`Recent: ${recent.map((r) => `${r.tool}: ${r.result.slice(0, 100)}`).join('; ')}`);
    }
    return parts.join('\n');
  }

  private evictLeastImportant(): void {
    const sorted = Array.from(this.entries.entries())
      .sort((a, b) => a[1].importance - b[1].importance);

    const toRemove = sorted.slice(0, sorted.length - MAX_WORKING_ITEMS);
    for (const [id] of toRemove) {
      this.entries.delete(id);
    }
    log.debug({ evicted: toRemove.length }, 'evicted working memory items');
  }
}
