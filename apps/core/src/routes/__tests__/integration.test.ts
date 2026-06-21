/**
 * Integration tests for core API routes.
 *
 * Uses Fastify inject() to exercise the full HTTP pipeline
 * (validation → auth → handler → error handler → serialization)
 * WITHOUT a running server or real database.
 */
import { describe, it, expect, beforeAll, afterAll, vi, type Mock } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Mock heavy infrastructure BEFORE importing the server builder
// ---------------------------------------------------------------------------

// -- database ---------------------------------------------------------------
const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
const mockPool = {
  totalCount: 5,
  idleCount: 3,
  waitingCount: 0,
  query: mockQuery,
};

vi.mock('@titan/database', () => ({
  getPool: () => mockPool,
  ping: () => Promise.resolve(true),
  query: mockQuery,
  verifyTlsOnStartup: Promise.resolve(),
  isTlsVerified: () => true,
  getRetentionInfo: () => Promise.resolve({ retentionDays: 365, oldestEntry: null }),
  audit: {
    write: vi.fn().mockResolvedValue(undefined),
    writeChained: vi.fn().mockResolvedValue(undefined),
  },
  users: {
    findById: vi.fn().mockResolvedValue(null),
    findByEmail: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'u1', email: 'new@test.com', name: 'New User', isActive: true }),
    count: vi.fn().mockResolvedValue(0),
    findFirst: vi.fn().mockResolvedValue(null),
  },
  sessions: {
    create: vi.fn().mockResolvedValue({ id: 's1', userId: 'u1', refreshTokenHash: 'h' }),
    atomicConsumeByHash: vi.fn().mockResolvedValue(null),
    findByRefreshHashIncludingRevoked: vi.fn().mockResolvedValue(null),
    getState: vi.fn().mockResolvedValue(null),
    revoke: vi.fn().mockResolvedValue(undefined),
    revokeAllForUser: vi.fn().mockResolvedValue(undefined),
  },
  apiKeys: {
    findByHash: vi.fn().mockResolvedValue(null),
    touchLastUsed: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue({ id: 'k1', userId: 'u1', name: 'test', keyHash: 'h' }),
    revoke: vi.fn().mockResolvedValue(undefined),
  },
  members: {
    findMembership: vi.fn().mockResolvedValue(null),
  },
  agentRuns: {
    findById: vi.fn(),
    create: vi.fn(),
    listForUser: vi.fn().mockResolvedValue([]),
    listForAgent: vi.fn().mockResolvedValue([]),
    updateStatus: vi.fn(),
  },
  agentSteps: {
    create: vi.fn(),
    listForRun: vi.fn().mockResolvedValue([]),
  },
  agentProfiles: {
    findById: vi.fn(),
    listAll: vi.fn().mockResolvedValue([]),
    upsert: vi.fn(),
    deleteById: vi.fn(),
  },
  userContext: vi.fn().mockResolvedValue({ preferences: {} }),
  getChatHistory: vi.fn().mockResolvedValue([]),
  saveChatMessage: vi.fn().mockResolvedValue(undefined),
  userSecrets: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
  workspaces: {
    findById: vi.fn(),
    listForUser: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
  },
  webhooks: {
    create: vi.fn(),
    findById: vi.fn(),
    listForOwner: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    rotateSecret: vi.fn(),
    delete: vi.fn(),
  },
  plugins: {
    findById: vi.fn(),
    findByName: vi.fn(),
    listAll: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    updateStatus: vi.fn(),
    deleteById: vi.fn(),
  },
  pluginVersions: {
    create: vi.fn(),
    findByPluginAndVersion: vi.fn(),
    listForPlugin: vi.fn().mockResolvedValue([]),
    setPublished: vi.fn(),
    setDeprecated: vi.fn(),
  },
  pluginRatings: {
    upsert: vi.fn(),
    getAverageForPlugin: vi.fn().mockResolvedValue({ avg: 0, count: 0 }),
    listForPlugin: vi.fn().mockResolvedValue([]),
  },
  pluginSearch: {
    search: vi.fn().mockResolvedValue([]),
  },
  closePool: vi.fn(),
}));

// -- queue ------------------------------------------------------------------
vi.mock('@titan/queue', () => ({
  enqueue: vi.fn().mockResolvedValue(undefined),
  QUEUE_NAMES: {
    AGENT_EXECUTE: 'agent:execute',
    TOOL_EXECUTE: 'tool:execute',
    MEMORY_INDEX: 'memory:index',
    MEMORY_RETRIEVE: 'memory:retrieve',
    SANDBOX_EXEC: 'sandbox:exec',
    MONITORING_CHECK: 'monitoring:check',
    AUDIT_WRITE: 'audit:write',
    WEBHOOK_DELIVER: 'webhook:deliver',
  },
  getQueueStats: vi.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }),
  pingRedis: () => Promise.resolve(true),
  verifyAuthOnStartup: Promise.resolve(),
  isAuthVerified: () => true,
  getRedis: () => ({ ping: () => 'PONG', info: () => 'used_memory:1024' }),
}));

