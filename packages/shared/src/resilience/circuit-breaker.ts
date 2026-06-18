import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'circuit-breaker' });

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenMaxCalls: number;
  name: string;
}

const DEFAULT_CONFIG: Omit<CircuitBreakerConfig, 'name'> = {
  failureThreshold: 5,
  resetTimeout: 30000,
  halfOpenMaxCalls: 2,
};

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenCalls = 0;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> & { name: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new CircuitOpenError(this.config.name, this.remainingResetTime());
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  canExecute(): boolean {
    switch (this.state) {
      case 'closed':
        return true;
      case 'open':
        if (Date.now() - this.lastFailureTime >= this.config.resetTimeout) {
          this.transitionTo('half_open');
          return true;
        }
        return false;
      case 'half_open':
        return this.halfOpenCalls < this.config.halfOpenMaxCalls;
    }
  }

  getState(): CircuitState {
    if (this.state === 'open' && Date.now() - this.lastFailureTime >= this.config.resetTimeout) {
      this.transitionTo('half_open');
    }
    return this.state;
  }

  getStats(): { state: CircuitState; failures: number; name: string } {
    return { state: this.getState(), failures: this.failureCount, name: this.config.name };
  }

  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.halfOpenCalls = 0;
  }

  private onSuccess(): void {
    if (this.state === 'half_open') {
      this.transitionTo('closed');
    }
    this.failureCount = 0;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half_open') {
      this.transitionTo('open');
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.transitionTo('open');
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === 'half_open') this.halfOpenCalls = 0;
    if (newState === 'closed') this.failureCount = 0;

    log.info({ name: this.config.name, from: oldState, to: newState, failures: this.failureCount }, 'circuit state changed');
  }

  private remainingResetTime(): number {
    return Math.max(0, this.config.resetTimeout - (Date.now() - this.lastFailureTime));
  }
}

export class CircuitOpenError extends Error {
  constructor(public circuitName: string, public retryAfterMs: number) {
    super(`Circuit "${circuitName}" is open — retry after ${Math.ceil(retryAfterMs / 1000)}s`);
    this.name = 'CircuitOpenError';
  }
}
