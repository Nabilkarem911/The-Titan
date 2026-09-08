import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'proactive-intelligence' });

interface ProactiveSuggestion {
  id: string;
  timestamp: Date;
  pattern: string;
  suggestion: string;
  confidence: number;
  category: 'automation' | 'fix' | 'optimization' | 'preparation';
  accepted: boolean | null;
}

interface CausalSimulation {
  id: string;
  action: string;
  predictedEffects: Array<{ entity: string; effect: string; probability: number }>;
  rootCauseChain: string[];
  confidence: number;
  safeToExecute: boolean;
}

interface ArchitectureChange {
  id: string;
  fromPattern: string;
  toPattern: string;
  reason: string;
  taskType: string;
  applied: boolean;
  tested: boolean;
}

interface LiveCodeEdit {
  id: string;
  filePath: string;
  originalCode: string;
  modifiedCode: string;
  diffPreview: string;
  explanation: string;
  applied: boolean;
  userApproved: boolean;
}

const SUGGESTION_PROMPT = `You are a proactive intelligence engine. Analyze user patterns and suggest improvements.

Respond in JSON:
{
  "pattern": "the observed pattern",
  "suggestion": "what to proactively suggest",
  "confidence": 0.0-1.0,
  "category": "automation|fix|optimization|preparation"
}`;

const SIMULATION_PROMPT = `You are a causal world model. Simulate the effects of an action on the environment.

Respond in JSON:
{
  "predictedEffects": [{"entity": "...", "effect": "...", "probability": 0.0-1.0}],
  "rootCauseChain": ["cause1 → effect1 → effect2"],
  "confidence": 0.0-1.0,
  "safeToExecute": true|false
}`;

const MAX_SUGGESTIONS_PER_DAY = 3;
const KILL_SWITCH = process.env.TITAN_MYTHICAL_ENABLED !== 'true';

export class ProactiveIntelligence {
  private llm: LlmProvider;
  private suggestions: ProactiveSuggestion[] = [];
  private simulations: CausalSimulation[] = [];
  private architectureChanges: ArchitectureChange[] = [];
  private liveEdits: LiveCodeEdit[] = [];
  private doNotDisturb: { start: number; end: number } | null = null;

  constructor(llm: LlmProvider) {
    this.llm = llm;
  }

  isKillSwitchActive(): boolean {
    return KILL_SWITCH;
  }

  setDoNotDisturb(start: number, end: number): void {
    this.doNotDisturb = { start, end };
  }

  private isWithinDND(): boolean {
    if (!this.doNotDisturb) return false;
    const hour = new Date().getHours();
    return hour >= this.doNotDisturb.start && hour < this.doNotDisturb.end;
  }

  private canSuggest(): boolean {
    if (this.isWithinDND()) return false;
    const today = new Date().toDateString();
    const todayCount = this.suggestions.filter((s) => s.timestamp.toDateString() === today).length;
    return todayCount < MAX_SUGGESTIONS_PER_DAY;
  }

  async analyzePatterns(userActions: string[]): Promise<ProactiveSuggestion | null> {
    if (KILL_SWITCH || !this.canSuggest()) return null;

    try {
      const completion = await this.llm.complete([
        { role: 'system', content: SUGGESTION_PROMPT },
        { role: 'user', content: `User actions:\n${userActions.slice(-20).join('\n')}` },
      ], { temperature: 0.3, maxTokens: 500 });

      const jsonMatch = completion.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      const suggestion: ProactiveSuggestion = {
        id: randomUUID(),
        timestamp: new Date(),
        pattern: parsed.pattern ?? '',
        suggestion: parsed.suggestion ?? '',
        confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
        category: ['automation', 'fix', 'optimization', 'preparation'].includes(parsed.category) ? parsed.category : 'optimization',
        accepted: null,
      };

      this.suggestions.push(suggestion);
      incCounter('proactive_suggestions', 'Proactive suggestions generated', 1);
      return suggestion;
    } catch (err) {
      log.error({ err }, 'proactive analysis failed');
      return null;
    }
  }

