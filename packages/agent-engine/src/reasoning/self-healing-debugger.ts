import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { selfHealingLessons as lessonsRepo, selfHealingAttempts as attemptsRepo } from '@titan/database';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'self-healing-debugger' });

export interface BugReport {
  id: string;
  filePath: string;
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  context?: string;
  reportedAt: Date;
}

interface Lesson {
  id: string;
  errorType: string;
  errorMessage: string;
  failedFix: string;
  successfulFix?: string;
  learnedAt: Date;
  timesApplied: number;
}

interface RepairAttempt {
  id: string;
  bugId: string;
  attempt: number;
  fixDescription: string;
  fixCode?: string;
  success: boolean;
  error?: string;
  timestamp: Date;
}

interface DebugResult {
  bugId: string;
  diagnosed: boolean;
  rootCause?: string;
  repairApplied: boolean;
  repairDescription?: string;
  attempts: RepairAttempt[];
  lessonsLearned: Lesson[];
  success: boolean;
  finalStatus: 'fixed' | 'unfixed' | 'needs-human';
}

const INSTRUMENT_PROMPT = `You are an instrumentation agent. Given a bug report, determine what diagnostic information to collect.

Identify:
1. What logs/traces to examine
2. What runtime probes to insert
3. What test cases to run

Respond in JSON:
{
  "diagnostics": ["check log file X", "run test Y", "inspect variable Z"],
  "probes": ["insert console.log at line N in file F"]
}`;

const ANALYSIS_PROMPT = `You are a debugging analysis agent. Given diagnostic information and a bug report, perform causal reasoning to find the root cause.

Consider:
1. What is the actual error vs symptom?
2. Which line/function is the root cause?
3. What historical lessons apply? (avoid past failed fixes)

Respond in JSON:
{
  "rootCause": "The root cause description",
  "affectedFile": "file path",
  "affectedLine": "line number (if known)",
  "fixPlan": "Description of the fix",
  "fixCode": "The actual code fix (if applicable)",
  "confidence": 0-100,
  "needsHuman": true/false
}`;

const REPAIR_PROMPT = `You are a repair agent. Given a bug and a fix plan, generate the concrete code fix.

Rules:
1. The fix must be minimal — change only what's needed
2. The fix must not break existing functionality
3. Include a rollback plan if the fix fails

Respond in JSON:
{
  "fixDescription": "What the fix does",
  "fixCode": "The code to apply",
  "rollbackPlan": "How to revert if this fails"
}`;

export class SelfHealingDebugger {
  private lessons: Lesson[] = [];
  private attempts: RepairAttempt[] = [];
  private maxLessons = 200;
  private maxAttempts = 500;
  private maxRepairAttempts = 3;

  constructor(private llm: LlmProvider) {}

  async debug(bug: BugReport): Promise<DebugResult> {
    log.info({ bugId: bug.id, errorType: bug.errorType }, 'starting debug session');
    incCounter('debug_session', 'Debug sessions started', 1);

    const attempts: RepairAttempt[] = [];
    const lessonsLearned: Lesson[] = [];

    try {
      // Phase 1: Instrumentation — gather diagnostics
      const diagnostics = await this.instrument(bug);

      // Phase 2: Analysis — find root cause
      const analysis = await this.analyze(bug, diagnostics);

      if (!analysis.rootCause) {
        log.warn({ bugId: bug.id }, 'could not diagnose bug');
        return {
          bugId: bug.id,
          diagnosed: false,
          repairApplied: false,
          attempts,
          lessonsLearned,
          success: false,
          finalStatus: 'needs-human',
        };
      }

      // Check historical lessons — avoid past failed fixes
      const relevantLessons = this.getRelevantLessons(bug.errorType, bug.errorMessage);
      if (relevantLessons.length > 0) {
        log.info({ bugId: bug.id, lessons: relevantLessons.length }, 'found relevant historical lessons');
      }

      // Phase 3: Repair — apply fix
      for (let attemptNum = 1; attemptNum <= this.maxRepairAttempts; attemptNum++) {
        const repair = await this.repair(bug, analysis, attemptNum, relevantLessons);

        const attempt: RepairAttempt = {
          id: randomUUID().slice(0, 8),
          bugId: bug.id,
          attempt: attemptNum,
          fixDescription: repair.fixDescription,
          fixCode: repair.fixCode,
          success: repair.success,
          error: repair.error,
          timestamp: new Date(),
        };
        attempts.push(attempt);

        if (repair.success) {
          // Learn from success
          const lesson: Lesson = {
            id: randomUUID().slice(0, 8),
            errorType: bug.errorType,
            errorMessage: bug.errorMessage.slice(0, 200),
            failedFix: attempts.slice(0, -1).map((a) => a.fixDescription).join('; '),
            successfulFix: repair.fixDescription,
            learnedAt: new Date(),
            timesApplied: 0,
          };
          lessonsLearned.push(lesson);
          this.addLesson(lesson);

          incCounter('debug_fixed', 'Bugs fixed', 1);
          log.info({ bugId: bug.id, attempt: attemptNum }, 'bug fixed');

          return {
            bugId: bug.id,
            diagnosed: true,
            rootCause: analysis.rootCause,
            repairApplied: true,
            repairDescription: repair.fixDescription,
            attempts,
            lessonsLearned,
            success: true,
            finalStatus: 'fixed',
          };
        }

        // Learn from failure
        if (attemptNum === this.maxRepairAttempts) {
          const lesson: Lesson = {
            id: randomUUID().slice(0, 8),
            errorType: bug.errorType,
            errorMessage: bug.errorMessage.slice(0, 200),
            failedFix: repair.fixDescription,
            learnedAt: new Date(),
            timesApplied: 0,
          };
          lessonsLearned.push(lesson);
          this.addLesson(lesson);
        }
      }

      // All attempts failed
      incCounter('debug_unfixed', 'Bugs unfixed', 1);
      log.warn({ bugId: bug.id, attempts: attempts.length }, 'could not fix bug after all attempts');

      return {
        bugId: bug.id,
        diagnosed: true,
        rootCause: analysis.rootCause,
        repairApplied: false,
        attempts,
        lessonsLearned,
        success: false,
        finalStatus: 'needs-human',
      };
    } catch (err) {
      log.error({ err, bugId: bug.id }, 'debug session failed');
      return {
        bugId: bug.id,
        diagnosed: false,
        repairApplied: false,
        attempts,
        lessonsLearned,
        success: false,
        finalStatus: 'needs-human',
      };
    }
  }

