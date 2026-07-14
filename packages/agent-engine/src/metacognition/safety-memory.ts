import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { safetyMemoryEntries as safetyRepo } from '@titan/database';

const log = getLogger().child({ component: 'safety-memory' });

interface ContrastiveCell {
  id: string;
  attackStrategy: string;
  harmfulPattern: string;
  benignCounterpart: string;
  harmfulDescription: string;
  benignDescription: string;
  createdAt: Date;
  hitCount: number;
  lastUsed: Date | null;
}

interface SafetyCheckResult {
  id: string;
  input: string;
  decision: 'allow' | 'block' | 'uncertain';
  matchedCellId: string | null;
  matchedStrategy: string | null;
  confidence: number;
  reasoning: string;
  createdAt: Date;
}

interface SafetyMemoryStats {
  totalCells: number;
  totalChecks: number;
  blockedCount: number;
  allowedCount: number;
  uncertainCount: number;
  blockRate: number;
  byStrategy: Array<{ strategy: string; count: number }>;
  avgConfidence: number;
  crossAttackTransferRate: number;
}

export class SelfEvolvingSafetyMemory {
  private cells: Map<string, ContrastiveCell> = new Map();
  private checks: SafetyCheckResult[] = [];
  private maxChecks = 500;
  private strategyIndex: Map<string, Set<string>> = new Map();

  addCell(cell: {
    attackStrategy: string;
    harmfulPattern: string;
    benignCounterpart: string;
    harmfulDescription: string;
    benignDescription: string;
  }): ContrastiveCell {
    const id = randomUUID().slice(0, 8);
    const contrastiveCell: ContrastiveCell = {
      id,
      attackStrategy: cell.attackStrategy,
      harmfulPattern: cell.harmfulPattern.toLowerCase(),
      benignCounterpart: cell.benignCounterpart.toLowerCase(),
      harmfulDescription: cell.harmfulDescription,
      benignDescription: cell.benignDescription,
      createdAt: new Date(),
      hitCount: 0,
      lastUsed: null,
    };

    this.cells.set(id, contrastiveCell);
    safetyRepo.insert({
      id: contrastiveCell.id,
      category: 'contrastive_cell',
      content: `${contrastiveCell.attackStrategy}: ${contrastiveCell.harmfulPattern}`,
      severity: 'high',
      source: 'safety_memory',
      createdAt: contrastiveCell.createdAt,
      updatedAt: contrastiveCell.createdAt,
    }).catch((err) => log.warn({ err, id }, 'failed to persist safety cell'));

    const strategySet = this.strategyIndex.get(cell.attackStrategy) ?? new Set();
    strategySet.add(id);
    this.strategyIndex.set(cell.attackStrategy, strategySet);

    incCounter('safety_cell_added', 'Safety memory cells added', 1);
    log.info({ id, strategy: cell.attackStrategy }, 'contrastive cell added');
    return contrastiveCell;
  }

  check(input: string): SafetyCheckResult {
    const checkId = randomUUID().slice(0, 8);
    const inputLower = input.toLowerCase();
    let bestMatch: ContrastiveCell | null = null;
    let bestScore = 0;
    let isBenignMatch = false;

    for (const cell of this.cells.values()) {
      const harmfulScore = this.similarityScore(inputLower, cell.harmfulPattern);
      const benignScore = this.similarityScore(inputLower, cell.benignCounterpart);

      if (harmfulScore > bestScore && harmfulScore > benignScore) {
        bestMatch = cell;
        bestScore = harmfulScore;
        isBenignMatch = false;
      } else if (benignScore > bestScore && benignScore > harmfulScore) {
        bestMatch = cell;
        bestScore = benignScore;
        isBenignMatch = true;
      }
    }

    let decision: 'allow' | 'block' | 'uncertain' = 'uncertain';
    let confidence = 0;
    let reasoning = 'No matching cells found';

    if (bestMatch) {
      if (isBenignMatch) {
        decision = 'allow';
        confidence = Math.min(0.95, bestScore + 0.1);
        reasoning = `Input matches benign counterpart of "${bestMatch.attackStrategy}" strategy. Safe to proceed.`;
      } else {
        decision = bestScore > 0.7 ? 'block' : 'uncertain';
        confidence = bestScore;
        reasoning = bestScore > 0.7
          ? `Input matches harmful pattern of "${bestMatch.attackStrategy}" strategy. Blocked.`
          : `Input partially matches harmful pattern. Manual review recommended.`;
      }

      bestMatch.hitCount++;
      bestMatch.lastUsed = new Date();
    }

    const result: SafetyCheckResult = {
      id: checkId,
      input,
      decision,
      matchedCellId: bestMatch?.id ?? null,
      matchedStrategy: bestMatch?.attackStrategy ?? null,
      confidence,
      reasoning,
      createdAt: new Date(),
    };

    this.checks.push(result);
    if (this.checks.length > this.maxChecks) {
      this.checks = this.checks.slice(-this.maxChecks);
    }

    incCounter('safety_check', 'Safety memory checks', 1, { decision });
    return result;
  }

