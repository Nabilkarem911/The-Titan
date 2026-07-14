import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';

const log = getLogger().child({ component: 'mirror:episodic-buffer' });

export interface EpisodicItem {
  id: string;
  content: string;
  type: 'perception' | 'thought' | 'action' | 'emotion' | 'memory' | 'observation';
  salience: number;
  createdAt: Date;
}

const DEFAULT_CAPACITY = 7;
const MAX_CAPACITY = 9;
const MIN_CAPACITY = 5;

export class EpisodicBuffer {
  private items: EpisodicItem[] = [];
  private capacity: number;

  constructor(capacity?: number) {
    this.capacity = Math.max(MIN_CAPACITY, Math.min(MAX_CAPACITY, capacity ?? DEFAULT_CAPACITY));
  }

  add(item: Omit<EpisodicItem, 'id' | 'createdAt'>): string {
    const id = `epi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const fullItem: EpisodicItem = {
      ...item,
      id,
      createdAt: new Date(),
    };

    this.items.push(fullItem);

    // If over capacity, remove lowest salience item
    if (this.items.length > this.capacity) {
      this.items.sort((a, b) => b.salience - a.salience);
      this.items = this.items.slice(0, this.capacity);
    }

    incCounter('mirror_episodic', 'Episodic items added', 1);
    log.debug({ id, type: item.type, salience: item.salience }, 'episodic item added');
    return id;
  }

  remove(id: string): void {
    this.items = this.items.filter((i) => i.id !== id);
  }

  getItems(): EpisodicItem[] {
    return [...this.items].sort((a, b) => b.salience - a.salience);
  }

  getCapacity(): number {
    return this.capacity;
  }

  getSize(): number {
    return this.items.length;
  }

  isFull(): boolean {
    return this.items.length >= this.capacity;
  }

  clear(): void {
    this.items = [];
  }

  toContextString(): string {
    if (this.items.length === 0) return '[empty consciousness]';
    const sorted = this.getItems();
    return sorted
      .map((i) => `[${i.type}] ${i.content}`)
      .join('\n');
  }

  decaySalience(factor: number = 0.95): void {
    for (const item of this.items) {
      item.salience *= factor;
    }
    // Remove items with very low salience
    this.items = this.items.filter((i) => i.salience > 0.1);
  }

  getMostSalient(): EpisodicItem | null {
    if (this.items.length === 0) return null;
    return [...this.items].sort((a, b) => b.salience - a.salience)[0];
  }
}
