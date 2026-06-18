export interface Entity {
  id: string;
  name: string;
  type: 'person' | 'tool' | 'concept' | 'project' | 'file' | 'service' | 'custom';
  properties: Record<string, unknown>;
  mentionCount: number;
  firstSeen: Date;
  lastSeen: Date;
}

export interface Relation {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  weight: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface GraphQueryResult {
  entities: Entity[];
  relations: Relation[];
}

export interface ExtractionResult {
  entities: Array<{ name: string; type: Entity['type'] }>;
  relations: Array<{ source: string; target: string; type: string }>;
}
