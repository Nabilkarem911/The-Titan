import { getLogger } from '@titan/logging';
import { incCounter, observeHistogram } from '@titan/observability';
import type { LlmProvider } from '../types.js';
import { InnerMonologueManager } from './inner-monologue.js';
import { CognitiveController, type SelfModel } from './cognitive-controller.js';
import { EpisodicBuffer, type EpisodicItem } from './episodic-buffer.js';
import { episodicBufferItems as ebiRepo } from '@titan/database';

const log = getLogger().child({ component: 'mirror:orchestrator' });

interface MirrorState {
  narrative: string;
  selfModel: SelfModel;
  episodicBuffer: EpisodicItem[];
  threadCount: number;
  tokensUsed: number;
  timestamp: Date;
}

interface MirrorConfig {
  enabled: boolean;
  maxThreads?: number;
  episodicCapacity?: number;
  narrativeHistorySize?: number;
}

const DEFAULT_CONFIG: MirrorConfig = {
  enabled: false,
  maxThreads: 5,
  episodicCapacity: 7,
  narrativeHistorySize: 20,
};

export class MirrorConsciousness {
  private monologue: InnerMonologueManager;
  private controller: CognitiveController;
  private buffer: EpisodicBuffer;
  private config: MirrorConfig;
  private enabled: boolean;
  private turnCount: number = 0;

  constructor(config?: Partial<MirrorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.enabled = this.config.enabled ||
      process.env['TITAN_COSMIC_MIRROR_ENABLED'] === 'true';

    this.monologue = new InnerMonologueManager(this.config.maxThreads);
    this.controller = new CognitiveController(this.config.narrativeHistorySize);
    this.buffer = new EpisodicBuffer(this.config.episodicCapacity);

    log.info({ enabled: this.enabled }, 'MIRROR consciousness initialized');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  enable(): void {
    this.enabled = true;
    log.info('MIRROR consciousness enabled');
  }

  disable(): void {
    this.enabled = false;
    log.info('MIRROR consciousness disabled');
  }

  getEpisodicBuffer(): EpisodicBuffer {
    return this.buffer;
  }

  getController(): CognitiveController {
    return this.controller;
  }

  getMonologue(): InnerMonologueManager {
    return this.monologue;
  }

  async processTurn(
    llm: LlmProvider,
    context: string,
    userMessage?: string,
  ): Promise<MirrorState | null> {
    if (!this.enabled) return null;

    const startTime = Date.now();
    this.turnCount++;
    incCounter('mirror_turns', 'MIRROR turns processed', 1);

    try {
      // Add user message to episodic buffer if provided
      if (userMessage) {
        this.buffer.add({
          content: `User said: ${userMessage.slice(0, 200)}`,
          type: 'perception',
          salience: 0.8,
        });
        ebiRepo.insert(`User said: ${userMessage.slice(0, 200)}`, 'perception', 0.8).catch((err) => log.error({ err }, 'DB write failed'));
      }

      // Run parallel cognitive threads
      const threadResults = await this.monologue.runAllThreads(llm, context);

      // Add thread outputs to episodic buffer
      for (const result of threadResults) {
        this.buffer.add({
          content: result.output.slice(0, 200),
          type: result.type === 'emotional' ? 'emotion' : 'thought',
          salience: 0.6,
        });
        ebiRepo.insert(result.output.slice(0, 200), result.type === 'emotional' ? 'emotion' : 'thought', 0.6).catch((err) => log.error({ err }, 'DB write failed'));
      }

      // Synthesize narrative via cognitive controller
      const narrativeResult = await this.controller.synthesize(llm, threadResults, context);

      // Add narrative to episodic buffer
      this.buffer.add({
        content: `Conscious experience: ${narrativeResult.narrative.slice(0, 200)}`,
        type: 'thought',
        salience: 0.9,
      });
      ebiRepo.insert(`Conscious experience: ${narrativeResult.narrative.slice(0, 200)}`, 'thought', 0.9).catch((err) => log.error({ err }, 'DB write failed'));

      // Decay salience of older items
      this.buffer.decaySalience(0.92);

      const durationMs = Date.now() - startTime;
      observeHistogram('mirror_turn_duration_ms', 'MIRROR turn duration in milliseconds', durationMs);

      const state: MirrorState = {
        narrative: narrativeResult.narrative,
        selfModel: narrativeResult.selfModel,
        episodicBuffer: this.buffer.getItems(),
        threadCount: threadResults.length,
        tokensUsed: threadResults.reduce((s, r) => s + r.tokensUsed, 0) + narrativeResult.tokensUsed,
        timestamp: new Date(),
      };

      log.info({
        turn: this.turnCount,
        durationMs,
        tokensUsed: state.tokensUsed,
        confidence: state.selfModel.confidenceLevel,
        bufferSize: state.episodicBuffer.length,
      }, 'MIRROR turn completed');

      return state;
    } catch (err) {
      log.error({ err, turn: this.turnCount }, 'MIRROR turn failed');
      return null;
    }
  }

  getTurnCount(): number {
    return this.turnCount;
  }

  getCurrentState(): MirrorState | null {
    const narrative = this.controller.getLastNarrative();
    const selfModel = this.controller.getLastSelfModel();
    if (!narrative || !selfModel) return null;

    return {
      narrative,
      selfModel,
      episodicBuffer: this.buffer.getItems(),
      threadCount: this.monologue.getThreadCount(),
      tokensUsed: 0,
      timestamp: new Date(),
    };
  }

  reset(): void {
    this.monologue.clear();
    this.buffer.clear();
    this.turnCount = 0;
    log.info('MIRROR consciousness reset');
  }
}

let globalMirror: MirrorConsciousness | null = null;

function getMirrorConsciousness(): MirrorConsciousness {
  if (!globalMirror) {
    globalMirror = new MirrorConsciousness();
  }
  return globalMirror;
}

function initMirrorConsciousness(config?: Partial<MirrorConfig>): MirrorConsciousness {
  globalMirror = new MirrorConsciousness(config);
  return globalMirror;
}