// -- auth -------------------------------------------------------------------
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';
const MOCK_SESSION_ID = '00000000-0000-0000-0000-000000000099';

vi.mock('@titan/auth', () => ({
  registerUser: vi.fn().mockResolvedValue({
    user: { id: MOCK_USER_ID, email: 'test@test.com', name: 'Test User' },
    tokens: { accessToken: 'at_mock', refreshToken: 'rt_mock', expiresIn: 900 },
  }),
  loginUser: vi.fn().mockResolvedValue({
    user: { id: MOCK_USER_ID, email: 'test@test.com', name: 'Test User' },
    tokens: { accessToken: 'at_mock', refreshToken: 'rt_mock', expiresIn: 900 },
  }),
  refreshTokens: vi.fn().mockResolvedValue({
    accessToken: 'at_new',
    refreshToken: 'rt_new',
  }),
  logout: vi.fn().mockResolvedValue(undefined),
  logoutAllForUser: vi.fn().mockResolvedValue(undefined),
  resolveAuthFromAccessToken: vi.fn().mockResolvedValue({
    userId: MOCK_USER_ID,
    sessionId: MOCK_SESSION_ID,
    permissions: [
      'workspace:read', 'workspace:write', 'workspace:delete', 'workspace:admin',
      'agent:read', 'agent:write', 'agent:execute',
      'tool:read', 'tool:execute',
      'memory:read', 'memory:write',
      'sandbox:read', 'sandbox:execute',
      'monitoring:read', 'audit:read',
    ],
  }),
  resolveAuthFromApiKey: vi.fn(),
  hasPermission: vi.fn().mockReturnValue(true),
  canAssignRole: vi.fn().mockReturnValue(true),
  isValidRole: vi.fn().mockReturnValue(true),
  getPermissionsForRole: vi.fn().mockReturnValue([]),
}));

// -- memory -----------------------------------------------------------------
vi.mock('@titan/memory', () => ({
  getGlobalMemoryClient: vi.fn().mockResolvedValue({
    search: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockResolvedValue(undefined),
  }),
  KnowledgeBase: class MockKnowledgeBase {
    addDocument = vi.fn().mockResolvedValue(undefined);
    search = vi.fn().mockResolvedValue([]);
    getDocument = vi.fn().mockResolvedValue(null);
    deleteDocument = vi.fn().mockResolvedValue(true);
    listDocuments = vi.fn().mockResolvedValue([]);
    stats = vi.fn().mockReturnValue({ documentCount: 0, totalChunks: 0 });
  },
}));

// -- observability ----------------------------------------------------------
vi.mock('@titan/observability', () => ({
  getAbuseDetector: () => ({
    isBlocked: () => false,
    record: () => {},
  }),
  snapshot: () => ({}),
  renderPrometheus: () => '',
  observeHistogram: vi.fn(),
  incCounter: vi.fn(),
  recordRateLimitHit: vi.fn(),
  recordAuthFailureHybrid: vi.fn(),
  recordBruteForcePattern: vi.fn(),
}));

// -- agent engine -----------------------------------------------------------
vi.mock('@titan/agent-engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@titan/agent-engine')>();
  return {
    ...actual,
    createProviderFromEnv: vi.fn().mockReturnValue({
      complete: vi.fn().mockResolvedValue({ content: 'mock response', toolCalls: [] }),
    }),
    AgentRunner: vi.fn().mockImplementation(() => ({
      run: vi.fn().mockResolvedValue({
        id: 'run-1', agentId: 'agent-1', prompt: 'test', status: 'completed',
        maxSteps: 10, currentStep: 1, tokensUsed: 100, steps: [],
        createdAt: new Date(), updatedAt: new Date(),
      }),
    })),
    getGlobalToolRegistry: vi.fn().mockReturnValue({
      execute: vi.fn().mockResolvedValue({ success: true, data: 'ok' }),
      list: vi.fn().mockReturnValue([]),
      size: 0,
    }),
    getGlobalPluginRunner: vi.fn().mockReturnValue({
      load: vi.fn(),
      unload: vi.fn(),
      getTools: vi.fn().mockReturnValue([]),
      listPlugins: vi.fn().mockReturnValue([]),
    }),
  };
});

// -- misc -------------------------------------------------------------------
vi.mock('../../audit-scheduler.js', () => ({
  getLastVerifyResult: () => null,
  getLastArchiveResult: () => null,
}));
vi.mock('../../swarm-store.js', () => ({
  storeSwarmTask: vi.fn(),
  getSwarmTask: vi.fn(),
  listSwarmTasks: vi.fn().mockReturnValue([]),
}));
vi.mock('../../plugins/hybrid-rate-limit.js', () => ({
  hybridKeyGenerator: () => (req: { ip?: string }) => req.ip ?? 'test',
  recordRateLimitHit: vi.fn(),
}));