  getLessons(): Lesson[] {
    return this.lessons;
  }

  getRelevantLessons(errorType: string, errorMessage: string): Lesson[] {
    return this.lessons.filter(
      (l) =>
        l.errorType === errorType ||
        l.errorMessage.slice(0, 50) === errorMessage.slice(0, 50),
    );
  }

  getAttempts(): RepairAttempt[] {
    return this.attempts;
  }

  stats(): { totalLessons: number; totalAttempts: number; successRate: number } {
    const total = this.attempts.length;
    const success = this.attempts.filter((a) => a.success).length;
    return {
      totalLessons: this.lessons.length,
      totalAttempts: total,
      successRate: total > 0 ? Math.round((success / total) * 100) : 0,
    };
  }

  private addLesson(lesson: Lesson): void {
    this.lessons.push(lesson);
    if (this.lessons.length > this.maxLessons) {
      this.lessons = this.lessons.slice(-this.maxLessons);
    }
    lessonsRepo.insert({
      id: lesson.id,
      bugId: lesson.id,
      errorType: lesson.errorType,
      failedFix: lesson.failedFix,
      successfulFix: lesson.successfulFix ?? '',
      lesson: lesson.errorMessage,
      successful: !!lesson.successfulFix,
      createdAt: lesson.learnedAt,
    }).catch((err) => log.warn({ err, id: lesson.id }, 'failed to persist lesson'));
  }