  async simulateAction(action: string, environmentContext: string): Promise<CausalSimulation> {
    try {
      const completion = await this.llm.complete([
        { role: 'system', content: SIMULATION_PROMPT },
        { role: 'user', content: `Action: ${action}\nEnvironment: ${environmentContext}` },
      ], { temperature: 0.2, maxTokens: 1000 });

      const jsonMatch = completion.content.match(/\{[\s\S]*\}/);
      let predictedEffects: Array<{ entity: string; effect: string; probability: number }> = [];
      let rootCauseChain: string[] = [];
      let confidence = 0.5;
      let safeToExecute = false;

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        predictedEffects = Array.isArray(parsed.predictedEffects) ? parsed.predictedEffects.map((e: { entity?: unknown; effect?: unknown; probability?: unknown }) => ({
          entity: String(e.entity ?? ''),
          effect: String(e.effect ?? ''),
          probability: Math.max(0, Math.min(1, Number(e.probability ?? 0.5))),
        })) : [];
        rootCauseChain = Array.isArray(parsed.rootCauseChain) ? parsed.rootCauseChain : [];
        confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0.5));
        safeToExecute = Boolean(parsed.safeToExecute ?? false);
      }

      const simulation: CausalSimulation = {
        id: randomUUID(),
        action,
        predictedEffects,
        rootCauseChain,
        confidence,
        safeToExecute,
      };

      this.simulations.push(simulation);
      incCounter('causal_simulations', 'Causal simulations run', 1);
      return simulation;
    } catch (err) {
      log.error({ err }, 'causal simulation failed');
      return {
        id: randomUUID(),
        action,
        predictedEffects: [],
        rootCauseChain: [],
        confidence: 0,
        safeToExecute: false,
      };
    }
  }

  proposeArchitectureChange(taskType: string, currentPattern: string, performanceHistory: Array<{ pattern: string; success: boolean; score: number }>): ArchitectureChange {
    const patternScores: Record<string, { total: number; count: number }> = {};

    for (const h of performanceHistory) {
      if (!patternScores[h.pattern]) patternScores[h.pattern] = { total: 0, count: 0 };
      patternScores[h.pattern].total += h.score;
      patternScores[h.pattern].count++;
    }

    let bestPattern = currentPattern;
    let bestAvg = 0;
    for (const [pattern, scores] of Object.entries(patternScores)) {
      const avg = scores.total / scores.count;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestPattern = pattern;
      }
    }

    const change: ArchitectureChange = {
      id: randomUUID(),
      fromPattern: currentPattern,
      toPattern: bestPattern,
      reason: `Pattern "${bestPattern}" averages ${bestAvg.toFixed(1)} vs current "${currentPattern}"`,
      taskType,
      applied: false,
      tested: false,
    };

    this.architectureChanges.push(change);
    incCounter('architecture_changes_proposed', 'Architecture changes proposed', 1);
    return change;
  }

  applyArchitectureChange(changeId: string): boolean {
    const change = this.architectureChanges.find((c) => c.id === changeId);
    if (!change || !change.tested) return false;
    change.applied = true;
    incCounter('architecture_changes_applied', 'Architecture changes applied', 1);
    return true;
  }

  async proposeLiveEdit(filePath: string, originalCode: string, instruction: string): Promise<LiveCodeEdit> {
    try {
      const completion = await this.llm.complete([
        { role: 'system', content: 'You are a conversational code editor. Modify code based on instructions. Respond in JSON: {"modifiedCode": "...", "explanation": "...", "diffPreview": "..."}' },
        { role: 'user', content: `File: ${filePath}\nCode:\n${originalCode}\n\nInstruction: ${instruction}` },
      ], { temperature: 0.2, maxTokens: 2000 });

      const jsonMatch = completion.content.match(/\{[\s\S]*\}/);
      let modifiedCode = originalCode;
      let explanation = '';
      let diffPreview = '';

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        modifiedCode = parsed.modifiedCode ?? originalCode;
        explanation = parsed.explanation ?? '';
        diffPreview = parsed.diffPreview ?? this.generateSimpleDiff(originalCode, modifiedCode);
      }

      const edit: LiveCodeEdit = {
        id: randomUUID(),
        filePath,
        originalCode,
        modifiedCode,
        diffPreview,
        explanation,
        applied: false,
        userApproved: false,
      };

      this.liveEdits.push(edit);
      incCounter('live_edits_proposed', 'Live code edits proposed', 1);
      return edit;
    } catch (err) {
      log.error({ err }, 'live edit failed');
      return {
        id: randomUUID(),
        filePath,
        originalCode,
        modifiedCode: originalCode,
        diffPreview: '',
        explanation: 'Edit failed',
        applied: false,
        userApproved: false,
      };
    }
  }

  approveLiveEdit(editId: string): boolean {
    const edit = this.liveEdits.find((e) => e.id === editId);
    if (!edit) return false;
    edit.userApproved = true;
    edit.applied = true;
    incCounter('live_edits_applied', 'Live code edits applied', 1);
    return true;
  }

  getSuggestions(): ProactiveSuggestion[] {
    return [...this.suggestions];
  }

  getSimulations(): CausalSimulation[] {
    return [...this.simulations];
  }

  getArchitectureChanges(): ArchitectureChange[] {
    return [...this.architectureChanges];
  }

  getLiveEdits(): LiveCodeEdit[] {
    return [...this.liveEdits];
  }

  getStats(): {
    suggestions: number;
    simulations: number;
    architectureChanges: number;
    liveEdits: number;
    killSwitch: boolean;
  } {
    return {
      suggestions: this.suggestions.length,
      simulations: this.simulations.length,
      architectureChanges: this.architectureChanges.length,
      liveEdits: this.liveEdits.length,
      killSwitch: KILL_SWITCH,
    };
  }

  reset(): void {
    this.suggestions = [];
    this.simulations = [];
    this.architectureChanges = [];
    this.liveEdits = [];
  }

  private generateSimpleDiff(original: string, modified: string): string {
    const origLines = original.split('\n');
    const modLines = modified.split('\n');
    const maxLen = Math.max(origLines.length, modLines.length);
    const diff: string[] = [];

    for (let i = 0; i < maxLen; i++) {
      if (origLines[i] !== modLines[i]) {
        if (origLines[i]) diff.push(`- ${origLines[i]}`);
        if (modLines[i]) diff.push(`+ ${modLines[i]}`);
      }
    }

    return diff.join('\n');
  }
}
