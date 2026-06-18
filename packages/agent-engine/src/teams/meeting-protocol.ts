import { getLogger } from '@titan/logging';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'meeting-protocol' });

export interface MeetingAgenda {
  topic: string;
  context: string;
  participants: string[];
  maxRounds: number;
}

export interface MeetingMessage {
  from: string;
  content: string;
  round: number;
  timestamp: Date;
}

export interface MeetingResult {
  topic: string;
  rounds: number;
  messages: MeetingMessage[];
  decisions: string[];
  actionItems: Array<{ assignee: string; task: string }>;
  consensus: string;
}

export class MeetingProtocol {
  constructor(private llm: LlmProvider) {}

  async conduct(agenda: MeetingAgenda): Promise<MeetingResult> {
    const messages: MeetingMessage[] = [];
    let round = 0;

    for (round = 1; round <= agenda.maxRounds; round++) {
      for (const participant of agenda.participants) {
        const context = messages.slice(-10).map((m) => `[${m.from}]: ${m.content}`).join('\n');

        const completion = await this.llm.complete([
          { role: 'system', content: `You are "${participant}" in a team meeting about: ${agenda.topic}. Give your perspective in 2-3 sentences. Be specific and constructive. If you agree with others, say so briefly and add new points.` },
          { role: 'user', content: `Context: ${agenda.context}\n\nDiscussion so far:\n${context || 'No discussion yet — you speak first.'}\n\nYour input as ${participant}:` },
        ], { temperature: 0.5, maxTokens: 200 });

        messages.push({ from: participant, content: completion.content, round, timestamp: new Date() });
      }

      // Check for consensus
      if (round >= 2) {
        const lastRound = messages.filter((m) => m.round === round);
        const hasAgreement = lastRound.every((m) => m.content.match(/(agree|consensus|aligned|same|يتفق|موافق)/i));
        if (hasAgreement) break;
      }
    }

    // Synthesize decisions
    const synthesis = await this.synthesize(agenda, messages);

    log.info({ topic: agenda.topic, rounds: round, messages: messages.length }, 'meeting concluded');
    return { topic: agenda.topic, rounds: round, messages, ...synthesis };
  }

  private async synthesize(agenda: MeetingAgenda, messages: MeetingMessage[]): Promise<{ decisions: string[]; actionItems: Array<{ assignee: string; task: string }>; consensus: string }> {
    const transcript = messages.map((m) => `[Round ${m.round} - ${m.from}]: ${m.content}`).join('\n');

    try {
      const completion = await this.llm.complete([
        { role: 'system', content: 'Summarize this meeting. Respond with JSON: { "decisions": ["..."], "actionItems": [{"assignee": "role", "task": "..."}], "consensus": "..." }' },
        { role: 'user', content: `Topic: ${agenda.topic}\n\nTranscript:\n${transcript}` },
      ], { temperature: 0.1 });

      const match = completion.content.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as Record<string, unknown>;
        return {
          decisions: Array.isArray(parsed.decisions) ? parsed.decisions.map(String) : [],
          actionItems: Array.isArray(parsed.actionItems)
            ? parsed.actionItems.map((i) => ({ assignee: String((i as Record<string, unknown>).assignee ?? ''), task: String((i as Record<string, unknown>).task ?? '') }))
            : [],
          consensus: String(parsed.consensus ?? 'No clear consensus'),
        };
      }
    } catch { /* fall through */ }

    return { decisions: [], actionItems: [], consensus: 'Meeting concluded without formal synthesis' };
  }
}
