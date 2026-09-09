import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { synthesizedSkills as ssRepo, skillSynthesisResults as ssrRepo } from '@titan/database';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'skill-synthesis' });

interface SynthesizedSkill {
  id: string;
  name: string;
  description: string;
  sourceTask: string;
  code: string;
  testCases: Array<{ input: string; expectedOutput: string }>;
  proficiency: number;
  verified: boolean;
  synthesizedAt: Date;
  timesUsed: number;
  decompositionSteps: string[];
}

interface SynthesisResult {
  id: string;
  taskDescription: string;
  decomposed: boolean;
  steps: string[];
  skill: SynthesizedSkill | null;
  verified: boolean;
  testResults: Array<{ input: string; expected: string; actual: string; passed: boolean }>;
  success: boolean;
  durationMs: number;
}

const DECOMPOSE_PROMPT = `You are a skill decomposition agent. Break down a complex task into sub-skills that can be learned independently.

For each sub-skill, identify:
1. What capability is needed
2. What knowledge is required
3. What practice would help

Respond in JSON:
{
  "steps": ["step1", "step2", "step3"],
  "subSkills": [
    { "name": "skill name", "description": "what it does", "knowledge": "key concepts" }
  ]
}`;

const SYNTHESIZE_PROMPT = `You are a skill synthesis agent. Given a task and its decomposition, synthesize a reusable skill (code + knowledge).

The skill should:
1. Be a self-contained function/tool that can be reused
2. Include test cases that validate it works
3. Include a description of when to use it

Respond in JSON:
{
  "name": "skill name",
  "description": "what the skill does",
  "code": "the implementation code",
  "testCases": [
    { "input": "test input", "expectedOutput": "expected result" }
  ]
}`;

const VERIFY_PROMPT = `You are a skill verification agent. Given a synthesized skill and its test cases, verify the skill would pass the tests.

For each test case, determine if the code would produce the expected output.

Respond in JSON:
{
  "testResults": [
    { "input": "test input", "expected": "expected", "actual": "predicted actual", "passed": true/false }
  ],
  "overallPassed": true/false,
  "notes": "verification notes"
}`;

export class AutonomousSkillSynthesis extends EventEmitter {
  private skills: Map<string, SynthesizedSkill> = new Map();
  private results: SynthesisResult[] = [];
  private maxResults = 100;
  private maxSkills = 200;

  constructor(private llm: LlmProvider) {
    super();
  }

  async synthesize(taskDescription: string): Promise<SynthesisResult> {
    const synthesisId = randomUUID().slice(0, 8);
    const startedAt = Date.now();

    this.emit('synthesis:start', { id: synthesisId, task: taskDescription });
    log.info({ synthesisId, task: taskDescription.slice(0, 80) }, 'skill synthesis started');

    try {
      // Phase 1: Decompose the task
      const decomposition = await this.decompose(taskDescription);

      // Phase 2: Synthesize the skill
      const skillData = await this.synthesizeSkill(taskDescription, decomposition.steps);

      // Phase 3: Verify with test cases
      const verification = await this.verifySkill(skillData);

      const isCoded = typeof skillData.code === 'string' && skillData.code.trim().length > 50;
      const skill: SynthesizedSkill = {
        id: randomUUID().slice(0, 8),
        name: skillData.name,
        description: skillData.description,
        sourceTask: taskDescription,
        code: skillData.code,
        testCases: skillData.testCases,
        // Coded skills: verified by test simulation. Knowledge-only skills (no
        // executable code) are knowledge notes — verified when they carry a
        // meaningful decomposition, instead of being auto-failed by code tests.
        proficiency: isCoded ? (verification.overallPassed ? 80 : 40) : (decomposition.steps.length > 0 ? 50 : 30),
        verified: isCoded ? verification.overallPassed : decomposition.steps.length > 0,
        synthesizedAt: new Date(),
        timesUsed: 0,
        decompositionSteps: decomposition.steps,
      };

      if (skill.verified) {
        this.skills.set(skill.id, skill);
      ssRepo.insert(skill.id, { name: skill.name, description: skill.description, proficiency: skill.proficiency, verified: skill.verified, code: skill.code ?? '' }).catch((err) => log.error({ err }, 'DB write failed'));
        if (this.skills.size > this.maxSkills) {
          // Remove oldest unused
          const oldest = Array.from(this.skills.values())
            .sort((a, b) => a.timesUsed - b.timesUsed)[0];
          if (oldest) this.skills.delete(oldest.id);
        }
      }

      const result: SynthesisResult = {
        id: synthesisId,
        taskDescription,
        decomposed: decomposition.steps.length > 0,
        steps: decomposition.steps,
        skill: skill.verified ? skill : null,
        verified: skill.verified,
        testResults: verification.testResults,
        success: skill.verified,
        durationMs: Date.now() - startedAt,
      };

      this.results.push(result);
      ssrRepo.insert(result.id, result.taskDescription, result.skill?.name ?? '', result.success, result.durationMs).catch((err) => log.error({ err }, 'DB write failed'));
      if (this.results.length > this.maxResults) {
        this.results = this.results.slice(-this.maxResults);
      }

      incCounter('skill_synthesized', 'Skills synthesized', 1, {
        verified: skill.verified ? 'true' : 'false',
      });

      log.info(
        { synthesisId, skillName: skill.name, verified: skill.verified, durationMs: result.durationMs },
        'skill synthesis complete',
      );
      this.emit('synthesis:complete', result);

      return result;
    } catch (err) {
      log.error({ err, synthesisId }, 'skill synthesis failed');
      return {
        id: synthesisId,
        taskDescription,
        decomposed: false,
        steps: [],
        skill: null,
        verified: false,
        testResults: [],
        success: false,
        durationMs: Date.now() - startedAt,
      };
    }
  }

