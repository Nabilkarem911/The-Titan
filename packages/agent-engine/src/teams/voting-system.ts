import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'voting-system' });

interface Vote {
  voter: string;
  choice: string;
  confidence: number;
  reasoning: string;
}

interface VoteResult {
  question: string;
  winner: string;
  votes: Vote[];
  unanimity: number;
  tally: Record<string, number>;
}

class VotingSystem {
  vote(question: string, votes: Vote[]): VoteResult {
    const tally: Record<string, number> = {};

    for (const v of votes) {
      tally[v.choice] = (tally[v.choice] ?? 0) + v.confidence;
    }

    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    const winner = sorted[0]?.[0] ?? 'no votes';
    const totalWeight = Object.values(tally).reduce((s, v) => s + v, 0);
    const unanimity = totalWeight > 0 ? (tally[winner] ?? 0) / totalWeight : 0;

    log.info({ question: question.slice(0, 50), winner, unanimity: Math.round(unanimity * 100) }, 'vote concluded');

    return { question, winner, votes, unanimity, tally };
  }

  majorityReached(result: VoteResult, threshold = 0.6): boolean {
    return result.unanimity >= threshold;
  }
}
