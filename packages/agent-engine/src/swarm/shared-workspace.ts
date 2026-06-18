import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'swarm-workspace' });

export interface WorkspaceArtifact {
  id: string;
  key: string;
  value: unknown;
  producedBy: string;
  consumedBy: string[];
  createdAt: Date;
}

export class SharedWorkspace {
  private artifacts: Map<string, WorkspaceArtifact> = new Map();
  private notes: Map<string, string> = new Map();

  put(key: string, value: unknown, producedBy: string): void {
    const artifact: WorkspaceArtifact = {
      id: key,
      key,
      value,
      producedBy,
      consumedBy: [],
      createdAt: new Date(),
    };
    this.artifacts.set(key, artifact);
    log.debug({ key, producedBy }, 'artifact stored');
  }

  get(key: string, consumerId?: string): unknown {
    const artifact = this.artifacts.get(key);
    if (!artifact) return undefined;

    if (consumerId && !artifact.consumedBy.includes(consumerId)) {
      artifact.consumedBy.push(consumerId);
    }

    return artifact.value;
  }

  has(key: string): boolean {
    return this.artifacts.has(key);
  }

  keys(): string[] {
    return Array.from(this.artifacts.keys());
  }

  getArtifact(key: string): WorkspaceArtifact | undefined {
    return this.artifacts.get(key);
  }

  getArtifactsByProducer(agentId: string): WorkspaceArtifact[] {
    return Array.from(this.artifacts.values()).filter((a) => a.producedBy === agentId);
  }

  setNote(agentId: string, note: string): void {
    this.notes.set(agentId, note);
  }

  getNote(agentId: string): string | undefined {
    return this.notes.get(agentId);
  }

  getAllNotes(): Map<string, string> {
    return new Map(this.notes);
  }

  buildSummary(): string {
    const parts: string[] = [];

    if (this.artifacts.size > 0) {
      parts.push('Workspace artifacts:');
      for (const [key, artifact] of this.artifacts) {
        const val = typeof artifact.value === 'string'
          ? artifact.value.slice(0, 200)
          : JSON.stringify(artifact.value).slice(0, 200);
        parts.push(`  [${key}] by ${artifact.producedBy}: ${val}`);
      }
    }

    if (this.notes.size > 0) {
      parts.push('Agent notes:');
      for (const [agentId, note] of this.notes) {
        parts.push(`  [${agentId}]: ${note.slice(0, 200)}`);
      }
    }

    return parts.join('\n');
  }

  clear(): void {
    this.artifacts.clear();
    this.notes.clear();
  }
}