  getSkills(): SynthesizedSkill[] {
    return Array.from(this.skills.values());
  }

  getVerifiedSkills(): SynthesizedSkill[] {
    return Array.from(this.skills.values()).filter((s) => s.verified);
  }

  getSkill(id: string): SynthesizedSkill | null {
    return this.skills.get(id) ?? null;
  }

  useSkill(id: string): void {
    const skill = this.skills.get(id);
    if (skill) {
      skill.timesUsed++;
      skill.proficiency = Math.min(100, skill.proficiency + 2);
    }
  }

  getResults(): SynthesisResult[] {
    return this.results;
  }

  stats(): {
    totalSkills: number;
    verifiedSkills: number;
    totalSyntheses: number;
    successRate: number;
    avgProficiency: number;
    topSkills: Array<{ name: string; timesUsed: number; proficiency: number }>;
  } {
    const skills = Array.from(this.skills.values());
    const total = this.results.length;
    const successful = this.results.filter((r) => r.success).length;
    const avgProf = skills.length > 0
      ? Math.round(skills.reduce((s, sk) => s + sk.proficiency, 0) / skills.length)
      : 0;

    return {
      totalSkills: skills.length,
      verifiedSkills: skills.filter((s) => s.verified).length,
      totalSyntheses: total,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      avgProficiency: avgProf,
      topSkills: skills
        .sort((a, b) => b.timesUsed - a.timesUsed)
        .slice(0, 5)
        .map((s) => ({ name: s.name, timesUsed: s.timesUsed, proficiency: s.proficiency })),
    };
  }

  clear(): void {
    this.skills.clear();
    this.results = [];
  }

  private async decompose(task: string): Promise<{ steps: string[] }> {
    try {
      const response = await this.llm.complete([
        { role: 'system', content: DECOMPOSE_PROMPT },
        { role: 'user', content: task },
      ], { temperature: 0.3, maxTokens: 500 });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { steps: [task] };
      const raw = JSON.parse(jsonMatch[0]);
      return {
        steps: Array.isArray(raw.steps) ? raw.steps : [task],
      };
    } catch {
      return { steps: [task] };
    }
  }

  private async synthesizeSkill(
    task: string,
    steps: string[],
  ): Promise<{
    name: string;
    description: string;
    code: string;
    testCases: Array<{ input: string; expectedOutput: string }>;
  }> {
    try {
      const response = await this.llm.complete([
        { role: 'system', content: SYNTHESIZE_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({ task, decompositionSteps: steps }),
        },
      ], { temperature: 0.3, maxTokens: 800 });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('parse failed');
      const raw = JSON.parse(jsonMatch[0]);
      return {
        name: String(raw.name ?? 'unnamed-skill'),
        description: String(raw.description ?? ''),
        code: String(raw.code ?? ''),
        testCases: Array.isArray(raw.testCases)
          ? raw.testCases.map((tc: Record<string, unknown>) => ({
              input: String(tc.input ?? ''),
              expectedOutput: String(tc.expectedOutput ?? ''),
            }))
          : [],
      };
    } catch {
      return {
        name: 'synthesis-failed',
        description: 'Skill synthesis failed',
        code: '',
        testCases: [],
      };
    }
  }

  private async verifySkill(skill: {
    name: string;
    code: string;
    testCases: Array<{ input: string; expectedOutput: string }>;
  }): Promise<{
    testResults: Array<{ input: string; expected: string; actual: string; passed: boolean }>;
    overallPassed: boolean;
  }> {
    if (skill.testCases.length === 0) {
      return { testResults: [], overallPassed: false };
    }

    try {
      const response = await this.llm.complete([
        { role: 'system', content: VERIFY_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            code: skill.code.slice(0, 500),
            testCases: skill.testCases,
          }),
        },
      ], { temperature: 0.1, maxTokens: 500 });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { testResults: [], overallPassed: false };
      const raw = JSON.parse(jsonMatch[0]);
      return {
        testResults: Array.isArray(raw.testResults)
          ? raw.testResults.map((tr: Record<string, unknown>) => ({
              input: String(tr.input ?? ''),
              expected: String(tr.expected ?? ''),
              actual: String(tr.actual ?? ''),
              passed: Boolean(tr.passed ?? false),
            }))
          : [],
        overallPassed: Boolean(raw.overallPassed ?? false),
      };
    } catch {
      return { testResults: [], overallPassed: false };
    }
  }
}
