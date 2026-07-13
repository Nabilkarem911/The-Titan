import { describe, it, expect, beforeEach } from 'vitest';
import { VisualWorkflowBuilder } from './visual-workflow-builder.js';

describe('VisualWorkflowBuilder', () => {
  let builder: VisualWorkflowBuilder;

  beforeEach(() => {
    builder = new VisualWorkflowBuilder();
  });

  it('should create a workflow', () => {
    const wf = builder.createWorkflow('Test Workflow');
    expect(wf.name).toBe('Test Workflow');
    expect(wf.nodes).toHaveLength(0);
  });

  it('should add nodes', () => {
    const wf = builder.createWorkflow('Test');
    const node = builder.addNode(wf.id, 'trigger', 'Start', { event: 'webhook' });
    expect(wf.nodes).toHaveLength(1);
    expect(node.type).toBe('trigger');
    expect(node.label).toBe('Start');
  });

  it('should add edges', () => {
    const wf = builder.createWorkflow('Test');
    const n1 = builder.addNode(wf.id, 'trigger', 'Start');
    const n2 = builder.addNode(wf.id, 'agent', 'Worker');
    builder.addEdge(wf.id, n1.id, n2.id);
    expect(wf.edges).toHaveLength(1);
  });

  it('should set trigger', () => {
    const wf = builder.createWorkflow('Test');
    builder.setTrigger(wf.id, 'cron', { schedule: '0 3 * * *' });
    expect(wf.trigger).toBeDefined();
    expect(wf.trigger!.type).toBe('cron');
  });

  it('should add condition nodes', () => {
    const wf = builder.createWorkflow('Test');
    const { ifNode, elseNode } = builder.addConditionNode(wf.id, 'Check', 'x > 5', 'else');
    expect(ifNode.type).toBe('condition');
    expect(elseNode).toBeDefined();
  });

  it('should export to DAG format', () => {
    const wf = builder.createWorkflow('Test');
    const n1 = builder.addNode(wf.id, 'trigger', 'Start');
    const n2 = builder.addNode(wf.id, 'agent', 'Worker');
    builder.addEdge(wf.id, n1.id, n2.id);
    const dag = builder.exportToDAG(wf.id);
    expect(dag.nodes).toHaveLength(2);
    expect(dag.edges).toHaveLength(1);
  });

  it('should get workflow by id', async () => {
    const wf = builder.createWorkflow('Test');
    expect(await builder.getWorkflow(wf.id)).not.toBeNull();
    expect(await builder.getWorkflow('nonexistent')).toBeNull();
  });

  it('should delete workflow', async () => {
    const wf = builder.createWorkflow('Test');
    expect(await builder.deleteWorkflow(wf.id)).toBe(true);
    expect(await builder.getWorkflow(wf.id)).toBeNull();
  });

  it('should get stats', () => {
    const wf = builder.createWorkflow('Test');
    builder.addNode(wf.id, 'trigger', 'Start');
    builder.exportToDAG(wf.id);
    const stats = builder.getStats();
    expect(stats.total).toBe(1);
    expect(stats.exported).toBe(1);
    expect(stats.totalNodes).toBe(1);
  });

  it('should reset', async () => {
    builder.createWorkflow('Test');
    builder.reset();
    expect(await builder.getWorkflows()).toHaveLength(0);
  });

  it('should throw on invalid workflow id', () => {
    expect(() => builder.addNode('invalid', 'trigger', 'Start')).toThrow();
  });
});
