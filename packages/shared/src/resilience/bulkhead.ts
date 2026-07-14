const log = { info: (..._args: unknown[]) => {}, warn: (..._args: unknown[]) => {} };

interface BulkheadConfig {
  name: string;
  maxConcurrent: number;
  maxQueue: number;
  queueTimeout: number;
}

const DEFAULT_CONFIG: Omit<BulkheadConfig, 'name'> = {
  maxConcurrent: 10,
  maxQueue: 50,
  queueTimeout: 30000,
};

export class Bulkhead {
  private active = 0;
  private queue: Array<{ resolve: () => void; reject: (err: Error) => void; timer: ReturnType<typeof setTimeout> }> = [];
  private config: BulkheadConfig;

  constructor(config: Partial<BulkheadConfig> & { name: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  getStats(): { name: string; active: number; queued: number; maxConcurrent: number } {
    return {
      name: this.config.name,
      active: this.active,
      queued: this.queue.length,
      maxConcurrent: this.config.maxConcurrent,
    };
  }

  private acquire(): Promise<void> {
    if (this.active < this.config.maxConcurrent) {
      this.active++;
      return Promise.resolve();
    }

    if (this.queue.length >= this.config.maxQueue) {
      return Promise.reject(new BulkheadFullError(this.config.name));
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.queue.findIndex((q) => q.resolve === resolve);
        if (idx >= 0) this.queue.splice(idx, 1);
        reject(new BulkheadTimeoutError(this.config.name, this.config.queueTimeout));
      }, this.config.queueTimeout);

      this.queue.push({ resolve, reject, timer });
    });
  }

  private release(): void {
    this.active--;

    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      clearTimeout(next.timer);
      this.active++;
      next.resolve();
    }
  }
}

export class BulkheadFullError extends Error {
  constructor(name: string) {
    super(`Bulkhead "${name}" is full — all slots and queue occupied`);
    this.name = 'BulkheadFullError';
  }
}

class BulkheadTimeoutError extends Error {
  constructor(name: string, timeoutMs: number) {
    super(`Bulkhead "${name}" queue timeout after ${timeoutMs}ms`);
    this.name = 'BulkheadTimeoutError';
  }
}
