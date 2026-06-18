import { randomUUID } from 'node:crypto';
import type {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  NodeType,
  AgentNodeConfig,
  ToolNodeConfig,
  ConditionNodeConfig,
  ParallelNodeConfig,
  LoopNodeConfig,
} from './types.js';
import type { AgentRole } from '../swarm/types.js';

export class WorkflowBuilder {
  private nodes: WorkflowNode[] = [];
  private edges: WorkflowEdge[] = [];
  private name: string;
  private description: string;
  private entryNode?: string;

  constructor(name: string, description = '') {
    this.name = name;
    this.description = description;
  }

  addAgent(label: string, config: AgentNodeConfig): string {
    return this.addNode('agent', label, { ...config });
  }

  addTool(label: string, config: ToolNodeConfig): string {
    return this.addNode('tool', label, { ...config });
  }

  addCondition(label: string, config: ConditionNodeConfig): string {
    const id = this.addNode('condition', label, { ...config });
    this.edges.push({ from: id, to: config.trueNext, label: 'true' });
    this.edges.push({ from: id, to: config.falseNext, label: 'false' });
    return id;
  }

  addParallel(label: string, config: ParallelNodeConfig): string {
    const id = this.addNode('parallel', label, { ...config });
    for (const branch of config.branches) {
      this.edges.push({ from: id, to: branch, label: 'branch' });
    }
    return id;
  }

  addLoop(label: string, config: LoopNodeConfig): string {
    return this.addNode('loop', label, { ...config });
  }

  addInput(label: string): string {
    return this.addNode('input', label, {});
  }

  addOutput(label: string): string {
    return this.addNode('output', label, {});
  }

  connect(fromId: string, toId: string, label?: string): this {
    this.edges.push({ from: fromId, to: toId, label });
    return this;
  }

  setEntry(nodeId: string): this {
    this.entryNode = nodeId;
    return this;
  }

  build(): Workflow {
    if (!this.entryNode && this.nodes.length > 0) {
      this.entryNode = this.nodes[0].id;
    }

    return {
      id: randomUUID(),
      name: this.name,
      description: this.description,
      nodes: [...this.nodes],
      edges: [...this.edges],
      entryNode: this.entryNode ?? '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private addNode(type: NodeType, label: string, config: Record<string, unknown>): string {
    const id = `node_${this.nodes.length + 1}`;
    this.nodes.push({ id, type, label, config });
    return id;
  }

  // ── Pre-built templates ──

  static research(topic: string): Workflow {
    const b = new WorkflowBuilder('Research Workflow', `Research: ${topic}`);
    const input = b.addInput('Topic');
    const search = b.addAgent('Search', { role: 'researcher' as AgentRole, prompt: `Search for comprehensive information about: ${topic}` });
    const analyze = b.addAgent('Analyze', { role: 'reviewer' as AgentRole, prompt: 'Analyze and verify the research findings. Identify key insights.' });
    const summarize = b.addAgent('Summarize', { role: 'synthesizer' as AgentRole, prompt: 'Synthesize the verified findings into a clear, comprehensive summary.' });
    const output = b.addOutput('Report');

    b.connect(input, search).connect(search, analyze).connect(analyze, summarize).connect(summarize, output);
    b.setEntry(input);
    return b.build();
  }

  static codeReview(description: string): Workflow {
    const b = new WorkflowBuilder('Code Review Workflow', description);
    const input = b.addInput('Code');
    const review = b.addAgent('Review', { role: 'reviewer' as AgentRole, prompt: `Review this code for bugs, security issues, and best practices: ${description}` });
    const fix = b.addAgent('Fix', { role: 'coder' as AgentRole, prompt: 'Apply the suggested fixes from the review.' });
    const verify = b.addAgent('Verify', { role: 'reviewer' as AgentRole, prompt: 'Verify the fixes are correct and complete.' });
    const output = b.addOutput('Result');

    b.connect(input, review).connect(review, fix).connect(fix, verify).connect(verify, output);
    b.setEntry(input);
    return b.build();
  }

  static dataPipeline(description: string): Workflow {
    const b = new WorkflowBuilder('Data Pipeline', description);
    const input = b.addInput('Data Source');
    const extract = b.addAgent('Extract', { role: 'executor' as AgentRole, prompt: `Extract data from: ${description}` });
    const transform = b.addAgent('Transform', { role: 'coder' as AgentRole, prompt: 'Transform and clean the extracted data.' });
    const analyze = b.addAgent('Analyze', { role: 'researcher' as AgentRole, prompt: 'Analyze the transformed data and produce insights.' });
    const output = b.addOutput('Report');

    b.connect(input, extract).connect(extract, transform).connect(transform, analyze).connect(analyze, output);
    b.setEntry(input);
    return b.build();
  }
}
