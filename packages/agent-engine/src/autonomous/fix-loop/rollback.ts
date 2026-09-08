import { getLogger } from '@titan/logging';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const log = getLogger().child({ component: 'rollback' });

interface Snapshot {
  id: string;
  files: Map<string, string>;
  timestamp: Date;
  description: string;
}

export class RollbackManager {
  private snapshots: Snapshot[] = [];
  private maxSnapshots = 10;

  takeSnapshot(filePaths: string[], description: string): Snapshot {
    const files = new Map<string, string>();
    for (const path of filePaths) {
      try {
        if (existsSync(path)) {
          files.set(path, readFileSync(path, 'utf-8'));
        }
      } catch { /* skip unreadable */ }
    }

    const snapshot: Snapshot = {
      id: `snap_${Date.now()}`,
      files,
      timestamp: new Date(),
      description,
    };

    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    log.info({ id: snapshot.id, files: files.size, description }, 'snapshot taken');
    return snapshot;
  }

  rollbackTo(snapshotId: string): { restored: string[]; failed: string[] } {
    const snapshot = this.snapshots.find((s) => s.id === snapshotId);
    if (!snapshot) throw new Error(`Snapshot "${snapshotId}" not found`);

    const restored: string[] = [];
    const failed: string[] = [];

    for (const [path, content] of snapshot.files) {
      try {
        writeFileSync(path, content);
        restored.push(path);
      } catch {
        failed.push(path);
      }
    }

    log.info({ snapshotId, restored: restored.length, failed: failed.length }, 'rollback complete');
    return { restored, failed };
  }

  rollbackLast(): { restored: string[]; failed: string[] } {
    if (this.snapshots.length === 0) throw new Error('No snapshots available');
    return this.rollbackTo(this.snapshots[this.snapshots.length - 1].id);
  }

  listSnapshots(): Array<{ id: string; files: number; description: string; timestamp: Date }> {
    return this.snapshots.map((s) => ({
      id: s.id,
      files: s.files.size,
      description: s.description,
      timestamp: s.timestamp,
    }));
  }

  clear(): void {
    this.snapshots = [];
  }
}
