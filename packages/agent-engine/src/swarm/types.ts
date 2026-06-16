import type { AgentRun, AgentRunInput } from '../types.js';

export type AgentRole =
  | 'planner'       // Breaks down tasks
  | 'researcher'    // Gathers information
  | 'coder'         // Writes code
  | 'reviewer'      // Reviews output
  | 'executor'      // Runs tools/commands
  | 'synthesizer';  // Combines results

export interface SwarmAgent {
  id: string;
  role: AgentRole;
  name: string;
  description: string;
  systemPrompt?: string;
  allowedTools?: readonly string[];
  maxSteps: number;
  priority: number; // Higher = executes earlier
}

export interface SwarmSubTask {
  id: string;
  parentId?: string;
  agentRole: AgentRole;
  prompt: string;
  context?: string; // Output from previous agents
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  runId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SwarmTask {
  id: string;
  description: string;
  originalPrompt: string;
  status: 'queued' | 'pending' | 'planning' | 'executing' | 'synthesizing' | 'completed' | 'failed';
  subTasks: SwarmSubTask[];
  agents: SwarmAgent[];
  finalAnswer?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SwarmTaskInput {
  description: string;
  prompt: string;
  agents: SwarmAgent[];
  userId?: string;
  workspaceId?: string;
  apiKeyId?: string;
}

export interface SwarmResult {
  taskId: string;
  status: SwarmTask['status'];
  subTaskResults: Array<{
    subTaskId: string;
    role: AgentRole;
    result: string;
    status: SwarmSubTask['status'];
  }>;
  finalAnswer: string;
  completedAt: Date;
}

export interface SwarmOrchestratorDeps {
  createAgentRun: (input: AgentRunInput) => Promise<AgentRun>;
  getAgentRun: (runId: string) => Promise<AgentRun | null>;
  onSubTaskComplete?: (task: SwarmTask, subTask: SwarmSubTask) => Promise<void>;
}
