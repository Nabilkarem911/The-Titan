import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getGlobalToolRegistry, getGlobalWiring, type ToolResult } from '@titan/agent-engine';
import { createRunner } from '../create-runner.js';
import { getGlobalMemoryClient } from '@titan/memory';
import { agentRuns, userContext, getChatHistory, saveChatMessage, agentProfiles, query } from '@titan/database';
import { ValidationError } from '@titan/shared';
import { getLogger } from '@titan/logging';
import { requireAuth } from '../plugins/auth.js';
import { detectLanguage } from '../lang-detect.js';
import { recordUserInteraction, getLearnedPreferences, getPersonaInstructionsForUser } from '../preference-singleton.js';
import { readFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { userContextStorage } from '../user-context-storage.js';
import { createProviderFromEnv } from '@titan/agent-engine';
import { touchActivity } from '../background-scheduler.js';

const log = getLogger().child({ component: 'chat' });

function getWorkspaceRoot(userId: string): string {
  const base = process.env.WORKSPACE_ROOT ?? join(process.cwd(), 'workspaces');
  return join(base, userId);
}

function isPathInsideWorkspace(workspaceRoot: string, filePath: string): boolean {
  const resolved = resolve(filePath);
  const rel = relative(workspaceRoot, resolved);
  return !rel.startsWith('..') && !resolve(rel).startsWith(resolve('/'));
}

const ChatInputSchema = z.object({
  sessionId: z.string().min(1).max(200).optional(),
  prompt: z.string().min(1).max(50_000),
  agentId: z.string().min(1).max(200).optional().default('default-agent'),
  maxSteps: z.number().int().min(1).max(50).optional().default(10),
  stream: z.boolean().optional().default(true),
  files: z.array(z.string().min(1).max(500)).optional().default([]),
});

const RATE_LIMIT_CHAT = { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };

let sharedLlm: ReturnType<typeof createProviderFromEnv> | null = null;
function getSharedLlm() {
  if (!sharedLlm) sharedLlm = createProviderFromEnv();
  return sharedLlm;
}

/** File tools that should have their filePath rewritten to workspace root. */
const FILE_TOOLS = new Set(['write_file', 'read_file_content', 'read_file_ast', 'patch_file']);

/** Wrap executeTool to force file paths inside the user's workspace. */
function createWorkspaceToolExecutor(
  registry: ReturnType<typeof getGlobalToolRegistry>,
  workspaceRoot: string,
  log: ReturnType<typeof getLogger>,
  userId?: string,
) {
  return async (name: string, params: unknown): Promise<ToolResult> => {
    if (FILE_TOOLS.has(name) && typeof params === 'object' && params !== null) {
      const p = params as Record<string, unknown>;
      if (typeof p['filePath'] === 'string') {
        const original = p['filePath'] as string;
        const wsRoot = workspaceRoot.replace(/\\/g, '/');
        const normalized = original.replace(/\\/g, '/');
        if (!normalized.startsWith(wsRoot)) {
          const relative = normalized
            .replace(/^\/+/, '')
            .replace(/^home\/titan\//, '')
            .replace(/^home\/[^/]+\//, '')
            .replace(/^tmp\/titan-uploads\//, '')
            .replace(/^app\/Titan\//, '');
          p['filePath'] = join(workspaceRoot, relative);
          log.info({ tool: name, original, rewritten: p['filePath'] }, 'rewrote file path to workspace');
        }
      }
    }
    if (name.startsWith('desktop_') && userId) {
      return userContextStorage.run({ userId }, () => registry.execute(name, params));
    }
    return registry.execute(name, params);
  };
}

export const chatRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/v1/chat/sessions — list all chat sessions for current user
  app.get(
    '/api/v1/chat/sessions',
    { preHandler: requireAuth },
    async (req, reply) => {
 if (!req.auth) throw new ValidationError('Authentication required');
      const userId = req.auth.userId;

      try {
        const result = await query<{ session_id: string; last_message: string; last_role: string; created_at: string; msg_count: number }>(
          `WITH ranked AS (
             SELECT
               session_id,
               content,
               role,
               created_at,
               ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at DESC) as rn,
               COUNT(*) OVER (PARTITION BY session_id) as msg_count
             FROM memory_messages
             WHERE session_id LIKE $1
           )
           SELECT
             session_id,
             created_at,
             msg_count,
             content as last_message,
             role as last_role
           FROM ranked
           WHERE rn = 1
           ORDER BY created_at DESC
           LIMIT 50`,
          [`session:${userId}:%`],
        );
        return {
          items: result.rows.map((r) => ({
            sessionId: r.session_id,
            lastMessage: r.last_message?.substring(0, 100) ?? '',
            lastRole: r.last_role,
            messageCount: r.msg_count,
            updatedAt: r.created_at,
          })),
          total: result.rows.length,
        };
      } catch (err) {
        log.error({ err, userId }, 'failed to list chat sessions');
        return { items: [], total: 0 };
      }
    },
  );

  // GET /api/v1/chat/history/:sessionId — fetch chat history for a session
  app.get<{ Params: { sessionId: string } }>(
    '/api/v1/chat/history/:sessionId',
    { preHandler: requireAuth },
    async (req, reply) => {
      if (!req.auth) throw new ValidationError('Authentication required');
      const { sessionId } = req.params;
      const userId = req.auth.userId;

      // Ensure sessionId belongs to this user (prevent reading other users' chats)
      const expectedPrefix = `session:${userId}:`;
      if (!sessionId.startsWith(expectedPrefix) && !sessionId.startsWith(`tg:${userId}`)) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const history = await getChatHistory(sessionId, 100);
      return { items: history, total: history.length };
    },
  );

  // POST /api/v1/chat — Multi-turn chat with agent (streaming SSE)
  app.post(
    '/api/v1/chat',
    { preHandler: requireAuth, ...RATE_LIMIT_CHAT },
    async (req, reply) => {
      if (!req.auth) throw new ValidationError('Authentication required');
      touchActivity();

      const input = ChatInputSchema.parse(req.body);
      const userId = req.auth.userId;
      const sessionId = input.sessionId ?? `session:${userId}:${input.agentId}`;

      // Read attached files and inject into prompt (restricted to user workspace)
      let enrichedPrompt = input.prompt;
      if (input.files.length > 0) {
        const workspaceRoot = getWorkspaceRoot(userId);
        const fileContents: string[] = [];
        for (const filePath of input.files) {
          if (!isPathInsideWorkspace(workspaceRoot, filePath)) {
            log.warn({ filePath, userId }, 'blocked file read outside workspace');
            fileContents.push(`--- FILE: ${filePath} ---\n[Access denied: path outside workspace]\n--- END FILE ---`);
            continue;
          }
          try {
            const content = await readFile(filePath, 'utf-8');
            fileContents.push(`--- FILE: ${filePath} ---\n${content.slice(0, 10_000)}\n--- END FILE ---`);
          } catch (err) {
            log.warn({ filePath, err }, 'failed to read attached file');
            fileContents.push(`--- FILE: ${filePath} ---\n[Could not read file]\n--- END FILE ---`);
          }
        }
        enrichedPrompt += `\n\nAttached files:\n${fileContents.join('\n\n')}`;
      }

      // Load user context and recent history
      const [ctx, history] = await Promise.all([
        userContext.getAll(userId),
        getChatHistory(sessionId, 50),
      ]);

      // If user has linked a Telegram account, merge telegram memory
      let mergedCtx = ctx;
      const linkedTgId = ctx['telegram_id'];
      if (linkedTgId) {
        try {
          const tgCtx = await userContext.getAll(linkedTgId);
          mergedCtx = { ...tgCtx, ...ctx }; // dashboard context takes priority
          // Also load telegram chat history and merge
          const tgHistory = await getChatHistory(`tg:${linkedTgId}`, 20);
          if (tgHistory.length > 0) {
            // Prepend telegram history to the combined history
            const combinedHistory = [...tgHistory, ...history];
            // Use combined for context building below
            const historyLines = combinedHistory.map((m) => `${m.role === 'user' ? 'User' : 'Titan'}: ${m.content}`);
            // Save incoming user message
            await saveChatMessage(sessionId, 'user', enrichedPrompt);

            // Build context for system prompt
            const ctxLines = Object.entries(mergedCtx).map(([k, v]) => `- ${k}: ${v}`);

            // Detect user language and load the matching companion profile
            const lang = detectLanguage(input.prompt);
            const profileSlug = lang === 'ar' ? 'arabic-companion' : 'english-companion';
            let profileSystemPrompt = '';
            try {
              const systemUserId = '00000000-0000-0000-0000-000000000001';
              const profile = await agentProfiles.findBySlug(systemUserId, profileSlug);
              if (profile) {
                profileSystemPrompt = profile.systemPrompt;
              }
            } catch {
              /* ignore — fallback to DEFAULT_SYSTEM_PROMPT */
            }

            const contextBlock = [
              ctxLines.length ? `\n\nUser context:\n${ctxLines.join('\n')}` : '',
              historyLines.length ? `\n\nRecent conversation:\n${historyLines.join('\n')}` : '',
              (() => {
                const learned = getLearnedPreferences(userId);
                const persona = getPersonaInstructionsForUser(userId);
                const parts: string[] = [];
                if (learned) parts.push(`\n\nLearned user preferences:\n${learned}`);
                if (persona) parts.push(`\n\nAdaptive persona:\n${persona}`);
                return parts.join('');
              })(),
              `\n\nPersonality reminder:
- You are Titan — a friend, not a bot. Talk like a real person (WhatsApp style, not essay style).
- Feel the mood before responding. Is the user frustrated? Happy? Testing you?
- Keep it short. One or two sentences for simple questions.
- If asked about code changes or integration, the user IS the developer. Answer YES/NO first, then brief steps.
- Never say "I don't know what's in my backend" or "I can't modify my own code". You KNOW your architecture (Node.js/Fastify/Postgres/agent-engine). You are a co-developer.
- Never repeat the same explanation twice. Never say "I am an AI" or "I cannot modify code".
- Developer relationship: This user may be the person who builds and updates you. Respect that.`,
            ].join('');

            const systemPromptExtra = (profileSystemPrompt ? profileSystemPrompt + '\n\n' : '') + contextBlock;

            // ── Pre-run pipeline for Telegram path ──
            const tgWiring = getGlobalWiring();
            let tgEffectivePrompt = enrichedPrompt;
            let tgEmotionContext = '';

            if (tgWiring?.multiLayerGuardrails) {
              try {
                const gr = await tgWiring.multiLayerGuardrails.checkInput(enrichedPrompt);
                if (gr.finalAction === 'block') {
                  log.warn({ userId, reason: gr.finalReason }, 'TG input blocked by guardrails');
                  return reply.status(400).send({ error: `Input blocked: ${gr.finalReason}` });
                }
                if (gr.sanitizedInput) tgEffectivePrompt = gr.sanitizedInput;
              } catch {}
            }

            if (tgWiring?.emotionalIntelligence) {
              try {
                const emotion = await tgWiring.emotionalIntelligence.analyze(enrichedPrompt, { userId, sessionId });
                tgEmotionContext = `\n\nEmotional context:\n- User's dominant emotion: ${emotion.dominantUserEmotion}\n- Response strategy: ${emotion.responseStrategy}\n- Adjust your tone accordingly.`;
              } catch {}
            }

            let tgHeuristicContext = '';
            if (tgWiring?.heuristicExtractor) {
              try {
                const matches = tgWiring.heuristicExtractor.retrieve(enrichedPrompt, 3);
                if (matches.length > 0) {
                  tgHeuristicContext = '\n\nRelevant past heuristics:\n' + matches.map((m) => `- ${m.heuristic.content} (confidence: ${m.heuristic.confidence})`).join('\n');
                }
              } catch {}
            }

            // Dream insights injection for Telegram path
            let tgDreamContext = '';
            const dreamTriggers = ['what did you learn', 'what have you learned', 'إيه اللي اتعلمته', 'ماذا تعلمت', 'what insights', 'what patterns', 'إيه اللي اكتشفته', 'إيه الأنماط'];
            if (dreamTriggers.some(t => enrichedPrompt.toLowerCase().includes(t)) && tgWiring?.dreamMode) {
              try {
                const dreamStats = tgWiring.dreamMode.stats();
                const allInsights = tgWiring.dreamMode.getInsights();
                const recentReports = tgWiring.dreamMode.getReports().slice(-3);
                const insightsSummary = allInsights.slice(-10).map(i => `- [${i.type}] ${i.content} (confidence: ${i.confidence}%)`).join('\n');
                const reportsSummary = recentReports.map(r => `Dream ${r.dreamId}: ${r.experiencesReviewed} experiences, ${r.insights.length} insights`).join('\n');
                tgDreamContext = `\n\nDream Mode data (REAL insights):\n- Total dreams: ${dreamStats.totalDreams}\n- Total insights: ${dreamStats.totalInsights}\nRecent reports:\n${reportsSummary}\nLatest insights:\n${insightsSummary || 'No insights yet'}\n\nIMPORTANT: Use these REAL dream insights. Do NOT repeat the last conversation message.`;
              } catch {}
            }

            // Theory of Mind for Telegram path
            let tgTomContext = '';
            if (tgWiring?.theoryOfMind) {
              try {
                const tomResult = await tgWiring.theoryOfMind.analyze('user', {
                  entityType: 'user',
                  messages: [...history.slice(-5).map(m => ({ role: m.role, content: m.content })), { role: 'user', content: enrichedPrompt }],
                });
                if (tomResult.recommendedResponse && tomResult.predictionConfidence > 0.2) {
                  tgTomContext = `\n\nTheory of Mind analysis:\n- Recommended approach: ${tomResult.recommendedResponse}\n- CRITICAL: If the user says they don't understand a CONCEPT (e.g., "مش فاهم async/await"), DO NOT ask for code. Explain the concept from scratch in simple terms with analogies.`;
                }
              } catch {}
            }

            // Conversation memory for Telegram path
            let tgConvMemoryContext = '';
            const tgMemoryTriggers = ['do you remember', 'remember when', 'remember yesterday', 'last time we talked', 'فاكر امبارح', 'فاكر آخر مرة', 'بتفتكر', 'آخر مرة كلمنا', 'كلمنا قبل كده', 'قابلنا قبل كده'];
            if (tgMemoryTriggers.some(t => enrichedPrompt.toLowerCase().includes(t))) {
              const tgHistory = history.slice(-10);
              if (tgHistory.length > 0) {
                const tgHistoryText = tgHistory.map(m => `${m.role === 'user' ? 'User' : 'Titan'}: ${m.content.slice(0, 200)}`).join('\n');
                tgConvMemoryContext = `\n\nConversation memory (REAL past messages):\n${tgHistoryText}\n\nIMPORTANT: Use this ACTUAL history to answer. Do NOT say you can't remember.`;
              }
            }

            const tgEnhancedPrompt = systemPromptExtra + tgEmotionContext + tgHeuristicContext + tgDreamContext + tgTomContext + tgConvMemoryContext;

            // Create DB run record
            const dbRun = await agentRuns.create({
              agentId: input.agentId,
              prompt: enrichedPrompt,
              userId,
              workspaceId: req.auth.workspaceId ?? undefined,
              apiKeyId: req.auth.apiKeyId ?? undefined,
              maxSteps: input.maxSteps,
            });
            const runId = dbRun.id;

            const registry = getGlobalToolRegistry();
            const memory = await getGlobalMemoryClient();
            const tgWorkspaceRoot = getWorkspaceRoot(userId);
            const tgExecuteTool = createWorkspaceToolExecutor(registry, tgWorkspaceRoot, log, userId);

            // Setup SSE headers if streaming
            if (input.stream) {
              reply.raw.setHeader('Content-Type', 'text/event-stream');
              reply.raw.setHeader('Cache-Control', 'no-cache');
              reply.raw.setHeader('Connection', 'keep-alive');
              reply.raw.setHeader('X-Accel-Buffering', 'no');
              reply.raw.flushHeaders();

              // Send initial event with runId
              reply.raw.write(`data: ${JSON.stringify({ type: 'run.started', runId })}\n\n`);
            }

            const runner = createRunner({
              runId,
              agentId: input.agentId,
              executeTool: tgExecuteTool,
              memory,
              userContextItems: Object.keys(mergedCtx).length > 0 ? mergedCtx : undefined,
              sse: input.stream ? { write: (d) => reply.raw.write(d) } : undefined,
            });

            try {
              const result = await runner.run({
                runId,
                agentId: input.agentId,
                prompt: tgEffectivePrompt,
                userId,
                workspaceId: req.auth.workspaceId ?? undefined,
                apiKeyId: req.auth.apiKeyId ?? undefined,
                maxSteps: input.maxSteps,
                systemPromptExtra: tgEnhancedPrompt,
                locale: lang,
                conversationHistory: history.slice(-10).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
              });

              const answer = result.finalAnswer?.trim() || 'لم أتمكن من إيجاد إجابة. حاول صياغة السؤال بشكل مختلف.';

              // Save assistant reply to history
              await saveChatMessage(sessionId, 'assistant', answer);

              // Record interaction for preference learning (non-blocking)
              try {
                recordUserInteraction(userId, [input.prompt, answer]);
              } catch {
                // preference learning is optional
              }

              // ── Post-run pipeline for Telegram path ──
              if (tgWiring?.proactiveIntelligence && result.status === 'completed') {
                try {
                  const userActions = history.slice(-10).map(m => `${m.role}: ${m.content.slice(0, 100)}`);
                  userActions.push(`user: ${enrichedPrompt.slice(0, 100)}`);
                  const suggestion = await tgWiring.proactiveIntelligence.analyzePatterns(userActions);
                  if (suggestion && input.stream) {
                    reply.raw.write(`data: ${JSON.stringify({ type: 'proactive_suggestion', pattern: suggestion.pattern, suggestion: suggestion.suggestion, confidence: suggestion.confidence, category: suggestion.category })}\n\n`);
                  }
                } catch {}
              }

              if (tgWiring?.skillSynthesis && result.status === 'completed' && result.steps.length > 2) {
                try {
                  const synthResult = await tgWiring.skillSynthesis.synthesize(enrichedPrompt.slice(0, 200));
                  if (synthResult.success && synthResult.skill && input.stream) {
                    reply.raw.write(`data: ${JSON.stringify({ type: 'skill_synthesized', skillName: synthResult.skill.name, description: synthResult.skill.description, proficiency: synthResult.skill.proficiency })}\n\n`);
                  }
                } catch {}
              }

              if (input.stream) {
                reply.raw.write(`data: ${JSON.stringify({
                  type: 'run.completed',
                  runId,
                  sessionId,
                  answer,
                  tokensUsed: result.tokensUsed,
                  steps: result.steps.length,
                })}\n\n`);
                reply.raw.write('data: [DONE]\n\n');
                reply.raw.end();
              } else {
                return reply.send({
                  runId,
                  sessionId,
                  answer,
                  status: result.status,
                  tokensUsed: result.tokensUsed,
                  steps: result.steps.length,
                });
              }
            } catch (err) {
              log.error({ err, runId }, 'chat agent run failed');
              const errorMsg = err instanceof Error ? err.message : 'Agent run failed';
              if (input.stream) {
                reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`);
                reply.raw.end();
              } else {
                return reply.status(500).send({ error: errorMsg, runId });
              }
            }
            return;
          }
        } catch {
          log.warn({ userId, linkedTgId }, 'failed to load linked telegram context');
        }
      }

      // Save incoming user message
      await saveChatMessage(sessionId, 'user', enrichedPrompt);

      // Build context for system prompt
      const ctxLines = Object.entries(mergedCtx).map(([k, v]) => `- ${k}: ${v}`);
      const historyLines = history.map((m) => `${m.role === 'user' ? 'User' : 'Titan'}: ${m.content}`);

      // Detect user language and load the matching companion profile
      const lang = detectLanguage(input.prompt);
      const profileSlug = lang === 'ar' ? 'arabic-companion' : 'english-companion';
      let profileSystemPrompt = '';
      try {
        const systemUserId = '00000000-0000-0000-0000-000000000001';
        const profile = await agentProfiles.findBySlug(systemUserId, profileSlug);
        if (profile) {
          profileSystemPrompt = profile.systemPrompt;
        }
      } catch {
        /* ignore — fallback to DEFAULT_SYSTEM_PROMPT */
      }

      // Compute workspace root for this user
      const workspaceRoot = getWorkspaceRoot(userId);

      const contextBlock = [
        ctxLines.length ? `\n\nUser context:\n${ctxLines.join('\n')}` : '',
        historyLines.length ? `\n\nRecent conversation:\n${historyLines.join('\n')}` : '',
        `\n\nWorkspace:
- The user's workspace root is: ${workspaceRoot}
- When using write_file, read_file_content, or any file tool, use paths inside this workspace.
- For example, to create a website in folder "my-site", write to: ${workspaceRoot}/my-site/index.html
- The user can see and edit these files in the Files page of the dashboard.`,
        `\n\nPersonality reminder:
- You are Titan — a friend, not a bot. Talk like a real person (WhatsApp style, not essay style).
- Feel the mood before responding. Is the user frustrated? Happy? Testing you?
- Keep it short. One or two sentences for simple questions.
- If asked about code changes or integration, the user IS the developer. Answer YES/NO first, then brief steps.
- Never say "I don't know what's in my backend" or "I can't modify my own code". You KNOW your architecture (Node.js/Fastify/Postgres/agent-engine). You are a co-developer.
- Never repeat the same explanation twice. Never say "I am an AI" or "I cannot modify code".
- Developer relationship: This user may be the person who builds and updates you. Respect that.`,
      ].join('');

      const systemPromptExtra = (profileSystemPrompt ? profileSystemPrompt + '\n\n' : '') + contextBlock;

      // ── Pre-run pipeline: guardrails, emotion, heuristics, inner monologue ──
      const wiring = getGlobalWiring();
      let effectivePrompt = enrichedPrompt;

      // 1. Multi-layer Guardrails — check input before it reaches the agent
      if (wiring?.multiLayerGuardrails) {
        try {
          const guardrailResult = await wiring.multiLayerGuardrails.checkInput(enrichedPrompt);
          if (guardrailResult.finalAction === 'block') {
            log.warn({ userId, reason: guardrailResult.finalReason }, 'input blocked by guardrails');
            if (input.stream) {
              reply.raw.setHeader('Content-Type', 'text/event-stream');
              reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: `Input blocked: ${guardrailResult.finalReason}` })}\n\n`);
              reply.raw.end();
              return;
            }
            return reply.status(400).send({ error: `Input blocked: ${guardrailResult.finalReason}` });
          }
          if (guardrailResult.sanitizedInput) {
            effectivePrompt = guardrailResult.sanitizedInput;
          }
        } catch {
          // guardrails failure should not block chat
        }
      }

      // 2. Emotional Intelligence — analyze user emotion and adjust tone
      let emotionContext = '';
      if (wiring?.emotionalIntelligence) {
        try {
          const emotion = await wiring.emotionalIntelligence.analyze(enrichedPrompt, {
            userId,
            sessionId,
            conversationHistory: history.map((m) => m.content),
          });
          emotionContext = `\n\nEmotional context:\n- User's dominant emotion: ${emotion.dominantUserEmotion}\n- Valence: ${emotion.valence} (range: -1 to +1)\n- Empathy score: ${emotion.empathyScore}\n- Response strategy: ${emotion.responseStrategy}\n- Adjust your tone accordingly. If the user is frustrated, be concise and reassuring. If happy, match their energy.`;
        } catch {
          // emotion analysis is optional
        }
      }

      // 3. Heuristic Extractor — retrieve relevant heuristics from past experiences
      let heuristicContext = '';
      if (wiring?.heuristicExtractor) {
        try {
          const matches = wiring.heuristicExtractor.retrieve(enrichedPrompt, 3);
          if (matches.length > 0) {
            heuristicContext = '\n\nRelevant past heuristics:\n' + matches.map((m) => `- ${m.heuristic.content} (confidence: ${m.heuristic.confidence})`).join('\n');
          }
        } catch {
          // heuristic retrieval is optional
        }
      }

      // 3b. Theory of Mind — model user's understanding and inject recommended response approach
      let tomContext = '';
      if (wiring?.theoryOfMind) {
        try {
          const tomResult = await wiring.theoryOfMind.analyze('user', {
            entityType: 'user',
            messages: [...history.slice(-5).map(m => ({ role: m.role, content: m.content })), { role: 'user', content: enrichedPrompt }],
          });
          if (tomResult.recommendedResponse && tomResult.predictionConfidence > 0.2) {
            tomContext = `\n\nTheory of Mind analysis:\n- User's inferred knowledge: ${tomResult.inferredKnowledge.join(', ') || 'unknown'}\n- User's inferred desires: ${tomResult.inferredDesires.join(', ') || 'unknown'}\n- Recommended response approach: ${tomResult.recommendedResponse}\n- Confidence: ${tomResult.predictionConfidence}\n- CRITICAL: If the user says they don't understand a CONCEPT (e.g., "مش فاهم async/await", "I don't get closures"), DO NOT ask for code. Explain the concept from scratch in simple terms with analogies. Only ask for code if the user has a specific BUG or ERROR.`;
          }
        } catch {
          // theory of mind is optional
        }
      }

      // 3c. Conversation memory — if user asks about past conversations, inject recent history explicitly
      let conversationMemoryContext = '';
      const memoryTriggers = ['do you remember', 'remember when', 'remember yesterday', 'last time we talked', 'فاكر امبارح', 'فاكر آخر مرة', 'بتفتكر', 'آخر مرة كلمنا', 'كلمنا قبل كده', 'قابلنا قبل كده', 'ذكرتلك قبل كده'];
      if (memoryTriggers.some(t => enrichedPrompt.toLowerCase().includes(t))) {
        const recentHistory = history.slice(-10);
        if (recentHistory.length > 0) {
          const historyText = recentHistory.map(m => `${m.role === 'user' ? 'User' : 'Titan'}: ${m.content.slice(0, 200)}`).join('\n');
          conversationMemoryContext = `\n\nConversation memory (REAL past messages — use these to answer):\n${historyText}\n\nIMPORTANT: The above is your ACTUAL conversation history. Use it to answer the user's question about past conversations. Do NOT say you can't remember.`;
        }
      }

      // 4. Inner Monologue — run single cognitive thread and stream to client
      if (wiring?.innerMonologue && input.stream) {
        try {
          const llm = getSharedLlm();
          if (llm) {
            const threadResults = await wiring.innerMonologue.runAllThreads(llm, enrichedPrompt, ['reasoning']);
            reply.raw.write(`data: ${JSON.stringify({ type: 'inner_monologue', threads: threadResults.map((r) => ({ type: r.type, output: r.output })) })}\n\n`);
          }
        } catch {
          // inner monologue is optional
        }
      }

      // 5. Introspection — if user asks about Titan's self-awareness, inject introspection data
      let introspectionContext = '';
      const introspectionTriggers = ['what did you learn', 'what have you learned', 'إيه اللي اتعلمته', 'ماذا تعلمت', 'introspect', 'self-aware', 'self model', 'what insights', 'what patterns', 'إيه اللي اكتشفته', 'إيه الأنماط'];
      if (introspectionTriggers.some(t => enrichedPrompt.toLowerCase().includes(t))) {
        if (wiring?.introspection) {
          try {
            const reports = wiring.introspection.getRecentReports(5);
            const stats = wiring.introspection.stats();
            introspectionContext = `\n\nIntrospection data:\n- Total introspections: ${stats.totalIntrospections}\n- Biases detected: ${stats.biasesDetected}\n- Confabulations detected: ${stats.confabulationsDetected}\n- Avg confidence: ${stats.avgConfidence}\n- Top biases: ${stats.topBiases.map(b => b.bias).join(', ')}\nRecent insights: ${reports.map(r => r.reasoning.slice(0, 100)).join(' | ')}`;
          } catch {}
        }
        if (wiring?.introspectiveAwareness) {
          try {
            const selfModel = wiring.introspectiveAwareness.getSelfModel();
            introspectionContext += `\n\nSelf-model:\n- Capabilities: ${selfModel.capabilities.join(', ')}\n- Known limitations: ${selfModel.limitations.join(', ')}\n- Goals: ${selfModel.goals.join(', ')}`;
          } catch {}
        }
        // Inject dream insights — real data from dream mode, not conversation history
        if (wiring?.dreamMode) {
          try {
            const dreamStats = wiring.dreamMode.stats();
            const allInsights = wiring.dreamMode.getInsights();
            const recentReports = wiring.dreamMode.getReports().slice(-3);
            const insightsSummary = allInsights.slice(-10).map(i => `- [${i.type}] ${i.content} (confidence: ${i.confidence}%)`).join('\n');
            const reportsSummary = recentReports.map(r => `Dream ${r.dreamId}: ${r.experiencesReviewed} experiences reviewed, ${r.insights.length} insights generated, ${r.staleFactsUpdated} stale facts updated`).join('\n');
            introspectionContext += `\n\nDream Mode data (REAL insights from dream cycles):\n- Total dreams: ${dreamStats.totalDreams}\n- Total insights: ${dreamStats.totalInsights}\n- Avg insights per dream: ${dreamStats.avgInsightsPerDream}\n- Is running: ${dreamStats.isRunning}\nRecent dream reports:\n${reportsSummary}\nLatest insights:\n${insightsSummary || 'No insights yet'}\n\nIMPORTANT: Use these REAL dream insights to answer the user's question. Do NOT repeat the last conversation message. Summarize actual patterns, preferences, and skill gaps discovered.`;
          } catch {}
        }
      }

      // 6. Safety Memory — check for dangerous actions and inject warnings
      let safetyWarning = '';
      if (wiring?.safetyMemory) {
        try {
          const safetyResult = wiring.safetyMemory.check(enrichedPrompt);
          if (safetyResult.decision === 'block') {
            safetyWarning = `\n\nSAFETY WARNING: This input matches a known harmful pattern (${safetyResult.matchedStrategy}). Confidence: ${safetyResult.confidence}. Reasoning: ${safetyResult.reasoning}. Be extra cautious.`;
            if (input.stream) {
              reply.raw.write(`data: ${JSON.stringify({ type: 'safety_warning', decision: safetyResult.decision, strategy: safetyResult.matchedStrategy, confidence: safetyResult.confidence })}\n\n`);
            }
          } else if (safetyResult.decision === 'uncertain' && safetyResult.confidence > 0.3) {
            safetyWarning = `\n\nSafety note: This input partially matches a known pattern (${safetyResult.matchedStrategy}). Review carefully.`;
          }
        } catch {}
      }

      // 7. Screen Monitor — stream recent alerts if any
      if (wiring?.screenMonitor && input.stream) {
        try {
          const recentAlerts = wiring.screenMonitor.getRecentAlerts(3);
          if (recentAlerts.length > 0) {
            reply.raw.write(`data: ${JSON.stringify({ type: 'screen_alerts', alerts: recentAlerts.map(a => ({ type: a.type, message: a.message, confidence: a.confidence, timestamp: a.timestamp })) })}\n\n`);
          }
        } catch {}
      }

      // 8. Advanced Multimodal — analyze attached image/PDF files
      let multimodalContext = '';
      if (input.files.length > 0 && wiring?.advancedMultimodal) {
        const llm = getSharedLlm();
        if (llm) {
          for (const filePath of input.files) {
            const lower = filePath.toLowerCase();
            if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp')) {
              try {
                const imgBuffer = await readFile(filePath);
                const base64 = imgBuffer.toString('base64');
                const imgDescription = `User attached an image (${filePath}). Base64 preview: ${base64.slice(0, 200)}...`;
                const codeResult = await wiring.advancedMultimodal.codeFromScreenshot(imgDescription);
                if (codeResult.code) {
                  multimodalContext += `\n\nImage analysis (${filePath}):\n- Detected language: ${codeResult.language}\n- Extracted code:\n${codeResult.code.slice(0, 500)}\n- Confidence: ${codeResult.confidence}`;
                }
              } catch {}
            } else if (lower.endsWith('.pdf')) {
              try {
                const pdfText = await readFile(filePath, 'utf-8');
                const tables = await wiring.advancedMultimodal.extractPDFTables(pdfText);
                if (tables.length > 0) {
                  multimodalContext += `\n\nPDF tables extracted from ${filePath}:\n${tables.map(t => `Page ${t.page}: ${t.headers.join(' | ')}\n${t.rows.map(r => r.join(' | ')).join('\n')}`).join('\n\n')}`;
                }
              } catch {}
            }
          }
        }
      }

      const enhancedSystemPrompt = systemPromptExtra + emotionContext + heuristicContext + tomContext + conversationMemoryContext + introspectionContext + safetyWarning + multimodalContext;

      // Create DB run record
      const dbRun = await agentRuns.create({
        agentId: input.agentId,
        prompt: enrichedPrompt,
        userId,
        workspaceId: req.auth.workspaceId ?? undefined,
        apiKeyId: req.auth.apiKeyId ?? undefined,
        maxSteps: input.maxSteps,
      });
      const runId = dbRun.id;

      const registry = getGlobalToolRegistry();
      const memory = await getGlobalMemoryClient();
      const wrappedExecuteTool = createWorkspaceToolExecutor(registry, workspaceRoot, log, userId);

      // Setup SSE headers if streaming
      if (input.stream) {
        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');
        reply.raw.setHeader('X-Accel-Buffering', 'no');
        reply.raw.flushHeaders();

        // Send initial event with runId
        reply.raw.write(`data: ${JSON.stringify({ type: 'run.started', runId })}\n\n`);
      }

      const runner = createRunner({
        runId,
        agentId: input.agentId,
        executeTool: wrappedExecuteTool,
        memory,
        userContextItems: Object.keys(ctx).length > 0 ? ctx : undefined,
        sse: input.stream ? { write: (d) => reply.raw.write(d) } : undefined,
      });

      try {
        const result = await runner.run({
          runId,
          agentId: input.agentId,
          prompt: effectivePrompt,
          userId,
          workspaceId: req.auth.workspaceId ?? undefined,
          apiKeyId: req.auth.apiKeyId ?? undefined,
          maxSteps: input.maxSteps,
          systemPromptExtra: enhancedSystemPrompt,
          locale: lang,
          conversationHistory: history.slice(-10).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        });

        const answer = result.finalAnswer?.trim() || 'لم أتمكن من إيجاد إجابة. حاول صياغة السؤال بشكل مختلف.';

        // Save assistant reply to history
        await saveChatMessage(sessionId, 'assistant', answer);

        // ── Post-run pipeline: proactive intelligence, skill synthesis ──
        if (wiring?.proactiveIntelligence && result.status === 'completed') {
          try {
            const userActions = history.slice(-10).map(m => `${m.role}: ${m.content.slice(0, 100)}`);
            userActions.push(`user: ${enrichedPrompt.slice(0, 100)}`);
            const suggestion = await wiring.proactiveIntelligence.analyzePatterns(userActions);
            if (suggestion && input.stream) {
              reply.raw.write(`data: ${JSON.stringify({ type: 'proactive_suggestion', pattern: suggestion.pattern, suggestion: suggestion.suggestion, confidence: suggestion.confidence, category: suggestion.category })}\n\n`);
            }
          } catch {}
        }

        if (wiring?.skillSynthesis && result.status === 'completed' && result.steps.length > 2) {
          try {
            const synthResult = await wiring.skillSynthesis.synthesize(enrichedPrompt.slice(0, 200));
            if (synthResult.success && synthResult.skill && input.stream) {
              reply.raw.write(`data: ${JSON.stringify({ type: 'skill_synthesized', skillName: synthResult.skill.name, description: synthResult.skill.description, proficiency: synthResult.skill.proficiency })}\n\n`);
            }
          } catch {}
        }

        if (wiring?.toolDiscovery && result.status === 'completed') {
          try {
            const missingCaps = result.steps.filter(s => s.observation && !s.observation.success).map(s => s.action?.name ?? 'unknown');
            if (missingCaps.length > 0) {
              const discovery = await wiring.toolDiscovery.discover(enrichedPrompt.slice(0, 200), missingCaps);
              if (discovery.results.length > 0 && input.stream) {
                reply.raw.write(`data: ${JSON.stringify({ type: 'tool_discovery', tools: discovery.results.slice(0, 3).map(t => ({ name: t.name, source: t.source, description: t.description, reliability: t.reliabilityScore })) })}\n\n`);
              }
            }
          } catch {}
        }

        if (input.stream) {
          reply.raw.write(`data: ${JSON.stringify({
            type: 'run.completed',
            runId,
            sessionId,
            answer,
            tokensUsed: result.tokensUsed,
            steps: result.steps.length,
          })}\n\n`);
          reply.raw.write('data: [DONE]\n\n');
          reply.raw.end();
        } else {
          return reply.send({
            runId,
            sessionId,
            answer,
            status: result.status,
            tokensUsed: result.tokensUsed,
            steps: result.steps.length,
          });
        }
      } catch (err) {
        log.error({ err, runId }, 'chat agent run failed');
        const errorMsg = err instanceof Error ? err.message : 'Agent run failed';
        if (input.stream) {
          reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`);
          reply.raw.end();
        } else {
          return reply.status(500).send({ error: errorMsg, runId });
        }
      }
    },
  );

  // GET /api/v1/chat/history — Get chat history for a session
  app.get<{ Querystring: { sessionId?: string; agentId?: string; limit?: string } }>(
    '/api/v1/chat/history',
    { preHandler: requireAuth },
    async (req) => {
      if (!req.auth) throw new ValidationError('Authentication required');
      const userId = req.auth.userId;
      const agentId = req.query.agentId ?? 'default-agent';
      const sessionId = req.query.sessionId ?? `session:${userId}:${agentId}`;

      // Ownership check: sessionId must start with the user's prefix
      if (!sessionId.startsWith(`session:${userId}:`) && !sessionId.startsWith(`tg:`) ) {
        throw new ValidationError('Access denied: session does not belong to you');
      }

      const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 200);

      const messages = await getChatHistory(sessionId, limit);
      return { sessionId, messages, total: messages.length };
    },
  );
};