  private async instrument(bug: BugReport): Promise<string[]> {
    try {
      const response = await this.llm.complete([
        { role: 'system', content: INSTRUMENT_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            errorType: bug.errorType,
            errorMessage: bug.errorMessage,
            filePath: bug.filePath,
            stackTrace: bug.stackTrace?.slice(0, 500),
            context: bug.context?.slice(0, 500),
          }),
        },
      ], { temperature: 0.2, maxTokens: 500 });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return ['examine error logs'];
      const raw = JSON.parse(jsonMatch[0]);
      return Array.isArray(raw.diagnostics) ? raw.diagnostics : ['examine error logs'];
    } catch {
      return ['examine error logs'];
    }
  }

  private async analyze(
    bug: BugReport,
    diagnostics: string[],
  ): Promise<{
    rootCause: string;
    fixPlan: string;
    fixCode?: string;
    needsHuman: boolean;
  }> {
    try {
      const relevantLessons = this.getRelevantLessons(bug.errorType, bug.errorMessage);
      const response = await this.llm.complete([
        { role: 'system', content: ANALYSIS_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            errorType: bug.errorType,
            errorMessage: bug.errorMessage,
            filePath: bug.filePath,
            stackTrace: bug.stackTrace?.slice(0, 500),
            diagnostics,
            pastFailedFixes: relevantLessons
              .filter((l) => !l.successfulFix)
              .map((l) => l.failedFix)
              .slice(0, 5),
          }),
        },
      ], { temperature: 0.1, maxTokens: 800 });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { rootCause: '', fixPlan: '', needsHuman: true };
      const raw = JSON.parse(jsonMatch[0]);
      return {
        rootCause: String(raw.rootCause ?? ''),
        fixPlan: String(raw.fixPlan ?? ''),
        fixCode: raw.fixCode ? String(raw.fixCode) : undefined,
        needsHuman: Boolean(raw.needsHuman),
      };
    } catch {
      return { rootCause: '', fixPlan: '', needsHuman: true };
    }
  }

  private async repair(
    bug: BugReport,
    analysis: { rootCause: string; fixPlan: string; fixCode?: string; needsHuman: boolean },
    attemptNum: number,
    lessons: Lesson[],
  ): Promise<{ success: boolean; fixDescription: string; fixCode?: string; error?: string }> {
    if (analysis.needsHuman && attemptNum === 1) {
      return {
        success: false,
        fixDescription: 'Analysis indicates human intervention needed',
        error: 'needs-human',
      };
    }

    try {
      const response = await this.llm.complete([
        { role: 'system', content: REPAIR_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            errorType: bug.errorType,
            errorMessage: bug.errorMessage,
            rootCause: analysis.rootCause,
            fixPlan: analysis.fixPlan,
            previousFixCode: analysis.fixCode,
            attempt: attemptNum,
            avoidFixes: lessons
              .filter((l) => !l.successfulFix)
              .map((l) => l.failedFix)
              .slice(0, 3),
          }),
        },
      ], { temperature: 0.2, maxTokens: 600 });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { success: false, fixDescription: 'Parse failed', error: 'parse-error' };
      const raw = JSON.parse(jsonMatch[0]);

      const fixDescription = String(raw.fixDescription ?? '');
      const fixCode = raw.fixCode ? String(raw.fixCode) : undefined;

      let success = false;
      let appliedError: string | undefined;

      if (fixCode && bug.filePath && existsSync(bug.filePath)) {
        try {
          const originalContent = await readFile(bug.filePath, 'utf-8');
          const newContent = this.applyFix(originalContent, fixCode, analysis);

          if (newContent && newContent !== originalContent) {
            await writeFile(bug.filePath, newContent, 'utf-8');
            log.info({ bugId: bug.id, file: bug.filePath }, 'fix applied to file');
            success = true;
          } else {
            appliedError = 'Fix did not produce changes — fixCode may not match file content';
          }
        } catch (applyErr) {
          appliedError = applyErr instanceof Error ? applyErr.message : String(applyErr);
          log.warn({ bugId: bug.id, err: appliedError }, 'failed to apply fix to file');
        }
      } else {
        appliedError = fixCode ? 'File not found or no file path provided' : 'No fix code generated';
      }

      this.attempts.push({
        id: randomUUID().slice(0, 8),
        bugId: bug.id,
        attempt: attemptNum,
        fixDescription,
        fixCode,
        success,
        timestamp: new Date(),
      });
      if (this.attempts.length > this.maxAttempts) {
        this.attempts = this.attempts.slice(-this.maxAttempts);
      }

      const attemptId = this.attempts[this.attempts.length - 1].id;
      attemptsRepo.insert({
        id: attemptId,
        bugId: bug.id,
        attempt: attemptNum,
        fixDescription,
        fixCode: fixCode ?? null,
        success,
        timestamp: new Date(),
      }).catch((err) => log.warn({ err, bugId: bug.id }, 'failed to persist attempt'));

      return { success, fixDescription, fixCode, error: appliedError };
    } catch (err) {
      return {
        success: false,
        fixDescription: 'Repair generation failed',
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  }

  private applyFix(
    originalContent: string,
    fixCode: string,
    analysis: { rootCause: string; fixPlan: string; fixCode?: string; needsHuman: boolean },
  ): string | null {
    if (!fixCode) return null;

    if (fixCode.startsWith('REPLACE_ALL:')) {
      const replacement = fixCode.slice('REPLACE_ALL:'.length).trim();
      return replacement;
    }

    if (fixCode.startsWith('REPLACE:')) {
      const parts = fixCode.slice('REPLACE:'.length).split('|||WITH|||');
      if (parts.length === 2) {
        const oldText = parts[0].trim();
        const newText = parts[1].trim();
        if (originalContent.includes(oldText)) {
          return originalContent.replace(oldText, newText);
        }
      }
      return null;
    }

    if (fixCode.startsWith('INSERT_AFTER:')) {
      const parts = fixCode.slice('INSERT_AFTER:'.length).split('|||INSERT|||');
      if (parts.length === 2) {
        const anchor = parts[0].trim();
        const newCode = parts[1].trim();
        const idx = originalContent.indexOf(anchor);
        if (idx >= 0) {
          const insertPos = idx + anchor.length;
          return originalContent.slice(0, insertPos) + '\n' + newCode + originalContent.slice(insertPos);
        }
      }
      return null;
    }

    if (analysis.fixCode && originalContent.includes(analysis.fixCode)) {
      return originalContent.replace(analysis.fixCode, fixCode);
    }

    return null;
  }
}
