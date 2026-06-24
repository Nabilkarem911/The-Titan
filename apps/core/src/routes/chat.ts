import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getGlobalToolRegistry, type ToolResult } from '@titan/agent-engine';
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
          let relative = normalized
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
                prompt: enrichedPrompt,
                userId,
                workspaceId: req.auth.workspaceId ?? undefined,
                apiKeyId: req.auth.apiKeyId ?? undefined,
                maxSteps: input.maxSteps,
                systemPromptExtra,
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
          prompt: enrichedPrompt,
          userId,
          workspaceId: req.auth.workspaceId ?? undefined,
          apiKeyId: req.auth.apiKeyId ?? undefined,
          maxSteps: input.maxSteps,
          systemPromptExtra,
        });

        const answer = result.finalAnswer?.trim() || 'لم أتمكن من إيجاد إجابة. حاول صياغة السؤال بشكل مختلف.';

        // Save assistant reply to history
        await saveChatMessage(sessionId, 'assistant', answer);

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
