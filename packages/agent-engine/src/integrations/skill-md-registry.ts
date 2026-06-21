import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

const log = getLogger().child({ component: 'skill-md' });

export interface SkillMdFrontmatter {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, unknown>;
  allowedTools?: string[];
}

export interface SkillMd {
  id: string;
  frontmatter: SkillMdFrontmatter;
  body: string;
  filePath: string;
  scripts: SkillScript[];
  resources: string[];
  loadedAt: Date;
  sizeBytes: number;
}

export interface SkillScript {
  name: string;
  path: string;
  language: string;
  content?: string;
}

export interface SkillMatchResult {
  skill: SkillMd;
  score: number;
  matchedKeywords: string[];
}

export interface SkillMdStats {
  totalSkills: number;
  totalScripts: number;
  totalResources: number;
  byCapability: Array<{ capability: string; count: number }>;
  avgBodyLength: number;
  loadedAt: Date;
}

export class SkillMdRegistry {
  private skills: Map<string, SkillMd> = new Map();
  private skillDirs: string[] = [];

  registerDirectory(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.skillDirs.push(dir);
    this.scanDirectory(dir);
    log.info({ dir, count: this.skills.size }, 'skill directory registered');
  }

  private scanDirectory(dir: string): void {
    if (!existsSync(dir)) return;

    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        const skillMdPath = join(fullPath, 'SKILL.md');
        if (existsSync(skillMdPath)) {
          this.loadSkillFile(skillMdPath);
        }
      } else if (entry === 'SKILL.md') {
        this.loadSkillFile(fullPath);
      } else if (entry.endsWith('.md') && entry !== 'SKILL.md') {
        this.loadSkillFile(fullPath);
      }
    }
  }

  loadSkillFile(filePath: string): SkillMd | null {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const { frontmatter, body } = this.parseSkillMd(content);
      const skillDir = dirname(filePath);
      const scripts = this.loadScripts(skillDir);
      const resources = this.loadResources(skillDir);
      const stat = statSync(filePath);

      const skill: SkillMd = {
        id: frontmatter.name,
        frontmatter,
        body,
        filePath,
        scripts,
        resources,
        loadedAt: new Date(),
        sizeBytes: stat.size,
      };

      this.skills.set(frontmatter.name, skill);
      incCounter('skill_md_loaded', 'SKILL.md files loaded', 1);
      log.info({ name: frontmatter.name, filePath, scripts: scripts.length }, 'skill loaded');
      return skill;
    } catch (err) {
      log.error({ err, filePath }, 'failed to load skill file');
      return null;
    }
  }

  private parseSkillMd(content: string): { frontmatter: SkillMdFrontmatter; body: string } {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!frontmatterMatch) {
      return {
        frontmatter: {
          name: basename(content.slice(0, 50).trim().replace(/\s+/g, '-').toLowerCase()) || 'unnamed',
          description: content.slice(0, 200).trim(),
        },
        body: content,
      };
    }

    const yamlText = frontmatterMatch[1];
    const body = frontmatterMatch[2];
    const frontmatter = this.parseYamlFrontmatter(yamlText);

    return { frontmatter, body };
  }

  private parseYamlFrontmatter(yaml: string): SkillMdFrontmatter {
    const lines = yaml.split('\n');
    const result: Record<string, unknown> = {};
    let currentKey = '';
    let inMetadata = false;
    let metadataObj: Record<string, unknown> = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      if (line.startsWith('  ') && currentKey) {
        if (inMetadata) {
          const metaMatch = trimmed.match(/^(\w+):\s*(.*)$/);
          if (metaMatch) {
            metadataObj[metaMatch[1]] = this.parseValue(metaMatch[2]);
          }
        }
        continue;
      }

      const match = trimmed.match(/^(\w+):\s*(.*)$/);
      if (match) {
        const key = match[1];
        const value = match[2];

        if (key === 'metadata') {
          inMetadata = true;
          currentKey = 'metadata';
          metadataObj = {};
          continue;
        }

        inMetadata = false;
        currentKey = key;

        if (key === 'allowed-tools' || key === 'allowedTools') {
          result.allowedTools = value.split(/\s+/).filter(Boolean);
        } else if (key === 'capabilities' || key === 'tags') {
          result[key] = value.split(/\s+/).filter(Boolean);
        } else {
          result[key] = this.parseValue(value);
        }
      }
    }

    if (Object.keys(metadataObj).length > 0) {
      result.metadata = metadataObj;
    }

    const name = String(result.name ?? 'unnamed-skill');
    const description = String(result.description ?? '');

    return {
      name,
      description,
      license: result.license ? String(result.license) : undefined,
      compatibility: result.compatibility ? String(result.compatibility) : undefined,
      metadata: result.metadata as Record<string, unknown> | undefined,
      allowedTools: result.allowedTools as string[] | undefined,
    };
  }

  private parseValue(value: string): unknown {
    const clean = value.replace(/^["']|["']$/g, '').trim();
    if (clean === 'true') return true;
    if (clean === 'false') return false;
    if (clean === 'null' || clean === '') return null;
    if (/^\d+$/.test(clean)) return parseInt(clean, 10);
    if (/^\d+\.\d+$/.test(clean)) return parseFloat(clean);
    return clean;
  }

  private loadScripts(skillDir: string): SkillScript[] {
    const scriptsDir = join(skillDir, 'scripts');
    if (!existsSync(scriptsDir)) return [];

    const scripts: SkillScript[] = [];
    const entries = readdirSync(scriptsDir);
    for (const entry of entries) {
      const fullPath = join(scriptsDir, entry);
      const stat = statSync(fullPath);
      if (stat.isFile()) {
        const ext = entry.split('.').pop() ?? '';
        const languageMap: Record<string, string> = {
          sh: 'bash', py: 'python', js: 'javascript', ts: 'typescript', rb: 'ruby', go: 'go',
        };
        scripts.push({
          name: entry,
          path: fullPath,
          language: languageMap[ext] ?? 'text',
        });
      }
    }
    return scripts;
  }

  private loadResources(skillDir: string): string[] {
    const resourcesDir = join(skillDir, 'resources');
    if (!existsSync(resourcesDir)) return [];

    const resources: string[] = [];
    const entries = readdirSync(resourcesDir);
    for (const entry of entries) {
      const fullPath = join(resourcesDir, entry);
      const stat = statSync(fullPath);
      if (stat.isFile()) {
        resources.push(fullPath);
      }
    }
    return resources;
  }

  getSkill(name: string): SkillMd | null {
    return this.skills.get(name) ?? null;
  }

  getAllSkills(): SkillMd[] {
    return Array.from(this.skills.values());
  }

  matchSkills(taskDescription: string, topK: number = 5): SkillMatchResult[] {
    const taskLower = taskDescription.toLowerCase();
    const results: SkillMatchResult[] = [];

    for (const skill of this.skills.values()) {
      const descLower = skill.frontmatter.description.toLowerCase();
      const nameLower = skill.frontmatter.name.toLowerCase();
      const keywords = descLower.split(/\s+/).filter((w) => w.length > 3);
      const matchedKeywords: string[] = [];
      let score = 0;

      if (taskLower.includes(nameLower) || nameLower.includes(taskLower.slice(0, 20).toLowerCase())) {
        score += 30;
      }

      for (const kw of keywords) {
        if (taskLower.includes(kw)) {
          score += 5;
          matchedKeywords.push(kw);
        }
      }

      if (score > 0) {
        results.push({ skill, score, matchedKeywords });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  createSkill(dir: string, frontmatter: SkillMdFrontmatter, body: string): SkillMd {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const filePath = join(dir, 'SKILL.md');
    const content = this.serializeSkillMd(frontmatter, body);
    writeFileSync(filePath, content, 'utf-8');

    const skill = this.loadSkillFile(filePath);
    if (!skill) throw new Error('Failed to load created skill');
    return skill;
  }

  private serializeSkillMd(frontmatter: SkillMdFrontmatter, body: string): string {
    const lines: string[] = ['---'];
    lines.push(`name: ${frontmatter.name}`);
    lines.push(`description: ${frontmatter.description}`);
    if (frontmatter.license) lines.push(`license: ${frontmatter.license}`);
    if (frontmatter.compatibility) lines.push(`compatibility: ${frontmatter.compatibility}`);
    if (frontmatter.allowedTools && frontmatter.allowedTools.length > 0) {
      lines.push(`allowed-tools: ${frontmatter.allowedTools.join(' ')}`);
    }
    if (frontmatter.metadata) {
      lines.push('metadata:');
      for (const [key, value] of Object.entries(frontmatter.metadata)) {
        lines.push(`  ${key}: ${String(value)}`);
      }
    }
    lines.push('---');
    lines.push('');
    lines.push(body);
    return lines.join('\n');
  }

  removeSkill(name: string): boolean {
    return this.skills.delete(name);
  }

  reload(): void {
    this.skills.clear();
    for (const dir of this.skillDirs) {
      this.scanDirectory(dir);
    }
    log.info({ count: this.skills.size }, 'skills reloaded');
  }

  stats(): SkillMdStats {
    const skills = Array.from(this.skills.values());
    const capabilityMap = new Map<string, number>();

    for (const skill of skills) {
      const tags = skill.frontmatter.metadata?.tags;
      if (Array.isArray(tags)) {
        for (const tag of tags) {
          const tagStr = String(tag);
          capabilityMap.set(tagStr, (capabilityMap.get(tagStr) ?? 0) + 1);
        }
      }
    }

    return {
      totalSkills: skills.length,
      totalScripts: skills.reduce((s, sk) => s + sk.scripts.length, 0),
      totalResources: skills.reduce((s, sk) => s + sk.resources.length, 0),
      byCapability: Array.from(capabilityMap.entries()).map(([capability, count]) => ({ capability, count })),
      avgBodyLength: skills.length > 0
        ? Math.round(skills.reduce((s, sk) => s + sk.body.length, 0) / skills.length)
        : 0,
      loadedAt: new Date(),
    };
  }
}
