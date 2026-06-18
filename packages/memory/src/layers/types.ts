export interface MemoryEntry {
  id: string;
  content: string;
  type: 'working' | 'episodic' | 'semantic' | 'procedural' | 'user';
  importance: number;
  accessCount: number;
  lastAccessed: Date;
  createdAt: Date;
  metadata?: Record<string, unknown>;
  embedding?: number[];
}

export interface MemoryLayer {
  name: string;
  store(entry: MemoryEntry): Promise<void>;
  retrieve(query: string, limit?: number): Promise<MemoryEntry[]>;
  remove(id: string): Promise<void>;
  list(limit?: number): Promise<MemoryEntry[]>;
  size(): number;
  clear(): void;
}

export interface WorkingMemoryState {
  currentGoal?: string;
  activeSteps: string[];
  scratchpad: Map<string, unknown>;
  recentToolResults: Array<{ tool: string; result: string; timestamp: Date }>;
}

export interface Episode {
  id: string;
  sessionId: string;
  prompt: string;
  outcome: string;
  success: boolean;
  toolsUsed: string[];
  stepsCount: number;
  tokensUsed: number;
  duration: number;
  lessons?: string;
  timestamp: Date;
}

export interface Procedure {
  id: string;
  name: string;
  description: string;
  steps: string[];
  successRate: number;
  timesUsed: number;
  lastUsed: Date;
  applicableTo: string[];
}

export interface UserPreference {
  key: string;
  value: string;
  category: 'tone' | 'language' | 'format' | 'behavior' | 'relationship' | 'custom';
  confidence: number;
  updatedAt: Date;
}
