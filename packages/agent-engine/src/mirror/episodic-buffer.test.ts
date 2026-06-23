import { describe, it, expect, beforeEach } from 'vitest';
import { EpisodicBuffer } from './episodic-buffer.js';

describe('EpisodicBuffer', () => {
  let buffer: EpisodicBuffer;

  beforeEach(() => {
    buffer = new EpisodicBuffer(5);
  });

  it('should start empty', () => {
    expect(buffer.getSize()).toBe(0);
    expect(buffer.isFull()).toBe(false);
  });

  it('should add items', () => {
    const id = buffer.add({ type: 'observation', content: 'Saw something', priority: 1 });
    expect(id).toBeDefined();
    expect(buffer.getSize()).toBe(1);
  });

  it('should retrieve items', () => {
    buffer.add({ type: 'observation', content: 'Item 1', priority: 1 });
    buffer.add({ type: 'thought', content: 'Item 2', priority: 2 });
    const items = buffer.getItems();
    expect(items.length).toBe(2);
  });

  it('should detect when full', () => {
    for (let i = 0; i < 5; i++) {
      buffer.add({ type: 'observation', content: `Item ${i}`, priority: 1 });
    }
    expect(buffer.isFull()).toBe(true);
    expect(buffer.getCapacity()).toBe(5);
  });

  it('should remove items by id', () => {
    const id = buffer.add({ type: 'observation', content: 'To remove', priority: 1 });
    buffer.remove(id);
    expect(buffer.getSize()).toBe(0);
  });

  it('should clear all items', () => {
    buffer.add({ type: 'observation', content: 'A', priority: 1 });
    buffer.add({ type: 'thought', content: 'B', priority: 1 });
    buffer.clear();
    expect(buffer.getSize()).toBe(0);
  });
});