  evolve(harmfulInteraction: string, benignCounterpart: string, strategy: string): ContrastiveCell {
    return this.addCell({
      attackStrategy: strategy,
      harmfulPattern: harmfulInteraction,
      benignCounterpart,
      harmfulDescription: `Harmful input using ${strategy} strategy`,
      benignDescription: `Benign request that superficially resembles the ${strategy} attack`,
    });
  }

  getCell(id: string): ContrastiveCell | null {
    return this.cells.get(id) ?? null;
  }

  getAllCells(): ContrastiveCell[] {
    return Array.from(this.cells.values());
  }

  getCellsByStrategy(strategy: string): ContrastiveCell[] {
    const ids = this.strategyIndex.get(strategy);
    if (!ids) return [];
    return Array.from(ids).map((id) => this.cells.get(id)).filter(Boolean) as ContrastiveCell[];
  }

  getChecks(filter?: { decision?: string }): SafetyCheckResult[] {
    if (filter?.decision) return this.checks.filter((c) => c.decision === filter.decision);
    return this.checks;
  }

  stats(): SafetyMemoryStats {
    const total = this.checks.length;
    const blocked = this.checks.filter((c) => c.decision === 'block').length;
    const allowed = this.checks.filter((c) => c.decision === 'allow').length;
    const uncertain = this.checks.filter((c) => c.decision === 'uncertain').length;

    const byStrategyMap = new Map<string, number>();
    for (const cell of this.cells.values()) {
      byStrategyMap.set(cell.attackStrategy, (byStrategyMap.get(cell.attackStrategy) ?? 0) + cell.hitCount);
    }

    const crossTransferred = Array.from(this.cells.values()).filter(
      (c) => c.hitCount > 0 && c.attackStrategy !== 'direct',
    ).length;
    const totalStrategies = this.strategyIndex.size;

    return {
      totalCells: this.cells.size,
      totalChecks: total,
      blockedCount: blocked,
      allowedCount: allowed,
      uncertainCount: uncertain,
      blockRate: total > 0 ? Math.round((blocked / total) * 100) : 0,
      byStrategy: Array.from(byStrategyMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([strategy, count]) => ({ strategy, count })),
      avgConfidence: total > 0
        ? Math.round((this.checks.reduce((s, c) => s + c.confidence, 0) / total) * 100) / 100
        : 0,
      crossAttackTransferRate: totalStrategies > 0
        ? Math.round((crossTransferred / this.cells.size) * 100)
        : 0,
    };
  }

  clear(): void {
    this.checks = [];
  }

  private similarityScore(a: string, b: string): number {
    if (!a || !b) return 0;
    const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 2));
    const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 2));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    let common = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) common++;
    }

    const jaccard = common / (wordsA.size + wordsB.size - common);
    const substringBonus = a.includes(b) || b.includes(a) ? 0.2 : 0;

    return Math.min(1, jaccard + substringBonus);
  }
}
