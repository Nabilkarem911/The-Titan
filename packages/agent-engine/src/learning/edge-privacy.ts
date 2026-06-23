import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';

const log = getLogger().child({ component: 'edge-privacy' });

export interface OllamaModel {
  id: string;
  name: string;
  size: string;
  quantization: string;
  contextWindow: number;
}

export interface LocalRoutingResult {
  useLocal: boolean;
  model: string;
  reason: string;
  privacyMode: boolean;
}

export interface FederatedUpdate {
  id: string;
  fromInstance: string;
  modelDiff: string;
  encrypted: boolean;
  timestamp: Date;
  applied: boolean;
}

const PRIVACY_MODE = process.env.TITAN_PRIVACY_MODE === 'true';

export class EdgePrivacy {
  private ollamaUrl: string;
  private availableModels: OllamaModel[] = [];
  private federatedUpdates: FederatedUpdate[] = [];
  private privacyMode: boolean;

  constructor(ollamaUrl?: string) {
    this.ollamaUrl = ollamaUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    this.privacyMode = PRIVACY_MODE;
  }

  async detectModels(): Promise<OllamaModel[]> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`);
      if (!response.ok) {
        log.warn({ status: response.status }, 'Ollama not available');
        return [];
      }

      const data = await response.json() as { models: Array<{ name: string; size: number; details: { quantization_level: string; context_window: number } }> };
      this.availableModels = data.models.map((m) => ({
        id: randomUUID(),
        name: m.name,
        size: `${Math.round(m.size / 1e9)}GB`,
        quantization: m.details?.quantization_level ?? 'unknown',
        contextWindow: m.details?.context_window ?? 4096,
      }));

      incCounter('ollama_models_detected', 'Ollama models detected', this.availableModels.length);
      log.info({ count: this.availableModels.length }, 'Ollama models detected');
      return this.availableModels;
    } catch (err) {
      log.warn({ err }, 'Ollama detection failed — running in cloud-only mode');
      return [];
    }
  }

  routeRequest(complexity: number, sensitiveData: boolean): LocalRoutingResult {
    if (this.privacyMode && sensitiveData) {
      return {
        useLocal: true,
        model: this.availableModels[0]?.name ?? 'llama3',
        reason: 'Privacy mode + sensitive data → local model',
        privacyMode: true,
      };
    }

    if (sensitiveData && this.availableModels.length > 0) {
      return {
        useLocal: true,
        model: this.availableModels[0].name,
        reason: 'Sensitive data detected → local model',
        privacyMode: this.privacyMode,
      };
    }

    if (complexity < 0.3 && this.availableModels.length > 0) {
      return {
        useLocal: true,
        model: this.availableModels[0].name,
        reason: 'Simple task → local model (cost saving)',
        privacyMode: this.privacyMode,
      };
    }

    return {
      useLocal: false,
      model: 'cloud',
      reason: 'Complex task or no local models → cloud model',
      privacyMode: this.privacyMode,
    };
  }

  async generateLocalCompletion(model: string, prompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: false }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json() as { response: string };
      incCounter('local_completions', 'Local LLM completions', 1);
      log.info({ model, promptLength: prompt.length }, 'local completion generated');
      return data.response;
    } catch (err) {
      log.error({ err }, 'local completion failed');
      throw err;
    }
  }

  isOfflineCapable(): boolean {
    return this.availableModels.length > 0;
  }

  isPrivacyMode(): boolean {
    return this.privacyMode;
  }

  setPrivacyMode(enabled: boolean): void {
    this.privacyMode = enabled;
    log.info({ privacyMode: enabled }, 'privacy mode toggled');
  }

  getAvailableModels(): OllamaModel[] {
    return [...this.availableModels];
  }

  shareFederatedUpdate(fromInstance: string, modelDiff: string, encrypt: (data: string) => string): FederatedUpdate {
    const encryptedDiff = encrypt(modelDiff);
    const update: FederatedUpdate = {
      id: randomUUID(),
      fromInstance,
      modelDiff: encryptedDiff,
      encrypted: true,
      timestamp: new Date(),
      applied: false,
    };

    this.federatedUpdates.push(update);
    incCounter('federated_updates_shared', 'Federated updates shared', 1);
    log.info({ fromInstance, encrypted: true }, 'federated update shared');
    return update;
  }

  applyFederatedUpdate(updateId: string, decrypt: (data: string) => string): boolean {
    const update = this.federatedUpdates.find((u) => u.id === updateId);
    if (!update) return false;

    try {
      const decrypted = decrypt(update.modelDiff);
      log.info({ fromInstance: update.fromInstance, decryptedLength: decrypted.length }, 'federated update applied');
      update.applied = true;
      incCounter('federated_updates_applied', 'Federated updates applied', 1);
      return true;
    } catch (err) {
      log.error({ err }, 'failed to apply federated update');
      return false;
    }
  }

  getFederatedUpdates(): FederatedUpdate[] {
    return [...this.federatedUpdates];
  }

  getStats(): {
    localModels: number;
    privacyMode: boolean;
    offlineCapable: boolean;
    federatedUpdates: number;
    appliedUpdates: number;
  } {
    return {
      localModels: this.availableModels.length,
      privacyMode: this.privacyMode,
      offlineCapable: this.isOfflineCapable(),
      federatedUpdates: this.federatedUpdates.length,
      appliedUpdates: this.federatedUpdates.filter((u) => u.applied).length,
    };
  }

  reset(): void {
    this.availableModels = [];
    this.federatedUpdates = [];
  }
}
