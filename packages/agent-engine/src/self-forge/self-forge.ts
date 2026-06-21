import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { getGlobalToolRegistry } from '../tool-registry.js';
import type { LlmProvider } from '../types.js';
import { ToolForger } from './tool-forger.js';
import { ToolValidator } from './tool-validator.js';
import { ToolRegistrar } from './tool-registrar.js';

const log = getLogger().child({ component: 'self-forge' });

export interface ForgeResult {
  success: boolean;
  toolName?: string;
  error?: string;
  durationMs: number;
}

export class SelfForge {
  private forger: ToolForger;
  private validator: ToolValidator;
  private registrar: ToolRegistrar;
  private maxRetries: number;

  constructor(llm: LlmProvider, maxRetries = 2) {
    this.forger = new ToolForger(llm);
    this.validator = new ToolValidator();
    this.registrar = new ToolRegistrar();
    this.maxRetries = maxRetries;
  }

  async forgeTool(capability: string, reason: string): Promise<ForgeResult> {
    const start = performance.now();
    const registry = getGlobalToolRegistry();
    const existingTools = registry.list().map((t) => t.name);

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      log.info({ capability, attempt }, 'forge attempt');

      const spec = await this.forger.forge({ capability, reason, existingTools });
      if (!spec) {
        log.warn({ attempt }, 'forge produced no spec');
        continue;
      }

      // Check if tool already exists
      if (registry.has(spec.name)) {
        log.info({ toolName: spec.name }, 'tool already exists — skipping registration');
        return {
          success: true,
          toolName: spec.name,
          durationMs: Math.round(performance.now() - start),
        };
      }

      // Validate
      const validation = await this.validator.validate(spec);
      if (!validation.passed) {
        log.warn({ toolName: spec.name, errors: validation.errors, attempt }, 'validation failed');
        incCounter('self_forge_validation_failed', 'Self-forge validation failures', 1);
        continue;
      }

      // Register
      const registered = await this.registrar.register(spec);
      if (!registered) {
        log.warn({ toolName: spec.name, attempt }, 'registration failed');
        continue;
      }

      incCounter('self_forge_success', 'Successfully forged tools', 1);
      log.info({ toolName: spec.name, durationMs: Math.round(performance.now() - start) }, 'tool forged and registered');

      return {
        success: true,
        toolName: spec.name,
        durationMs: Math.round(performance.now() - start),
      };
    }

    incCounter('self_forge_failed', 'Self-forge total failures', 1);
    return {
      success: false,
      error: 'All forge attempts failed',
      durationMs: Math.round(performance.now() - start),
    };
  }

  listForgedTools() {
    return this.registrar.listForged();
  }

  removeForgedTool(name: string): boolean {
    return this.registrar.removeForged(name);
  }

  recordUsage(name: string): void {
    this.registrar.recordUsage(name);
  }
}
