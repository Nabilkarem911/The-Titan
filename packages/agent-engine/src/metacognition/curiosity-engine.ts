import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { curiosityExplorations as ceRepo, synthesizedSkills as ssRepo, curiosityKnowledgeGaps as ckgRepo } from '@titan/database';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'curiosity-engine' });

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  proficiency: number; // 0-100
  timesUsed: number;
  learnedAt: Date;
  lastUsedAt?: Date;
  knowledge: string;
}

interface ExplorationTask {
  id: string;
  topic: string;
  reason: string;
  questions: string[];
  status: 'pending' | 'exploring' | 'learned' | 'failed';
  findings?: string;
  skillId?: string;
  startedAt: Date;
  completedAt?: Date;
}

interface CuriosityStats {
  totalSkills: number;
  totalExplorations: number;
  successfulExplorations: number;
  avgProficiency: number;
  topSkills: Array<{ name: string; proficiency: number; timesUsed: number }>;
  isRunning: boolean;
  isExploring: boolean;
}

const CURIOSITY_PROMPT = `You are a curiosity-driven exploration agent. Given the agent's current knowledge gaps, identify an interesting topic to explore.

The best topics are:
1. High uncertainty — things the agent doesn't know well
2. High potential value — skills that could be useful for future tasks
3. Related to recent failures — areas where the agent struggled

Respond in JSON:
{
  "topic": "the topic to explore",
  "reason": "why this is interesting",
  "questions": ["question1", "question2", "question3"],
  "category": "tool|concept|pattern|technique"
}`;

const LEARNING_PROMPT = `You are a skill acquisition agent. Given a topic and exploration questions, research and learn about it.

Synthesize your findings into a concise skill description that could be used by the agent in future tasks.

Respond in JSON:
{
  "findings": "summary of what was learned",
  "skillName": "short name for this skill",
  "skillDescription": "1-2 sentence description",
  "knowledge": "the key knowledge to retain (concise, actionable)",
  "proficiency": 0-100
}`;

export class CuriosityEngine extends EventEmitter {
  private skills = new Map<string, Skill>();
  private explorations: ExplorationTask[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private exploring = false;
  private maxExplorations = 100;
  private knowledgeGaps: string[] = [];

  constructor(
    private llm: LlmProvider,
    private intervalMs: number = 60 * 60 * 1000, // 1 hour default
  ) {
    super();
  }

  start(): void {
    if (this.timer) return;
    log.info({ intervalMs: this.intervalMs }, 'curiosity engine started');
    this.timer = setInterval(() => {
      this.exploreNext().catch((err) => log.error({ err }, 'exploration failed'));
    }, this.intervalMs);
    this.emit('started');
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      log.info('curiosity engine stopped');
      this.emit('stopped');
    }
  }