// ===========================================================================
// Import the server builder AFTER mocks are in place
// ===========================================================================
const { buildServer } = await import('../../server.js');

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

// ===========================================================================
// HEALTH ROUTES
// ===========================================================================
describe('Health routes', () => {
  it('GET /api/v1/health/live returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health/live' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('live');
    expect(body.timestamp).toBeDefined();
  });

  it('GET /api/v1/health/ready returns 200 with checks', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health/ready' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ready');
    expect(body.checks).toBeDefined();
    expect(body.checks.postgres).toBeDefined();
    expect(body.checks.redis).toBeDefined();
  });

  it('GET /api/v1/health/dashboard requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health/dashboard' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/v1/health/dashboard returns data with auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health/dashboard',
      headers: { authorization: 'Bearer valid-token' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.dbPool).toBeDefined();
    expect(body.queues).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });
});

// ===========================================================================
// AUTH ROUTES
// ===========================================================================
describe('Auth routes', () => {
  it('POST /api/v1/auth/register creates a user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'new@test.com', password: 'SuperSecure123!', name: 'New User' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user).toBeDefined();
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
  });

  it('POST /api/v1/auth/register rejects invalid email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'not-an-email', password: '12345678', name: 'Bad' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/auth/login returns tokens', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'test@test.com', password: 'password123' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
  });

  it('POST /api/v1/auth/refresh rotates tokens', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: 'rt_mock' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBe('at_new');
    expect(body.refreshToken).toBe('rt_new');
  });

  it('GET /api/v1/auth/me requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/v1/auth/me returns user info with auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: 'Bearer valid-token' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.userId).toBe(MOCK_USER_ID);
    expect(body.permissions).toBeDefined();
  });

  it('POST /api/v1/auth/logout requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/logout' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/v1/auth/logout works with auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { authorization: 'Bearer valid-token' },
    });
    expect(res.statusCode).toBe(204);
  });
});

// ===========================================================================
// METRICS ROUTES
// ===========================================================================
describe('Metrics routes', () => {
  it('GET /metrics requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/v1/metrics.json requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/metrics.json' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/v1/admin/queues/:name/stats requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/queues/agent:execute/stats' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/v1/admin/queues/:name/stats returns data with auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/queues/agent:execute/stats',
      headers: { authorization: 'Bearer valid-token' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('waiting');
    expect(body).toHaveProperty('active');
  });
});

// ===========================================================================
// AGENT ROUTES — IDOR protection
// ===========================================================================
describe('Agent routes — IDOR protection', () => {
  it('GET /api/v1/agents/:agentId/runs/:runId returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/agents/a1/runs/r1' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/v1/agents/:agentId/runs/:runId returns run for owner', async () => {
    const { agentRuns } = await import('@titan/database');
    (agentRuns.findById as Mock).mockResolvedValueOnce({
      id: 'r1',
      agentId: 'a1',
      userId: MOCK_USER_ID,
      status: 'completed',
      prompt: 'test',
      maxSteps: 10,
      currentStep: 1,
      tokensUsed: 50,
      tokenBudget: null,
      forbiddenTools: [],
      finalAnswer: 'done',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/agents/a1/runs/r1',
      headers: { authorization: 'Bearer valid-token' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe('r1');
  });

  it('GET /api/v1/agents/:agentId/runs/:runId blocks access to other user run', async () => {
    const { agentRuns } = await import('@titan/database');
    (agentRuns.findById as Mock).mockResolvedValueOnce({
      id: 'r2',
      agentId: 'a1',
      userId: 'OTHER-USER-ID',
      status: 'completed',
      prompt: 'secret',
      maxSteps: 10,
      currentStep: 1,
      tokensUsed: 50,
      tokenBudget: null,
      forbiddenTools: [],
      finalAnswer: 'secret answer',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/agents/a1/runs/r2',
      headers: { authorization: 'Bearer valid-token' },
    });
    // Should be blocked — user doesn't own this run
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('GET /api/v1/agents/:agentId/runs/:runId returns 400 for non-existent run', async () => {
    const { agentRuns } = await import('@titan/database');
    (agentRuns.findById as Mock).mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/agents/a1/runs/nonexistent',
      headers: { authorization: 'Bearer valid-token' },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});

// ===========================================================================
// ERROR HANDLING
// ===========================================================================
describe('Error handling', () => {
  it('returns RFC 7807 problem for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/nonexistent' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.type).toContain('not-found');
    expect(body.code).toBe('E3001');
    expect(body.status).toBe(404);
  });
});
