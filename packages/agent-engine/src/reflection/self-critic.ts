import { getLogger } from '@titan/logging';
import type { LlmProvider, AgentRun, AgentStep } from '../types.js';
import type { CriticResult, CriticIssue } from './types.js';

const log = getLogger().child({ component: 'self-critic' });

const CRITIC_PROMPT = `You are a strict quality reviewer for an AI agent's output. Given the original task and the agent's answer, evaluate it critically.

Check for:
1. **Factual errors** — claims that are likely wrong or unverifiable
2. **Incompleteness** — important aspects of the question that weren't addressed
3. **Logical flaws** — contradictions or non-sequiturs in the reasoning
4. **Hallucination** — information that wasn't in the tool results but was presented as fact
5. **Relevance** — whether the answer actually addresses what was asked

Respond ONLY with JSON:
{
  "approved": true/false,
  "issues": [
    { "severity": "critical|warning|info", "description": "...", "stepIndex": null }
  ],
  "suggestions": ["..."],
  "revisedAnswer": "only if you can fix critical issues, otherwise null"
}`;

export class SelfCritic {
  constructor(private llm: LlmProvider) {}

  async critique(run: AgentRun): Promise<CriticResult> {
    if (!run.finalAnswer) {
      return { approved: false, issues: [{ severity: 'critical', description: 'No answer produced' }], suggestions: ['Re-run the agent'] };
    }

    const stepsContext = run.steps
      .map((s, i) => {
        const parts = [`Step ${i + 1}:`];
        if (s.thought) parts.push(`  Thought: ${s.thought.slice(0, 300)}`);
        if (s.action) parts.push(`  Action: ${s.action.name}(${JSON.stringify(s.action.params).slice(0, 200)})`);
        if (s.observation) {
          const data = s.observation.success
            ? (typeof s.observation.data === 'string' ? s.observation.data : JSON.stringify(s.observation.data))
            : `Error: ${s.observation.error}`;
          parts.push(`  Result: ${(data ?? '').slice(0, 300)}`);
        }
        if (s.reflection) parts.push(`  Reflection: ${s.reflection.slice(0, 300)}`);
        return parts.join('\n');
      })
      .join('\n\n');

    try {
      const completion = await this.llm.complete([
        { role: 'system', content: CRITIC_PROMPT },
        {
          role: 'user',
          content: `Task: ${run.prompt}\n\nAgent steps:\n${stepsContext}\n\nFinal answer:\n${run.finalAnswer}`,
        },
      ], { temperature: 0.1 });

      const result = this.parseResult(completion.content);
      log.info({ runId: run.id, approved: result.approved, issues: result.issues.length }, 'critique complete');
      return result;
    } catch (err) {
      log.warn({ runId: run.id, err: err instanceof Error ? err.message : 'Unknown' }, 'critique failed');
      return { approved: true, issues: [], suggestions: [] };
    }
  }

  async quickCheck(answer: string, prompt: string): Promise<{ pass: boolean; reason?: string }> {
    try {
      const completion = await this.llm.complete([
        {
          role: 'system',
          content: 'You verify AI answers. Respond with JSON: { "pass": true/false, "reason": "..." }. Pass = answer is correct and relevant. Fail = answer has errors, is off-topic, or is incomplete.',
        },
        { role: 'user', content: `Question: ${prompt}\n\nAnswer: ${answer}` },
      ], { temperature: 0 });

      const match = completion.content.match(/\{[\s\S]*\}/);
      if (!match) return { pass: true };

      const parsed = JSON.parse(match[0]) as { pass?: boolean; reason?: string };
      return { pass: parsed.pass !== false, reason: parsed.reason ? String(parsed.reason) : undefined };
    } catch {
      return { pass: true };
    }
  }

  private parseResult(content: string): CriticResult {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      return { approved: true, issues: [], suggestions: [] };
    }

    try {
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;

      const issues: CriticIssue[] = Array.isArray(parsed.issues)
        ? parsed.issues.map((item) => {
            const raw = item as Record<string, unknown>;
            return {
              severity: (['critical', 'warning', 'info'].includes(String(raw.severity)) ? String(raw.severity) : 'info') as CriticIssue['severity'],
              description: String(raw.description ?? ''),
              stepIndex: typeof raw.stepIndex === 'number' ? raw.stepIndex : undefined,
            };
          })
        : [];

      const suggestions: string[] = Array.isArray(parsed.suggestions)
        ? parsed.suggestions.map(String)
        : [];

      return {
        approved: parsed.approved !== false,
        issues,
        suggestions,
        revisedAnswer: typeof parsed.revisedAnswer === 'string' ? parsed.revisedAnswer : undefined,
      };
    } catch {
      return { approved: true, issues: [], suggestions: [] };
    }
  }
}
