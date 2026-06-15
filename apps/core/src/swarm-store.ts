import type { SwarmTask } from '@titan/agent-engine';

/**
 * In-memory store for active swarm tasks.
 * Persists across requests within the same process lifetime.
 */
const tasks = new Map<string, SwarmTask>();

export function storeSwarmTask(task: SwarmTask): void {
  tasks.set(task.id, task);
}

export function getSwarmTask(id: string): SwarmTask | undefined {
  return tasks.get(id);
}

export function listSwarmTasks(limit = 50): SwarmTask[] {
  return [...tasks.values()]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export function deleteSwarmTask(id: string): boolean {
  return tasks.delete(id);
}
