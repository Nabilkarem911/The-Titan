import type { PlanStep, DependencyNode, PlanValidationResult } from './types.js';

export function buildDependencyGraph(steps: PlanStep[]): Map<string, DependencyNode> {
  const graph = new Map<string, DependencyNode>();

  for (const step of steps) {
    graph.set(step.id, {
      stepId: step.id,
      dependsOn: [...step.dependsOn],
      dependedBy: [],
      depth: 0,
    });
  }

  for (const step of steps) {
    for (const depId of step.dependsOn) {
      const depNode = graph.get(depId);
      if (depNode) {
        depNode.dependedBy.push(step.id);
      }
    }
  }

  computeDepths(graph);
  return graph;
}

function computeDepths(graph: Map<string, DependencyNode>): void {
  const visited = new Set<string>();

  function dfs(nodeId: string): number {
    if (visited.has(nodeId)) {
      const node = graph.get(nodeId);
      return node?.depth ?? 0;
    }
    visited.add(nodeId);

    const node = graph.get(nodeId);
    if (!node) return 0;

    if (node.dependsOn.length === 0) {
      node.depth = 0;
      return 0;
    }

    let maxParentDepth = 0;
    for (const depId of node.dependsOn) {
      maxParentDepth = Math.max(maxParentDepth, dfs(depId) + 1);
    }
    node.depth = maxParentDepth;
    return maxParentDepth;
  }

  for (const nodeId of graph.keys()) {
    dfs(nodeId);
  }
}

export function detectCycles(steps: PlanStep[]): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const stepMap = new Map(steps.map((s) => [s.id, s]));

  function dfs(nodeId: string, path: string[]): void {
    if (inStack.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      cycles.push(path.slice(cycleStart));
      return;
    }
    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    inStack.add(nodeId);
    path.push(nodeId);

    const step = stepMap.get(nodeId);
    if (step) {
      for (const depId of step.dependsOn) {
        dfs(depId, [...path]);
      }
    }

    inStack.delete(nodeId);
  }

  for (const step of steps) {
    if (!visited.has(step.id)) {
      dfs(step.id, []);
    }
  }

  return cycles;
}

export function getExecutionOrder(steps: PlanStep[]): PlanStep[][] {
  const graph = buildDependencyGraph(steps);
  const maxDepth = Math.max(0, ...Array.from(graph.values()).map((n) => n.depth));
  const layers: PlanStep[][] = [];
  const stepMap = new Map(steps.map((s) => [s.id, s]));

  for (let d = 0; d <= maxDepth; d++) {
    const layer: PlanStep[] = [];
    for (const node of graph.values()) {
      if (node.depth === d) {
        const step = stepMap.get(node.stepId);
        if (step) layer.push(step);
      }
    }
    if (layer.length > 0) layers.push(layer);
  }

  return layers;
}

export function getReadySteps(steps: PlanStep[]): PlanStep[] {
  const completedIds = new Set(steps.filter((s) => s.status === 'completed').map((s) => s.id));

  return steps.filter(
    (s) =>
      s.status === 'pending' &&
      s.dependsOn.every((depId) => completedIds.has(depId)),
  );
}

export function validateDependencies(steps: PlanStep[]): PlanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set(steps.map((s) => s.id));

  for (const step of steps) {
    for (const depId of step.dependsOn) {
      if (!ids.has(depId)) {
        errors.push(`Step "${step.id}" depends on unknown step "${depId}"`);
      }
      if (depId === step.id) {
        errors.push(`Step "${step.id}" depends on itself`);
      }
    }
  }

  const cycles = detectCycles(steps);
  for (const cycle of cycles) {
    errors.push(`Circular dependency detected: ${cycle.join(' → ')}`);
  }

  const orphans = steps.filter(
    (s) => s.dependsOn.length === 0 && !steps.some((other) => other.dependsOn.includes(s.id)),
  );
  if (orphans.length > 1) {
    warnings.push(`${orphans.length} independent steps with no connections — possible missing dependencies`);
  }

  return { valid: errors.length === 0, errors, warnings };
}
