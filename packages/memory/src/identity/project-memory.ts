import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'project-memory' });

interface ProjectRecord {
  id: string;
  userId: string;
  name: string;
  path?: string;
  techStack: string[];
  architecture?: string;
  knownIssues: string[];
  recentChanges: string[];
  notes: string[];
  lastAccessed: Date;
  createdAt: Date;
}

export class ProjectMemory {
  private projects: Map<string, ProjectRecord> = new Map();

  upsert(userId: string, name: string, updates: Partial<ProjectRecord>): ProjectRecord {
    const key = `${userId}:${name}`;
    const existing = this.projects.get(key);

    if (existing) {
      if (updates.techStack) existing.techStack = [...new Set([...existing.techStack, ...updates.techStack])];
      if (updates.knownIssues) existing.knownIssues = [...new Set([...existing.knownIssues, ...updates.knownIssues])];
      if (updates.recentChanges) {
        existing.recentChanges = [...updates.recentChanges, ...existing.recentChanges].slice(0, 20);
      }
      if (updates.notes) existing.notes = [...existing.notes, ...updates.notes].slice(0, 50);
      if (updates.architecture) existing.architecture = updates.architecture;
      if (updates.path) existing.path = updates.path;
      existing.lastAccessed = new Date();
      return existing;
    }

    const record: ProjectRecord = {
      id: key,
      userId,
      name,
      path: updates.path,
      techStack: updates.techStack ?? [],
      architecture: updates.architecture,
      knownIssues: updates.knownIssues ?? [],
      recentChanges: updates.recentChanges ?? [],
      notes: updates.notes ?? [],
      lastAccessed: new Date(),
      createdAt: new Date(),
    };

    this.projects.set(key, record);
    log.info({ project: name, userId }, 'project memory created');
    return record;
  }

  get(userId: string, name: string): ProjectRecord | undefined {
    const record = this.projects.get(`${userId}:${name}`);
    if (record) record.lastAccessed = new Date();
    return record;
  }

  listForUser(userId: string): ProjectRecord[] {
    return Array.from(this.projects.values())
      .filter((p) => p.userId === userId)
      .sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime());
  }

  addIssue(userId: string, projectName: string, issue: string): void {
    const record = this.get(userId, projectName);
    if (record && !record.knownIssues.includes(issue)) {
      record.knownIssues.push(issue);
    }
  }

  resolveIssue(userId: string, projectName: string, issue: string): void {
    const record = this.get(userId, projectName);
    if (record) {
      record.knownIssues = record.knownIssues.filter((i) => i !== issue);
    }
  }

  addChange(userId: string, projectName: string, change: string): void {
    const record = this.get(userId, projectName);
    if (record) {
      record.recentChanges.unshift(change);
      if (record.recentChanges.length > 20) record.recentChanges.pop();
    }
  }

  getContextString(userId: string, projectName: string): string {
    const record = this.get(userId, projectName);
    if (!record) return '';

    const parts = [`Project: ${record.name}`];
    if (record.techStack.length) parts.push(`Stack: ${record.techStack.join(', ')}`);
    if (record.architecture) parts.push(`Architecture: ${record.architecture}`);
    if (record.knownIssues.length) parts.push(`Known issues: ${record.knownIssues.join('; ')}`);
    if (record.recentChanges.length) parts.push(`Recent: ${record.recentChanges.slice(0, 3).join('; ')}`);
    return parts.join('\n');
  }
}