  isExploring(): boolean {
    return this.exploring;
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  recordKnowledgeGap(gap: string): void {
    this.knowledgeGaps.push(gap);
    ckgRepo.insert(gap).catch((err) => log.error({ err }, 'DB write failed'));
    if (this.knowledgeGaps.length > 50) {
      this.knowledgeGaps = this.knowledgeGaps.slice(-50);
    }
  }

  async exploreNext(): Promise<ExplorationTask | null> {
    if (this.exploring) return null;

    this.exploring = true;
    const taskId = randomUUID().slice(0, 8);
    const startedAt = new Date();

    try {
      // Identify what to explore
      const topic = await this.identifyTopic();
      if (!topic) {
        log.info('no interesting topics found — skipping exploration');
        return null;
      }

      const task: ExplorationTask = {
        id: taskId,
        topic: topic.topic,
        reason: topic.reason,
        questions: topic.questions,
        status: 'exploring',
        startedAt,
      };

      this.emit('exploration:start', task);
      log.info({ taskId, topic: topic.topic }, 'exploring topic');

      // Learn about the topic
      const learning = await this.learnTopic(topic);

      // Store as skill
      const skill: Skill = {
        id: randomUUID().slice(0, 8),
        name: learning.skillName,
        description: learning.skillDescription,
        category: topic.category ?? 'general',
        proficiency: Math.max(0, Math.min(100, learning.proficiency)),
        timesUsed: 0,
        learnedAt: new Date(),
        knowledge: learning.knowledge,
      };

      this.skills.set(skill.id, skill);
      task.status = 'learned';
      task.findings = learning.findings;
      task.skillId = skill.id;
      task.completedAt = new Date();

      this.explorations.push(task);
      if (this.explorations.length > this.maxExplorations) {
        this.explorations = this.explorations.slice(-this.maxExplorations);
      }
      ceRepo.insert(task.id, { skill_name: skill.name, domain: skill.category, status: task.status, proficiency: skill.proficiency, findings: task.findings ?? '' }).catch((err) => log.error({ err }, 'DB write failed'));
      ssRepo.insert(skill.id, { name: skill.name, description: skill.description, proficiency: skill.proficiency, verified: false, code: skill.knowledge }).catch((err) => log.error({ err }, 'DB write failed'));

      incCounter('curiosity_explored', 'Topics explored', 1);
      incCounter('curiosity_skill', 'Skills acquired', 1);

      log.info({ taskId, skill: skill.name, proficiency: skill.proficiency }, 'skill acquired');
      this.emit('exploration:complete', { task, skill });

      return task;
    } catch (err) {
      log.error({ err, taskId }, 'exploration failed');
      const failedTask: ExplorationTask = {
        id: taskId,
        topic: 'unknown',
        reason: 'exploration failed',
        questions: [],
        status: 'failed',
        startedAt,
        completedAt: new Date(),
      };
      this.explorations.push(failedTask);
      this.emit('exploration:error', { taskId, err });
      return failedTask;
    } finally {
      this.exploring = false;
    }
  }

  async exploreTopic(topic: string): Promise<ExplorationTask | null> {
    if (this.exploring) return null;
    this.exploring = true;
    const taskId = randomUUID().slice(0, 8);
    const startedAt = new Date();

    try {
      const task: ExplorationTask = {
        id: taskId,
        topic,
        reason: 'manual exploration',
        questions: [],
        status: 'exploring',
        startedAt,
      };

      const learning = await this.learnTopic({
        topic,
        reason: 'manual',
        questions: [`What is ${topic}?`, `How does ${topic} work?`],
        category: 'general',
      });

      const skill: Skill = {
        id: randomUUID().slice(0, 8),
        name: learning.skillName,
        description: learning.skillDescription,
        category: 'general',
        proficiency: Math.max(0, Math.min(100, learning.proficiency)),
        timesUsed: 0,
        learnedAt: new Date(),
        knowledge: learning.knowledge,
      };

      this.skills.set(skill.id, skill);
      task.status = 'learned';
      task.findings = learning.findings;
      task.skillId = skill.id;
      task.completedAt = new Date();

      this.explorations.push(task);
      if (this.explorations.length > this.maxExplorations) {
        this.explorations = this.explorations.slice(-this.maxExplorations);
      }
      ceRepo.insert(task.id, { skill_name: skill.name, domain: skill.category, status: task.status, proficiency: skill.proficiency, findings: task.findings ?? '' }).catch((err) => log.error({ err }, 'DB write failed'));
      ssRepo.insert(skill.id, { name: skill.name, description: skill.description, proficiency: skill.proficiency, verified: false, code: skill.knowledge }).catch((err) => log.error({ err }, 'DB write failed'));

      incCounter('curiosity_explored', 'Topics explored', 1);
      this.emit('exploration:complete', { task, skill });
      return task;
    } catch (err) {
      log.error({ err, taskId }, 'manual exploration failed');
      return null;
    } finally {
      this.exploring = false;
    }
  }

  getSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  getSkill(id: string): Skill | null {
    return this.skills.get(id) ?? null;
  }

  useSkill(id: string): void {
    const skill = this.skills.get(id);
    if (skill) {
      skill.timesUsed++;
      skill.lastUsedAt = new Date();
      // Increase proficiency slightly with use
      skill.proficiency = Math.min(100, skill.proficiency + 1);
    }
  }

  getExplorations(): ExplorationTask[] {
    return this.explorations;
  }

  stats(): CuriosityStats {
    const skills = Array.from(this.skills.values());
    const total = this.explorations.length;
    const successful = this.explorations.filter((e) => e.status === 'learned').length;
    const avgProf = skills.length > 0
      ? Math.round(skills.reduce((s, sk) => s + sk.proficiency, 0) / skills.length)
      : 0;

    return {
      totalSkills: skills.length,
      totalExplorations: total,
      successfulExplorations: successful,
      avgProficiency: avgProf,
      topSkills: skills
        .sort((a, b) => b.timesUsed - a.timesUsed)
        .slice(0, 5)
        .map((s) => ({ name: s.name, proficiency: s.proficiency, timesUsed: s.timesUsed })),
      isRunning: this.isRunning(),
      isExploring: this.exploring,
    };
  }

  clear(): void {
    this.skills.clear();
    this.explorations = [];
    this.knowledgeGaps = [];
  }

  private async identifyTopic(): Promise<{
    topic: string;
    reason: string;
    questions: string[];
    category?: string;
  } | null> {
    try {
      const response = await this.llm.complete([
        { role: 'system', content: CURIOSITY_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            knownSkills: Array.from(this.skills.values()).map((s) => s.name),
            knowledgeGaps: this.knowledgeGaps.slice(-10),
            recentExplorations: this.explorations.slice(-5).map((e) => e.topic),
          }),
        },
      ], { temperature: 0.6, maxTokens: 500 });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const raw = JSON.parse(jsonMatch[0]);
      return {
        topic: String(raw.topic ?? ''),
        reason: String(raw.reason ?? ''),
        questions: Array.isArray(raw.questions) ? raw.questions : [],
        category: raw.category ? String(raw.category) : 'general',
      };
    } catch {
      return null;
    }
  }

  private async learnTopic(topic: {
    topic: string;
    reason: string;
    questions: string[];
    category?: string;
  }): Promise<{
    findings: string;
    skillName: string;
    skillDescription: string;
    knowledge: string;
    proficiency: number;
  }> {
    try {
      const response = await this.llm.complete([
        { role: 'system', content: LEARNING_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            topic: topic.topic,
            questions: topic.questions,
            category: topic.category,
          }),
        },
      ], { temperature: 0.3, maxTokens: 600 });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('parse failed');
      const raw = JSON.parse(jsonMatch[0]);
      return {
        findings: String(raw.findings ?? ''),
        skillName: String(raw.skillName ?? topic.topic),
        skillDescription: String(raw.skillDescription ?? ''),
        knowledge: String(raw.knowledge ?? ''),
        proficiency: Math.max(0, Math.min(100, Number(raw.proficiency ?? 30))),
      };
    } catch {
      return {
        findings: 'Learning failed',
        skillName: topic.topic,
        skillDescription: `Knowledge about ${topic.topic}`,
        knowledge: '',
        proficiency: 10,
      };
    }
  }
}
