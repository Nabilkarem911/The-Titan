import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';

const log = getLogger().child({ component: 'autonomous-gardener' });

export interface TasteProfile {
  preferences: Record<string, number>;
  aestheticScore: number;
  evolutionCount: number;
}

export interface CreativeSeed {
  id: string;
  type: 'image' | 'music' | 'code' | 'text';
  content: string;
  style: string;
  emergenceScore: number;
  plantedAt: Date;
}

export interface GardenHarvest {
  id: string;
  seeds: CreativeSeed[];
  bestEmergence: number;
  tasteUpdate: Partial<TasteProfile>;
  harvestedAt: Date;
}

const MAX_SEEDS = 100;
const MIN_EMERGENCE_SCORE = 0.3;
const HARVEST_INTERVAL_MS = 30 * 60 * 1000;

export class AutonomousGardener {
  private seeds: CreativeSeed[] = [];
  private taste: TasteProfile;
  private harvests: GardenHarvest[] = [];
  private running = false;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.taste = {
      preferences: {},
      aestheticScore: 0.5,
      evolutionCount: 0,
    };
  }

  start(generateSeed: () => CreativeSeed): void {
    if (this.running) return;
    this.running = true;

    this.intervalHandle = setInterval(() => {
      this.plant(generateSeed());
    }, HARVEST_INTERVAL_MS);

    log.info('autonomous gardener started');
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.running = false;
    log.info('autonomous gardener stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  plant(seed: CreativeSeed): void {
    if (this.seeds.length >= MAX_SEEDS) {
      this.seeds.shift();
    }

    this.seeds.push(seed);
    this.taste.evolutionCount++;

    // Update taste preferences based on seed style
    const styleKey = seed.style;
    const currentPref = this.taste.preferences[styleKey] ?? 0.5;
    this.taste.preferences[styleKey] = (currentPref + seed.emergenceScore) / 2;

    // Evolve aesthetic score
    this.taste.aestheticScore = this.taste.aestheticScore * 0.95 + seed.emergenceScore * 0.05;

    incCounter('garden_seeds_planted', 'Seeds planted', 1);
    log.info({ type: seed.type, style: seed.style, emergence: seed.emergenceScore }, 'seed planted');
  }

  harvest(): GardenHarvest {
    const viableSeeds = this.seeds.filter((s) => s.emergenceScore >= MIN_EMERGENCE_SCORE);
    const bestEmergence = viableSeeds.length > 0
      ? Math.max(...viableSeeds.map((s) => s.emergenceScore))
      : 0;

    // Determine taste update from harvest
    const styleCounts: Record<string, number> = {};
    for (const seed of viableSeeds) {
      styleCounts[seed.style] = (styleCounts[seed.style] ?? 0) + 1;
    }

    const tasteUpdate: Partial<TasteProfile> = {
      preferences: {},
    };
    for (const [style, count] of Object.entries(styleCounts)) {
      tasteUpdate.preferences![style] = count / viableSeeds.length;
    }

    const harvest: GardenHarvest = {
      id: randomUUID(),
      seeds: viableSeeds,
      bestEmergence,
      tasteUpdate,
      harvestedAt: new Date(),
    };

    this.harvests.push(harvest);
    this.seeds = this.seeds.filter((s) => s.emergenceScore < MIN_EMERGENCE_SCORE);

    incCounter('garden_harvests', 'Garden harvests', 1);
    log.info({ seeds: viableSeeds.length, bestEmergence }, 'garden harvested');
    return harvest;
  }

  getTasteProfile(): TasteProfile {
    return { ...this.taste, preferences: { ...this.taste.preferences } };
  }

  getSeeds(): CreativeSeed[] {
    return [...this.seeds];
  }

  getHarvests(): GardenHarvest[] {
    return [...this.harvests];
  }

  getStats(): {
    totalSeeds: number;
    totalHarvests: number;
    aestheticScore: number;
    evolutionCount: number;
    topStyles: string[];
    isRunning: boolean;
  } {
    const styleScores = Object.entries(this.taste.preferences)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([style]) => style);

    return {
      totalSeeds: this.seeds.length,
      totalHarvests: this.harvests.length,
      aestheticScore: this.taste.aestheticScore,
      evolutionCount: this.taste.evolutionCount,
      topStyles: styleScores,
      isRunning: this.running,
    };
  }

  reset(): void {
    this.stop();
    this.seeds = [];
    this.harvests = [];
    this.taste = { preferences: {}, aestheticScore: 0.5, evolutionCount: 0 };
  }
}
