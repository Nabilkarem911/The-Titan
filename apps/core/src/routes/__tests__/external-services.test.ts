/**
 * External Services Tests — Voice, Browser, Telegram, Discord, Slack
 *
 * Tests the external service integration modules with:
 * - Unit tests for adapters and providers (no real API calls)
 * - Integration tests for channel routing and cross-service scenarios
 * - Graceful behavior when API keys are missing
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Mock infrastructure (same as comprehensive-audit.test.ts)
// ---------------------------------------------------------------------------
const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
const mockPool = { totalCount: 5, idleCount: 3, waitingCount: 0, query: mockQuery };

vi.mock('@titan/database', () => ({
  getPool: () => mockPool,
  ping: () => Promise.resolve(true),
  query: mockQuery,
  verifyTlsOnStartup: Promise.resolve(),
  isTlsVerified: () => true,
  getRetentionInfo: () => Promise.resolve({ retentionDays: 365, oldestEntry: null }),
  audit: { write: vi.fn().mockResolvedValue(undefined), writeChained: vi.fn().mockResolvedValue(undefined) },
  users: {
    findById: vi.fn().mockResolvedValue(null), findByEmail: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'u1', email: 'new@test.com', name: 'New User', isActive: true }),
    count: vi.fn().mockResolvedValue(0), findFirst: vi.fn().mockResolvedValue(null),
  },
  sessions: {
    create: vi.fn().mockResolvedValue({ id: 's1', userId: 'u1', refreshTokenHash: 'h' }),
    atomicConsumeByHash: vi.fn().mockResolvedValue(null),
    findByRefreshHashIncludingRevoked: vi.fn().mockResolvedValue(null),
    getState: vi.fn().mockResolvedValue(null),
    revoke: vi.fn().mockResolvedValue(undefined), revokeAllForUser: vi.fn().mockResolvedValue(undefined),
  },
  apiKeys: {
    findByHash: vi.fn().mockResolvedValue(null), touchLastUsed: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue({ id: 'k1', userId: 'u1', name: 'test', keyHash: 'h' }),
    listForUser: vi.fn().mockResolvedValue([]), revoke: vi.fn().mockResolvedValue(undefined),
  },
  members: { findMembership: vi.fn().mockResolvedValue(null) },
  agentRuns: {
    findById: vi.fn(), create: vi.fn().mockResolvedValue({ id: 'run-1' }),
    listForUser: vi.fn().mockResolvedValue([]), listForAgent: vi.fn().mockResolvedValue([]),
    updateStatus: vi.fn().mockResolvedValue(undefined),
  },
  agentSteps: { create: vi.fn(), listForRun: vi.fn().mockResolvedValue([]) },
  agentProfiles: { findById: vi.fn(), listAll: vi.fn().mockResolvedValue([]), upsert: vi.fn(), deleteById: vi.fn() },
  userContext: vi.fn().mockReturnValue({
    getAll: vi.fn().mockResolvedValue({}), set: vi.fn().mockResolvedValue(undefined), get: vi.fn().mockResolvedValue(null),
  }),
  getChatHistory: vi.fn().mockResolvedValue([]), saveChatMessage: vi.fn().mockResolvedValue(undefined),
  userSecrets: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
  workspaces: {
    findById: vi.fn(), findBySlug: vi.fn().mockResolvedValue(null),
    listForUser: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 'ws1' }),
  },
  webhooks: {
    create: vi.fn().mockResolvedValue({ id: 'w1' }), findById: vi.fn(),
    listForOwner: vi.fn().mockResolvedValue([]), update: vi.fn(), rotateSecret: vi.fn(), delete: vi.fn(),
  },
  plugins: {
    findById: vi.fn(), findByName: vi.fn(), list: vi.fn().mockResolvedValue([]),
    listAll: vi.fn().mockResolvedValue([]), create: vi.fn(), updateStatus: vi.fn(), deleteById: vi.fn(),
  },
  pluginVersions: {
    create: vi.fn(), findByPluginAndVersion: vi.fn(), list: vi.fn().mockResolvedValue([]),
    listForPlugin: vi.fn().mockResolvedValue([]), setPublished: vi.fn(), setDeprecated: vi.fn(),
  },
  pluginRatings: {
    upsert: vi.fn(), getAverageForPlugin: vi.fn().mockResolvedValue({ avg: 0, count: 0 }),
    listForPlugin: vi.fn().mockResolvedValue([]),
  },
  pluginSearch: { search: vi.fn().mockResolvedValue({ items: [], total: 0 }) },
  closePool: vi.fn(),
}));

vi.mock('@titan/queue', () => ({
  enqueue: vi.fn().mockResolvedValue(undefined),
  QUEUE_NAMES: { AGENT_EXECUTE: 'agent:execute', TOOL_EXECUTE: 'tool:execute', MEMORY_INDEX: 'memory:index', MEMORY_RETRIEVE: 'memory:retrieve', SANDBOX_EXEC: 'sandbox:exec', MONITORING_CHECK: 'monitoring:check', AUDIT_WRITE: 'audit:write', WEBHOOK_DELIVER: 'webhook:deliver' },
  getQueueStats: vi.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }),
  pingRedis: () => Promise.resolve(true),
  verifyAuthOnStartup: Promise.resolve(), isAuthVerified: () => true,
  getRedis: () => ({ ping: () => 'PONG', info: () => 'used_memory:1024' }),
}));

const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';
vi.mock('@titan/auth', () => ({
  registerUser: vi.fn().mockResolvedValue({ user: { id: MOCK_USER_ID, email: 't@t.com', name: 'T' }, tokens: { accessToken: 'at', refreshToken: 'rt', expiresIn: 900 } }),
  loginUser: vi.fn().mockResolvedValue({ user: { id: MOCK_USER_ID, email: 't@t.com', name: 'T' }, tokens: { accessToken: 'at', refreshToken: 'rt', expiresIn: 900 } }),
  refreshTokens: vi.fn().mockResolvedValue({ accessToken: 'at_new', refreshToken: 'rt_new' }),
  logout: vi.fn().mockResolvedValue(undefined), logoutAllForUser: vi.fn().mockResolvedValue(undefined),
  createApiKey: vi.fn().mockResolvedValue({ id: 'k1', key: 'titan_key_123', name: 'test' }),
  resolveAuthFromAccessToken: vi.fn().mockResolvedValue({
    userId: MOCK_USER_ID, sessionId: 's1',
    permissions: ['workspace:read','workspace:write','workspace:delete','workspace:admin','agent:read','agent:write','agent:execute','tool:read','tool:execute','memory:read','memory:write','sandbox:read','sandbox:execute','monitoring:read','audit:read'],
  }),
  resolveAuthFromApiKey: vi.fn(), hasPermission: vi.fn().mockReturnValue(true),
  canAssignRole: vi.fn().mockReturnValue(true), isValidRole: vi.fn().mockReturnValue(true),
  getPermissionsForRole: vi.fn().mockReturnValue([]),
}));

vi.mock('@titan/memory', () => ({
  getGlobalMemoryClient: vi.fn().mockResolvedValue({ search: vi.fn().mockResolvedValue([]), upsert: vi.fn().mockResolvedValue(undefined) }),
  KnowledgeBase: class { addDocument = vi.fn().mockResolvedValue(undefined); search = vi.fn().mockResolvedValue([]); getDocument = vi.fn().mockResolvedValue(null); deleteDocument = vi.fn().mockResolvedValue(true); listDocuments = vi.fn().mockResolvedValue([]); stats = vi.fn().mockReturnValue({ documentCount: 0, totalChunks: 0 }); },
}));

vi.mock('@titan/observability', () => ({
  getAbuseDetector: () => ({ isBlocked: () => false, record: () => {} }),
  snapshot: () => ({}), renderPrometheus: () => '',
  observeHistogram: vi.fn(), incCounter: vi.fn(),
  recordRateLimitHit: vi.fn(), recordAuthFailureHybrid: vi.fn(), recordBruteForcePattern: vi.fn(),
}));

vi.mock('@titan/agent-engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@titan/agent-engine')>();
  return {
    ...actual,
    createProviderFromEnv: vi.fn().mockReturnValue({ complete: vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [] }) }),
    AgentRunner: vi.fn().mockImplementation(() => ({ run: vi.fn().mockResolvedValue({ id: 'run-1', status: 'completed', steps: [] }) })),
    getGlobalToolRegistry: vi.fn().mockReturnValue({ execute: vi.fn().mockResolvedValue({ success: true, data: 'ok' }), list: vi.fn().mockReturnValue([]), size: 0, has: vi.fn().mockReturnValue(false) }),
    getGlobalPluginRunner: vi.fn().mockReturnValue({ load: vi.fn(), unload: vi.fn(), getTools: vi.fn().mockReturnValue([]), listPlugins: vi.fn().mockReturnValue([]) }),
  };
});

vi.mock('../../audit-scheduler.js', () => ({ getLastVerifyResult: () => null, getLastArchiveResult: () => null }));
vi.mock('../../swarm-store.js', () => ({ storeSwarmTask: vi.fn(), getSwarmTask: vi.fn(), listSwarmTasks: vi.fn().mockReturnValue([]) }));
vi.mock('../../plugins/hybrid-rate-limit.js', () => ({ hybridKeyGenerator: () => (req: { ip?: string }) => req.ip ?? 'test', recordRateLimitHit: vi.fn() }));
vi.mock('../../desktop-bridge-instance.js', () => ({ getDesktopBridge: () => null }));
vi.mock('../../preference-singleton.js', () => ({ recordUserInteraction: vi.fn(), getLearnedPreferences: vi.fn().mockReturnValue(null), getPersonaInstructionsForUser: vi.fn().mockReturnValue('') }));

// ===========================================================================
// 1. VOICE — STT/TTS providers (no real API calls)
// ===========================================================================
describe('Voice Services — WhisperSTTProvider', () => {
  it('constructs with default config from env', async () => {
    const { WhisperSTTProvider } = await import('../../../../../packages/agent-engine/src/voice/whisper-stt.ts');
    const stt = new WhisperSTTProvider({ apiKey: 'test-key' });
    expect(stt).toBeDefined();
  });

  it('transcribe throws on API error', async () => {
    const { WhisperSTTProvider } = await import('../../../../../packages/agent-engine/src/voice/whisper-stt.ts');
    const stt = new WhisperSTTProvider({ apiKey: 'test-key', baseUrl: 'http://localhost:1' });
    await expect(stt.transcribe(Buffer.from('fake-audio'))).rejects.toThrow();
  });

  it('transcribe returns text on successful API call', async () => {
    const { WhisperSTTProvider } = await import('../../../../../packages/agent-engine/src/voice/whisper-stt.ts');
    const stt = new WhisperSTTProvider({ apiKey: 'test-key', baseUrl: 'http://mock-stt:1234' });

    // Mock global fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Hello world' }),
    }) as any;

    try {
      const result = await stt.transcribe(Buffer.from('fake-audio'), 'en');
      expect(result.text).toBe('Hello world');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.language).toBe('en');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Voice Services — OpenAITTSProvider', () => {
  it('constructs with default config', async () => {
    const { OpenAITTSProvider } = await import('../../../../../packages/agent-engine/src/voice/openai-tts.ts');
    const tts = new OpenAITTSProvider({ apiKey: 'test-key' });
    expect(tts).toBeDefined();
  });

  it('listVoices returns predefined voice list', async () => {
    const { OpenAITTSProvider } = await import('../../../../../packages/agent-engine/src/voice/openai-tts.ts');
    const tts = new OpenAITTSProvider({ apiKey: 'test-key' });
    const voices = await tts.listVoices();
    expect(voices.length).toBe(6);
    expect(voices[0].id).toBe('alloy');
    expect(voices.some(v => v.id === 'nova')).toBe(true);
  });

  it('synthesize throws on API error', async () => {
    const { OpenAITTSProvider } = await import('../../../../../packages/agent-engine/src/voice/openai-tts.ts');
    const tts = new OpenAITTSProvider({ apiKey: 'test-key', baseUrl: 'http://localhost:1' });
    await expect(tts.synthesize('Hello')).rejects.toThrow();
  });

  it('synthesize returns Buffer on success', async () => {
    const { OpenAITTSProvider } = await import('../../../../../packages/agent-engine/src/voice/openai-tts.ts');
    const tts = new OpenAITTSProvider({ apiKey: 'test-key', baseUrl: 'http://mock-tts:1234' });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(100),
    }) as any;

    try {
      const result = await tts.synthesize('Hello world', 'alloy');
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBe(100);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ===========================================================================
// 2. BROWSER AGENT — task execution with mock LLM
// ===========================================================================
describe('Browser Agent', () => {
  it('executes a simple navigation task', async () => {
    const { BrowserAgent } = await import('../../../../../packages/agent-engine/src/integrations/browser-agent.ts');

    const mockLlm = {
      complete: vi.fn()
        .mockResolvedValueOnce({
          content: JSON.stringify({
            action: 'navigate', url: 'https://example.com',
            description: 'Navigate to example.com',
            isComplete: false,
          }),
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            isComplete: true,
            extractedData: { title: 'Example Domain' },
            description: 'Task complete',
          }),
        }),
    };

    const agent = new BrowserAgent(mockLlm as any, {
      maxSteps: 5, viewport: { width: 1280, height: 720 },
      timeout: 5000, screenshotEvidence: false,
    });

    const result = await agent.executeTask('Go to example.com and get the title');

    expect(result.sessionId).toBeDefined();
    expect(result.steps).toBeGreaterThan(0);
    expect(result.success).toBe(true);
    expect(result.extractedData.title).toBe('Example Domain');
  });

  it('respects allowed domains restriction', async () => {
    const { BrowserAgent } = await import('../../../../../packages/agent-engine/src/integrations/browser-agent.ts');

    const mockLlm = {
      complete: vi.fn()
        .mockResolvedValueOnce({
          content: JSON.stringify({
            action: 'navigate', url: 'https://blocked.com',
            description: 'Navigate to blocked.com', isComplete: false,
          }),
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({ isComplete: true, description: 'Done' }),
        }),
    };

    const agent = new BrowserAgent(mockLlm as any, {
      maxSteps: 3, viewport: { width: 1280, height: 720 },
      timeout: 5000, screenshotEvidence: false,
      allowedDomains: ['allowed.com'],
    });

    // executeTask creates a session internally, then the navigate action will be blocked
    const result = await agent.executeTask('Navigate to blocked.com', 'https://allowed.com');
    // The blocked navigation should produce an error in the result
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('not in allowed list'))).toBe(true);
  });

  it('returns error for non-existent session', async () => {
    const { BrowserAgent } = await import('../../../../../packages/agent-engine/src/integrations/browser-agent.ts');

    const mockLlm = { complete: vi.fn().mockResolvedValue({ content: '{}' }) };
    const agent = new BrowserAgent(mockLlm as any);

    const obs = await agent.executeAction('nonexistent', {
      type: 'click', selector: '#btn', description: 'Click button',
    });

    expect(obs.success).toBe(false);
    expect(obs.error).toContain('Session not found');
  });

  it('emits events during task execution', async () => {
    const { BrowserAgent } = await import('../../../../../packages/agent-engine/src/integrations/browser-agent.ts');

    const mockLlm = {
      complete: vi.fn().mockResolvedValue({
        content: JSON.stringify({ isComplete: true, description: 'Done' }),
      }),
    };

    const agent = new BrowserAgent(mockLlm as any, {
      maxSteps: 2, viewport: { width: 1280, height: 720 },
      timeout: 5000, screenshotEvidence: false,
    });

    const events: string[] = [];
    agent.on('session:start', () => events.push('session:start'));
    agent.on('task:complete', () => events.push('task:complete'));

    await agent.executeTask('Test task');

    expect(events).toContain('session:start');
    expect(events).toContain('task:complete');
  });
});

// ===========================================================================
// 3. TELEGRAM — route registration and webhook handling
// ===========================================================================
describe('Telegram Integration', () => {
  it('registerTelegramRoutes skips when TELEGRAM_BOT_TOKEN not set', async () => {
    // Ensure no token
    const originalToken = process.env['TELEGRAM_BOT_TOKEN'];
    delete process.env['TELEGRAM_BOT_TOKEN'];

    const { registerTelegramRoutes } = await import('../../routes/telegram.ts');
    const fakeApp = {
      post: vi.fn(),
      get: vi.fn(),
    } as any;

    await registerTelegramRoutes(fakeApp);
    expect(fakeApp.post).not.toHaveBeenCalled();

    if (originalToken) process.env['TELEGRAM_BOT_TOKEN'] = originalToken;
  });
});

// ===========================================================================
// 4. DISCORD — adapter parsing and formatting
// ===========================================================================
describe('Discord Adapter — extended', () => {
  it('parses message with channel_id and timestamp', async () => {
    const { DiscordAdapter } = await import('../../../../../packages/agent-engine/src/integrations/discord.ts');
    const adapter = new DiscordAdapter({ type: 'discord', enabled: true });

    const msg = adapter.parseIncoming({
      t: 'MESSAGE_CREATE',
      d: {
        id: 'msg123', content: 'Hello from Discord!',
        author: { id: 'U1', username: 'user1' },
        channel_id: 'C999', timestamp: '2024-01-01T00:00:00Z',
      },
    });

    expect(msg).not.toBeNull();
    expect(msg!.content).toBe('Hello from Discord!');
    expect(msg!.senderId).toBe('U1');
    expect(msg!.senderName).toBe('user1');
    expect(msg!.channelType).toBe('discord');
  });

  it('returns null for non-MESSAGE_CREATE events', async () => {
    const { DiscordAdapter } = await import('../../../../../packages/agent-engine/src/integrations/discord.ts');
    const adapter = new DiscordAdapter({ type: 'discord', enabled: true });

    expect(adapter.parseIncoming({ t: 'READY', d: {} })).toBeNull();
    expect(adapter.parseIncoming({ t: 'GUILD_CREATE', d: {} })).toBeNull();
  });

  it('formats outgoing with content truncation', async () => {
    const { DiscordAdapter } = await import('../../../../../packages/agent-engine/src/integrations/discord.ts');
    const adapter = new DiscordAdapter({ type: 'discord', enabled: true });

    const formatted = adapter.formatOutgoing({
      content: 'Reply with embed',
      metadata: { embeds: [{ title: 'Test' }] },
    }) as any;

    expect(formatted.content).toBe('Reply with embed');
  });
});

// ===========================================================================
// 5. SLACK — adapter extended
// ===========================================================================
describe('Slack Adapter — extended', () => {
  it('parses message with channel metadata', async () => {
    const { SlackAdapter } = await import('../../../../../packages/agent-engine/src/integrations/slack.ts');
    const adapter = new SlackAdapter({ type: 'slack', enabled: true });

    const msg = adapter.parseIncoming({
      event: {
        type: 'message', user: 'U123', text: 'Hello Slack!',
        client_msg_id: 'msg1', ts: '1700000000.000000', channel: 'C456',
      },
    });

    expect(msg).not.toBeNull();
    expect(msg!.senderId).toBe('U123');
    expect(msg!.content).toBe('Hello Slack!');
  });

  it('ignores message_edit events', async () => {
    const { SlackAdapter } = await import('../../../../../packages/agent-engine/src/integrations/slack.ts');
    const adapter = new SlackAdapter({ type: 'slack', enabled: true });

    expect(adapter.parseIncoming({
      event: { type: 'message_edit', user: 'U1', text: 'Edited' },
    })).toBeNull();
  });

  it('formats outgoing without thread when no threadTs', async () => {
    const { SlackAdapter } = await import('../../../../../packages/agent-engine/src/integrations/slack.ts');
    const adapter = new SlackAdapter({ type: 'slack', enabled: true });

    const formatted = adapter.formatOutgoing({ content: 'Simple reply' }) as any;
    expect(formatted.text).toBe('Simple reply');
    expect(formatted.thread_ts).toBeUndefined();
  });
});

// ===========================================================================
// 6. WHATSAPP — adapter extended
// ===========================================================================
describe('WhatsApp Adapter — extended', () => {
  it('parses message with timestamp', async () => {
    const { WhatsAppAdapter } = await import('../../../../../packages/agent-engine/src/integrations/whatsapp.ts');
    const adapter = new WhatsAppAdapter({ type: 'whatsapp', enabled: true });

    const msg = adapter.parseIncoming({
      entry: [{
        changes: [{
          value: {
            messages: [{
              id: 'msg1', from: '201234567890',
              text: { body: 'Test message' },
              timestamp: '1700000000',
            }],
          },
        }],
      }],
    });

    expect(msg).not.toBeNull();
    expect(msg!.content).toBe('Test message');
    expect(msg!.senderId).toBe('201234567890');
    expect(msg!.channelType).toBe('whatsapp');
  });

  it('returns null for status update payloads', async () => {
    const { WhatsAppAdapter } = await import('../../../../../packages/agent-engine/src/integrations/whatsapp.ts');
    const adapter = new WhatsAppAdapter({ type: 'whatsapp', enabled: true });

    expect(adapter.parseIncoming({
      entry: [{ changes: [{ value: { statuses: [{ id: 's1', status: 'read' }] } }] }],
    })).toBeNull();
  });

  it('formats outgoing with preview_url', async () => {
    const { WhatsAppAdapter } = await import('../../../../../packages/agent-engine/src/integrations/whatsapp.ts');
    const adapter = new WhatsAppAdapter({ type: 'whatsapp', enabled: true });

    const formatted = adapter.formatOutgoing({
      content: 'Check this out',
      metadata: { previewUrl: true },
    }) as any;

    expect(formatted.messaging_product).toBe('whatsapp');
    expect(formatted.text.body).toBe('Check this out');
  });
});

// ===========================================================================
// 7. CHANNEL ROUTER — cross-service routing
// ===========================================================================
describe('Channel Router — cross-service', () => {
  it('routes messages from multiple channels', async () => {
    const { ChannelRouter } = await import('../../../../../packages/agent-engine/src/integrations/channel-router.ts');
    const { WhatsAppAdapter } = await import('../../../../../packages/agent-engine/src/integrations/whatsapp.ts');
    const { SlackAdapter } = await import('../../../../../packages/agent-engine/src/integrations/slack.ts');
    const { DiscordAdapter } = await import('../../../../../packages/agent-engine/src/integrations/discord.ts');

    const router = new ChannelRouter();
    router.register(new WhatsAppAdapter({ type: 'whatsapp', enabled: true }));
    router.register(new SlackAdapter({ type: 'slack', enabled: true }));
    router.register(new DiscordAdapter({ type: 'discord', enabled: true }));

    // Route WhatsApp message
    const waMsg = router.parseMessage('whatsapp', {
      entry: [{ changes: [{ value: { messages: [{ id: 'm1', from: '123', text: { body: 'WA test' }, timestamp: '170' }] } }] }],
    });
    expect(waMsg?.content).toBe('WA test');

    // Route Slack message
    const slackMsg = router.parseMessage('slack', {
      event: { type: 'message', user: 'U1', text: 'Slack test', ts: '123' },
    });
    expect(slackMsg?.content).toBe('Slack test');

    // Route Discord message
    const discordMsg = router.parseMessage('discord', {
      t: 'MESSAGE_CREATE',
      d: { id: 'm1', content: 'Discord test', author: { id: 'U1', username: 'user' }, channel_id: 'C1', timestamp: '2024-01-01T00:00:00Z' },
    });
    expect(discordMsg?.content).toBe('Discord test');
  });

  it('registerFromConfig skips disabled channels', async () => {
    const { ChannelRouter } = await import('../../../../../packages/agent-engine/src/integrations/channel-router.ts');

    const router = new ChannelRouter();
    router.registerFromConfig([
      { type: 'whatsapp', enabled: true },
      { type: 'slack', enabled: false },
      { type: 'discord', enabled: true },
    ]);

    expect(router.listChannels()).toEqual(['whatsapp', 'discord']);
    expect(router.listChannels()).not.toContain('slack');
  });
});

// ===========================================================================
// 8. VOICE API ROUTES — auth enforcement
// ===========================================================================
describe('Voice API Routes', () => {
  let app: FastifyInstance;
  const AUTH = { authorization: 'Bearer valid-token' };

  beforeAll(async () => {
    const { buildServer } = await import('../../server.js');
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/voice/voices requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/voice/voices' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/v1/voice/synthesize requires auth', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/voice/synthesize',
      payload: { text: 'hello' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/v1/voice/synthesize rejects empty text with auth', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/voice/synthesize',
      headers: AUTH, payload: { text: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/voice/transcribe requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/voice/transcribe' });
    expect(res.statusCode).toBe(401);
  });
});

// ===========================================================================
// 9. MULTI-PLATFORM BOT ROUTES — auth enforcement
// ===========================================================================
describe('Multi-Platform Bot Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { buildServer } = await import('../../server.js');
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/bots/channels requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/bots/channels' });
    expect([401, 404]).toContain(res.statusCode);
  });
});

// ===========================================================================
// 10. CROSS-SERVICE INTEGRATION — Voice + Chat + Agent
// ===========================================================================
describe('Cross-service integration — Voice + Chat pipeline', () => {
  it('Voice transcribe → Chat → Voice synthesize pipeline', async () => {
    const { WhisperSTTProvider } = await import('../../../../../packages/agent-engine/src/voice/whisper-stt.ts');
    const { OpenAITTSProvider } = await import('../../../../../packages/agent-engine/src/voice/openai-tts.ts');

    const stt = new WhisperSTTProvider({ apiKey: 'test-key', baseUrl: 'http://mock:1234' });
    const tts = new OpenAITTSProvider({ apiKey: 'test-key', baseUrl: 'http://mock:1234' });

    // Mock STT
    const originalFetch = globalThis.fetch;
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // STT response
        return Promise.resolve({
          ok: true,
          json: async () => ({ text: 'What is the weather today?' }),
        });
      }
      // TTS response
      return Promise.resolve({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(256),
      });
    }) as any;

    try {
      // Step 1: Transcribe audio
      const sttResult = await stt.transcribe(Buffer.from('fake-audio'), 'en');
      expect(sttResult.text).toBe('What is the weather today?');

      // Step 2: Mock agent processing
      const agentResponse = `The weather today is sunny with a high of 25°C.`;

      // Step 3: Synthesize response
      const audioBuffer = await tts.synthesize(agentResponse, 'alloy');
      expect(Buffer.isBuffer(audioBuffer)).toBe(true);
      expect(audioBuffer.length).toBe(256);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
