import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import type { LlmProvider, AgentStep } from '../types.js';

const log = getLogger().child({ component: 'introspection' });

export interface IntrospectionReport {
  id: string;
  stepIndex: number;
  reasoning: string;
  detectedBiases: string[];
  confidenceInReasoning: number;
  isGenuine: boolean;
  isConfabulating: boolean;
  unusualState: boolean;
  reasoningPattern: string;
  recommendations: string[];
  createdAt: Date;
}

export interface BiasDetection {
  bias: string;
  description: string;
  evidence: string;
  severity: 'low' | 'medium' | 'high';
}

export interface IntrospectionStats {
  totalIntrospections: number;
  biasesDetected: number;
  confabulationsDetected: number;
  unusualStates: number;
  avgConfidence: number;
  topBiases: Array<{ bias: string; count: number }>;
}

const INTROSPECTION_PROMPT = `You are an introspective awareness module. Analyze the agent's reasoning step and determine:

1. Is the reasoning genuine or confabulated (making up plausible-sounding but unfounded explanations)?
2. Are there cognitive biases present? (e.g., confirmation bias, anchoring, overconfidence, availability heuristic)
3. Is the agent in an unusual state? (e.g., stuck in a loop, repeating patterns, ignoring evidence)
4. What reasoning pattern is being used? (e.g., deductive, inductive, abductive, analogical)
5. How confident should we be in this reasoning?

Respond in JSON:
{
  "reasoning": "analysis of the reasoning process",
  "detectedBiases": ["bias1", "bias2"],
  "biasDetails": [
    {"bias": "name", "description": "what", "evidence": "why", "severity": "low|medium|high"}
  ],
  "confidenceInReasoning": 0-100,
  "isGenuine": true/false,
  "isConfabulating": true/false,
  "unusualState": true/false,
  "reasoningPattern": "deductive|inductive|abductive|analogical",
  "recommendations": ["action1", "action2"]
}`;

export class IntrospectionModule {
  private reports: IntrospectionReport[] = [];
  private maxReports = 500;
  private biasCounts = new Map<string, number>();

  constructor(private llm: LlmProvider) {}

  async introspectStep(step: AgentStep, stepIndex: number): Promise<IntrospectionReport> {
    log.info({ stepIndex, stepStatus: step.status }, 'introspecting step');

    try {
      const response = await this.llm.complete([
        { role: 'system', content: INTROSPECTION_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            stepIndex,
            status: step.status,
            thought: step.thought?.slice(0, 500),
            plan: step.plan?.slice(0, 300),
            action: step.action?.name,
            observation: step.observation
              ? `${step.observation.success ? 'success' : 'error'}: ${String(step.observation.error ?? '').slice(0, 200)}`
              : undefined,
            reflection: step.reflection?.slice(0, 300),
          }),
        },
      ], { temperature: 0.2, maxTokens: 800 });

      const parsed = this.parseIntrospection(response.content, stepIndex);

      // Track bias counts
      for (const bias of parsed.detectedBiases) {
        this.biasCounts.set(bias, (this.biasCounts.get(bias) ?? 0) + 1);
      }

      this.reports.push(parsed);
      if (this.reports.length > this.maxReports) {
        this.reports = this.reports.slice(-this.maxReports);
      }

      incCounter('introspection_run', 'Introspections performed', 1);
      if (parsed.isConfabulating) {
        incCounter('introspection_confabulation', 'Confabulations detected', 1);
      }
      if (parsed.detectedBiases.length > 0) {
        incCounter('introspection_bias', 'Biases detected', 1);
      }

      log.info(
        {
          stepIndex,
          genuine: parsed.isGenuine,
          confabulating: parsed.isConfabulating,
          biases: parsed.detectedBiases,
          confidence: parsed.confidenceInReasoning,
        },
        'introspection complete',
      );

      return parsed;
    } catch (err) {
      log.error({ err, stepIndex }, 'introspection failed');
      return {
        id: randomUUID().slice(0, 8),
        stepIndex,
        reasoning: 'Introspection failed',
        detectedBiases: [],
        confidenceInReasoning: 0,
        isGenuine: true,
        isConfabulating: false,
        unusualState: false,
        reasoningPattern: 'unknown',
        recommendations: [],
        createdAt: new Date(),
      };
    }
  }

  async introspectRun(steps: AgentStep[]): Promise<IntrospectionReport[]> {
    const reports: IntrospectionReport[] = [];
    for (let i = 0; i < steps.length; i++) {
      const report = await this.introspectStep(steps[i], i);
      reports.push(report);
    }
    return reports;
  }

  getReports(): IntrospectionReport[] {
    return this.reports;
  }

  getRecentReports(count: number = 10): IntrospectionReport[] {
    return this.reports.slice(-count);
  }

  getBiasDetections(): BiasDetection[] {
    const allBiases: BiasDetection[] = [];
    for (const report of this.reports) {
      // Reconstruct from stored data
      for (const bias of report.detectedBiases) {
        allBiases.push({
          bias,
          description: `Detected in step ${report.stepIndex}`,
          evidence: report.reasoning.slice(0, 100),
          severity: 'medium',
        });
      }
    }
    return allBiases;
  }

  stats(): IntrospectionStats {
    const total = this.reports.length;
    const biases = this.reports.reduce((s, r) => s + r.detectedBiases.length, 0);
    const confabulations = this.reports.filter((r) => r.isConfabulating).length;
    const unusual = this.reports.filter((r) => r.unusualState).length;
    const avgConf = total > 0
      ? Math.round(this.reports.reduce((s, r) => s + r.confidenceInReasoning, 0) / total)
      : 0;

    const topBiases = Array.from(this.biasCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([bias, count]) => ({ bias, count }));

    return {
      totalIntrospections: total,
      biasesDetected: biases,
      confabulationsDetected: confabulations,
      unusualStates: unusual,
      avgConfidence: avgConf,
      topBiases,
    };
  }

  clear(): void {
    this.reports = [];
    this.biasCounts.clear();
  }

  private parseIntrospection(content: string, stepIndex: number): IntrospectionReport {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('no JSON');
      const raw = JSON.parse(jsonMatch[0]);

      const biases: string[] = Array.isArray(raw.detectedBiases) ? raw.detectedBiases : [];

      return {
        id: randomUUID().slice(0, 8),
        stepIndex,
        reasoning: String(raw.reasoning ?? ''),
        detectedBiases: biases,
        confidenceInReasoning: Math.max(0, Math.min(100, Number(raw.confidenceInReasoning ?? 50))),
        isGenuine: Boolean(raw.isGenuine ?? true),
        isConfabulating: Boolean(raw.isConfabulating ?? false),
        unusualState: Boolean(raw.unusualState ?? false),
        reasoningPattern: String(raw.reasoningPattern ?? 'unknown'),
        recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : [],
        createdAt: new Date(),
      };
    } catch {
      return {
        id: randomUUID().slice(0, 8),
        stepIndex,
        reasoning: 'Parse failed',
        detectedBiases: [],
        confidenceInReasoning: 50,
        isGenuine: true,
        isConfabulating: false,
        unusualState: false,
        reasoningPattern: 'unknown',
        recommendations: [],
        createdAt: new Date(),
      };
    }
  }
}
