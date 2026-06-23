import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID, createHash } from 'node:crypto';

const log = getLogger().child({ component: 'github-mining' });

export interface GitHubRepo {
  id: string;
  fullName: string;
  url: string;
  description: string;
  stars: number;
  language: string;
  topics: string[];
}

export interface CodePattern {
  id: string;
  repo: string;
  filePath: string;
  content: string;
  hash: string;
  valueScore: number;
  crystallized: boolean;
  language: string;
  extractedAt: Date;
}

export interface CrystallizedSkill {
  id: string;
  name: string;
  description: string;
  code: string;
  sourceRepo: string;
  valueScore: number;
  createdAt: Date;
}

const VALUE_SCORE_THRESHOLD = 0.4;
const MAX_PATTERNS = 500;

export class GitHubMiner {
  private patterns: CodePattern[] = [];
  private skills: CrystallizedSkill[] = [];
  private minedRepos: Set<string> = new Set();
  private hashSet: Set<string> = new Set();

  async searchRepositories(query: string, language?: string): Promise<GitHubRepo[]> {
    const repos: GitHubRepo[] = [];

    // Simulate GitHub API search (in production, use @octokit/rest)
    const mockRepos = [
      {
        fullName: `example/${query.replace(/\s+/g, '-')}-toolkit`,
        url: `https://github.com/example/${query.replace(/\s+/g, '-')}-toolkit`,
        description: `A toolkit for ${query}`,
        stars: 1200,
        language: language ?? 'TypeScript',
        topics: [query, 'automation', 'tools'],
      },
      {
        fullName: `open-source/${query.replace(/\s+/g, '-')}-lib`,
        url: `https://github.com/open-source/${query.replace(/\s+/g, '-')}-lib`,
        description: `Library for ${query}`,
        stars: 850,
        language: language ?? 'TypeScript',
        topics: [query, 'library'],
      },
    ];

    for (const r of mockRepos) {
      repos.push({
        id: randomUUID(),
        fullName: r.fullName,
        url: r.url,
        description: r.description,
        stars: r.stars,
        language: r.language,
        topics: r.topics,
      });
    }

    incCounter('github_repos_searched', 'GitHub repos searched', repos.length);
    return repos;
  }

  async cloneAndExtract(repo: GitHubRepo): Promise<CodePattern[]> {
    if (this.minedRepos.has(repo.fullName)) {
      log.info({ repo: repo.fullName }, 'repo already mined — skipping');
      return [];
    }

    this.minedRepos.add(repo.fullName);
    const extracted: CodePattern[] = [];

    // Simulate cloning and extracting patterns
    const mockFiles = [
      { path: 'src/index.ts', content: `export function handle${repo.language}(input: string): string { return input.trim(); }` },
      { path: 'src/utils.ts', content: `export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T { let timer: any; return ((...args: any[]) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); }) as T; }` },
    ];

    for (const file of mockFiles) {
      const hash = createHash('sha256').update(file.content).digest('hex');

      if (this.hashSet.has(hash)) {
        log.debug({ hash: hash.slice(0, 8) }, 'duplicate pattern — skipping');
        continue;
      }

      this.hashSet.add(hash);
      const valueScore = this.calculateValueScore(file.content, repo.stars);

      const pattern: CodePattern = {
        id: randomUUID(),
        repo: repo.fullName,
        filePath: file.path,
        content: file.content,
        hash,
        valueScore,
        crystallized: false,
        language: repo.language,
        extractedAt: new Date(),
      };

      extracted.push(pattern);
      this.patterns.push(pattern);

      if (pattern.valueScore > VALUE_SCORE_THRESHOLD) {
        this.crystallizePattern(pattern);
      }
    }

    if (this.patterns.length > MAX_PATTERNS) {
      this.patterns = this.patterns.slice(-MAX_PATTERNS);
    }

    incCounter('github_patterns_extracted', 'GitHub patterns extracted', extracted.length);
    log.info({ repo: repo.fullName, extracted: extracted.length }, 'patterns extracted');
    return extracted;
  }

  crystallizePattern(pattern: CodePattern): CrystallizedSkill | null {
    if (pattern.valueScore < VALUE_SCORE_THRESHOLD) {
      log.debug({ valueScore: pattern.valueScore }, 'pattern below threshold — not crystallizing');
      return null;
    }

    const skill: CrystallizedSkill = {
      id: randomUUID(),
      name: this.extractName(pattern.content),
      description: `Crystallized from ${pattern.repo}/${pattern.filePath}`,
      code: pattern.content,
      sourceRepo: pattern.repo,
      valueScore: pattern.valueScore,
      createdAt: new Date(),
    };

    pattern.crystallized = true;
    this.skills.push(skill);
    incCounter('github_skills_crystallized', 'Skills crystallized from GitHub', 1);
    log.info({ skill: skill.name, repo: pattern.repo, valueScore: pattern.valueScore }, 'pattern crystallized into skill');
    return skill;
  }

  getPatterns(): CodePattern[] {
    return [...this.patterns];
  }

  getSkills(): CrystallizedSkill[] {
    return [...this.skills];
  }

  getMinedRepos(): string[] {
    return [...this.minedRepos];
  }

  getStats(): { totalRepos: number; totalPatterns: number; crystallizedSkills: number; avgValueScore: number } {
    const avgScore = this.patterns.length > 0
      ? this.patterns.reduce((s, p) => s + p.valueScore, 0) / this.patterns.length
      : 0;

    return {
      totalRepos: this.minedRepos.size,
      totalPatterns: this.patterns.length,
      crystallizedSkills: this.skills.length,
      avgValueScore: avgScore,
    };
  }

  reset(): void {
    this.patterns = [];
    this.skills = [];
    this.minedRepos.clear();
    this.hashSet.clear();
  }

  private calculateValueScore(content: string, repoStars: number): number {
    let score = 0;

    // Length factor (not too short, not too long)
    if (content.length > 50 && content.length < 2000) score += 0.2;

    // Export factor (reusable)
    if (content.includes('export ')) score += 0.2;

    // Type safety factor
    if (content.includes(': string') || content.includes(': number') || content.includes(': boolean')) score += 0.15;

    // Function complexity
    const fnCount = (content.match(/function |=> /g) || []).length;
    if (fnCount > 0 && fnCount < 5) score += 0.15;

    // Repo popularity factor
    if (repoStars > 500) score += 0.15;
    if (repoStars > 1000) score += 0.1;

    return Math.min(1, score);
  }

  private extractName(content: string): string {
    const match = content.match(/export\s+(?:async\s+)?function\s+(\w+)/);
    if (match) return match[1];

    const constMatch = content.match(/export\s+const\s+(\w+)/);
    if (constMatch) return constMatch[1];

    return `pattern-${randomUUID().slice(0, 8)}`;
  }
}
