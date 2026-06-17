import { describe, it, expect } from 'vitest';
import {
  LoginInputSchema,
  RegisterInputSchema,
  RefreshInputSchema,
  CreateApiKeyInputSchema,
  CreateWorkspaceInputSchema,
  UpdateWorkspaceInputSchema,
  AddMemberInputSchema,
  PaginationInputSchema,
  PaginatedResponseSchema,
  UuidSchema,
  IsoDateSchema,
  ExecuteBashInputSchema,
  PatchFileInputSchema,
  ReadFileInputSchema,
  ReadFileAstInputSchema,
  FirecrawlScrapeInputSchema,
  GitPushInputSchema,
  DockerOrchestratorInputSchema,
  ToolInputSchema,
} from './schemas.js';
import { z } from 'zod';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function expectSuccess(schema: z.ZodTypeAny, data: unknown) {
  const result = schema.safeParse(data);
  expect(result.success).toBe(true);
  return result as z.SafeParseSuccess<unknown>;
}

function expectFailure(schema: z.ZodTypeAny, data: unknown) {
  const result = schema.safeParse(data);
  expect(result.success).toBe(false);
  return result as z.SafeParseError<unknown>;
}

/* ------------------------------------------------------------------ */
/*  Auth schemas                                                       */
/* ------------------------------------------------------------------ */

describe('LoginInputSchema', () => {
  it('accepts valid email and password', () => {
    expectSuccess(LoginInputSchema, { email: 'user@example.com', password: 'securepass' });
  });

  it('rejects invalid email', () => {
    expectFailure(LoginInputSchema, { email: 'not-an-email', password: 'securepass' });
  });

  it('rejects password shorter than 8 chars', () => {
    expectFailure(LoginInputSchema, { email: 'user@example.com', password: 'short' });
  });

  it('rejects password longer than 256 chars', () => {
    expectFailure(LoginInputSchema, { email: 'user@example.com', password: 'a'.repeat(257) });
  });

  it('rejects email longer than 255 chars', () => {
    const longEmail = 'a'.repeat(246) + '@test.com'; // 255 chars
    // Exactly at boundary should pass
    expectSuccess(LoginInputSchema, { email: longEmail, password: 'securepass' });
    // Over boundary
    const overEmail = 'a'.repeat(247) + '@test.com'; // 256 chars
    expectFailure(LoginInputSchema, { email: overEmail, password: 'securepass' });
  });
});

describe('RegisterInputSchema', () => {
  it('accepts valid input', () => {
    expectSuccess(RegisterInputSchema, {
      email: 'new@example.com',
      password: 'password123',
      name: 'Test User',
    });
  });

  it('rejects missing name', () => {
    expectFailure(RegisterInputSchema, { email: 'new@example.com', password: 'password123' });
  });

  it('rejects empty name', () => {
    expectFailure(RegisterInputSchema, {
      email: 'new@example.com',
      password: 'password123',
      name: '',
    });
  });

  it('rejects name over 100 chars', () => {
    expectFailure(RegisterInputSchema, {
      email: 'new@example.com',
      password: 'password123',
      name: 'a'.repeat(101),
    });
  });
});

describe('RefreshInputSchema', () => {
  it('accepts non-empty refresh token', () => {
    expectSuccess(RefreshInputSchema, { refreshToken: 'some-token-value' });
  });

  it('rejects empty refresh token', () => {
    expectFailure(RefreshInputSchema, { refreshToken: '' });
  });
});

/* ------------------------------------------------------------------ */
/*  API Key schemas                                                    */
/* ------------------------------------------------------------------ */

describe('CreateApiKeyInputSchema', () => {
  it('accepts valid input with required fields only', () => {
    const result = expectSuccess(CreateApiKeyInputSchema, { name: 'My Key' });
    expect((result.data as Record<string, unknown>).scopes).toEqual([]);
  });

  it('accepts all optional fields', () => {
    expectSuccess(CreateApiKeyInputSchema, {
      name: 'Deploy Key',
      workspaceId: '550e8400-e29b-41d4-a716-446655440000',
      expiresAt: '2025-12-31T23:59:59Z',
      scopes: ['workspace:read', 'agent:execute'],
    });
  });

  it('rejects empty name', () => {
    expectFailure(CreateApiKeyInputSchema, { name: '' });
  });

  it('rejects name over 100 chars', () => {
    expectFailure(CreateApiKeyInputSchema, { name: 'x'.repeat(101) });
  });

  it('rejects invalid workspace UUID', () => {
    expectFailure(CreateApiKeyInputSchema, { name: 'k', workspaceId: 'not-a-uuid' });
  });

  it('rejects invalid datetime for expiresAt', () => {
    expectFailure(CreateApiKeyInputSchema, { name: 'k', expiresAt: 'next-tuesday' });
  });

  it('rejects invalid scope values', () => {
    expectFailure(CreateApiKeyInputSchema, { name: 'k', scopes: ['invalid:scope'] });
  });

  it('rejects more than 50 scopes', () => {
    const scopes = Array(51).fill('workspace:read');
    expectFailure(CreateApiKeyInputSchema, { name: 'k', scopes });
  });
});

/* ------------------------------------------------------------------ */
/*  Workspace schemas                                                  */
/* ------------------------------------------------------------------ */

describe('CreateWorkspaceInputSchema', () => {
  it('accepts valid workspace', () => {
    expectSuccess(CreateWorkspaceInputSchema, {
      name: 'My Workspace',
      slug: 'my-workspace',
    });
  });

  it('accepts optional description', () => {
    expectSuccess(CreateWorkspaceInputSchema, {
      name: 'My Workspace',
      slug: 'my-workspace',
      description: 'A workspace for testing',
    });
  });

  it('rejects slug with uppercase', () => {
    expectFailure(CreateWorkspaceInputSchema, {
      name: 'Test',
      slug: 'MySlug',
    });
  });

  it('rejects slug with special characters', () => {
    expectFailure(CreateWorkspaceInputSchema, {
      name: 'Test',
      slug: 'my_slug!',
    });
  });

  it('accepts slug with hyphens and numbers', () => {
    expectSuccess(CreateWorkspaceInputSchema, {
      name: 'Test',
      slug: 'my-workspace-2',
    });
  });

  it('rejects empty name', () => {
    expectFailure(CreateWorkspaceInputSchema, { name: '', slug: 'valid' });
  });

  it('rejects description over 500 chars', () => {
    expectFailure(CreateWorkspaceInputSchema, {
      name: 'Test',
      slug: 'valid',
      description: 'x'.repeat(501),
    });
  });
});

describe('UpdateWorkspaceInputSchema', () => {
  it('accepts partial update with name only', () => {
    expectSuccess(UpdateWorkspaceInputSchema, { name: 'New Name' });
  });

  it('accepts partial update with description only', () => {
    expectSuccess(UpdateWorkspaceInputSchema, { description: 'Updated description' });
  });

  it('accepts empty object', () => {
    expectSuccess(UpdateWorkspaceInputSchema, {});
  });

  it('rejects name over 100 chars', () => {
    expectFailure(UpdateWorkspaceInputSchema, { name: 'a'.repeat(101) });
  });
});

describe('AddMemberInputSchema', () => {
  it('accepts valid member addition', () => {
    expectSuccess(AddMemberInputSchema, {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      role: 'member',
    });
  });

  it('accepts all valid roles', () => {
    for (const role of ['owner', 'admin', 'member', 'viewer']) {
      expectSuccess(AddMemberInputSchema, {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        role,
      });
    }
  });

  it('rejects invalid role', () => {
    expectFailure(AddMemberInputSchema, {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      role: 'superuser',
    });
  });

  it('rejects non-UUID userId', () => {
    expectFailure(AddMemberInputSchema, { userId: 'abc', role: 'member' });
  });
});

/* ------------------------------------------------------------------ */
/*  Pagination schemas                                                 */
/* ------------------------------------------------------------------ */

describe('PaginationInputSchema', () => {
  it('applies defaults when no input given', () => {
    const result = expectSuccess(PaginationInputSchema, {});
    expect((result.data as Record<string, unknown>).limit).toBe(20);
  });

  it('coerces string limit to number', () => {
    const result = expectSuccess(PaginationInputSchema, { limit: '50' });
    expect((result.data as Record<string, unknown>).limit).toBe(50);
  });

  it('rejects limit over 100', () => {
    expectFailure(PaginationInputSchema, { limit: 101 });
  });

  it('rejects limit of 0', () => {
    expectFailure(PaginationInputSchema, { limit: 0 });
  });

  it('accepts valid cursor', () => {
    expectSuccess(PaginationInputSchema, { cursor: '550e8400-e29b-41d4-a716-446655440000' });
  });

  it('rejects non-UUID cursor', () => {
    expectFailure(PaginationInputSchema, { cursor: 'not-a-uuid' });
  });
});

describe('PaginatedResponseSchema', () => {
  it('validates a paginated response of strings', () => {
    const schema = PaginatedResponseSchema(z.string());
    expectSuccess(schema, { items: ['a', 'b'], nextCursor: null, total: 2 });
  });

  it('rejects negative total', () => {
    const schema = PaginatedResponseSchema(z.string());
    expectFailure(schema, { items: [], nextCursor: null, total: -1 });
  });

  it('validates nextCursor as nullable string', () => {
    const schema = PaginatedResponseSchema(z.number());
    expectSuccess(schema, { items: [1], nextCursor: 'abc-cursor', total: 1 });
    expectSuccess(schema, { items: [1], nextCursor: null, total: 1 });
  });

  it('rejects items of wrong type', () => {
    const schema = PaginatedResponseSchema(z.number());
    expectFailure(schema, { items: ['not-a-number'], nextCursor: null, total: 1 });
  });
});

/* ------------------------------------------------------------------ */
/*  Simple value schemas                                               */
/* ------------------------------------------------------------------ */

describe('UuidSchema', () => {
  it('accepts a valid UUID', () => {
    expectSuccess(UuidSchema, '550e8400-e29b-41d4-a716-446655440000');
  });

  it('rejects a non-UUID string', () => {
    expectFailure(UuidSchema, 'not-a-uuid');
  });

  it('rejects an empty string', () => {
    expectFailure(UuidSchema, '');
  });
});

describe('IsoDateSchema', () => {
  it('accepts a valid ISO datetime', () => {
    expectSuccess(IsoDateSchema, '2025-12-31T23:59:59Z');
  });

  it('rejects an arbitrary string', () => {
    expectFailure(IsoDateSchema, 'tomorrow');
  });
});

/* ------------------------------------------------------------------ */
/*  ExecuteBashInputSchema                                             */
/* ------------------------------------------------------------------ */

describe('ExecuteBashInputSchema', () => {
  it('accepts a valid command with defaults', () => {
    const result = expectSuccess(ExecuteBashInputSchema, { command: 'echo hello' });
    const data = result.data as Record<string, unknown>;
    expect(data.timeoutMs).toBe(10_000);
  });

  it('rejects an empty command', () => {
    expectFailure(ExecuteBashInputSchema, { command: '' });
  });

  it('rejects a command over max length (4000)', () => {
    expectFailure(ExecuteBashInputSchema, { command: 'x'.repeat(4001) });
  });

  it('accepts command at exactly max length', () => {
    expectSuccess(ExecuteBashInputSchema, { command: 'x'.repeat(4000) });
  });

  it('accepts optional cwd', () => {
    const result = expectSuccess(ExecuteBashInputSchema, {
      command: 'ls',
      cwd: '/home/user',
    });
    expect((result.data as Record<string, unknown>).cwd).toBe('/home/user');
  });

  it('rejects cwd over 500 chars', () => {
    expectFailure(ExecuteBashInputSchema, { command: 'ls', cwd: '/'.repeat(501) });
  });

  it('accepts optional env as string record', () => {
    expectSuccess(ExecuteBashInputSchema, {
      command: 'ls',
      env: { PATH: '/usr/bin', HOME: '/root' },
    });
  });

  it('rejects env with non-string values', () => {
    expectFailure(ExecuteBashInputSchema, {
      command: 'ls',
      env: { COUNT: 42 },
    });
  });

  it('accepts custom timeoutMs within range', () => {
    const result = expectSuccess(ExecuteBashInputSchema, {
      command: 'sleep 5',
      timeoutMs: 30_000,
    });
    expect((result.data as Record<string, unknown>).timeoutMs).toBe(30_000);
  });

  it('rejects timeoutMs over max (60000)', () => {
    expectFailure(ExecuteBashInputSchema, { command: 'ls', timeoutMs: 60_001 });
  });

  it('rejects timeoutMs under min (100)', () => {
    expectFailure(ExecuteBashInputSchema, { command: 'ls', timeoutMs: 50 });
  });

  it('rejects non-integer timeoutMs', () => {
    expectFailure(ExecuteBashInputSchema, { command: 'ls', timeoutMs: 500.5 });
  });

  it('accepts timeoutMs at boundaries', () => {
    expectSuccess(ExecuteBashInputSchema, { command: 'ls', timeoutMs: 100 });
    expectSuccess(ExecuteBashInputSchema, { command: 'ls', timeoutMs: 60_000 });
  });

  it('accepts optional useSandbox boolean', () => {
    expectSuccess(ExecuteBashInputSchema, { command: 'ls', useSandbox: true });
    expectSuccess(ExecuteBashInputSchema, { command: 'ls', useSandbox: false });
  });
});

/* ------------------------------------------------------------------ */
/*  PatchFileInputSchema                                               */
/* ------------------------------------------------------------------ */

describe('PatchFileInputSchema', () => {
  it('accepts a valid file path and patch', () => {
    expectSuccess(PatchFileInputSchema, {
      filePath: '/src/index.ts',
      patch: '--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1 +1 @@\n-old\n+new',
    });
  });

  it('rejects empty filePath', () => {
    expectFailure(PatchFileInputSchema, { filePath: '', patch: 'some patch' });
  });

  it('rejects empty patch', () => {
    expectFailure(PatchFileInputSchema, { filePath: '/file.ts', patch: '' });
  });

  it('rejects filePath over 500 chars', () => {
    expectFailure(PatchFileInputSchema, { filePath: 'a'.repeat(501), patch: 'patch' });
  });

  it('rejects patch over max length (50000)', () => {
    expectFailure(PatchFileInputSchema, { filePath: '/file.ts', patch: 'x'.repeat(50_001) });
  });

  it('accepts patch at exactly max length', () => {
    expectSuccess(PatchFileInputSchema, { filePath: '/file.ts', patch: 'x'.repeat(50_000) });
  });
});

/* ------------------------------------------------------------------ */
/*  ReadFileInputSchema                                                */
/* ------------------------------------------------------------------ */

describe('ReadFileInputSchema', () => {
  it('accepts valid input with defaults', () => {
    const result = expectSuccess(ReadFileInputSchema, { filePath: '/src/app.ts' });
    const data = result.data as Record<string, unknown>;
    expect(data.offset).toBe(0);
    expect(data.limit).toBe(500);
  });

  it('rejects empty filePath', () => {
    expectFailure(ReadFileInputSchema, { filePath: '' });
  });

  it('rejects filePath over 500 chars', () => {
    expectFailure(ReadFileInputSchema, { filePath: 'a'.repeat(501) });
  });

  it('accepts custom offset and limit', () => {
    const result = expectSuccess(ReadFileInputSchema, {
      filePath: '/file.ts',
      offset: 100,
      limit: 200,
    });
    const data = result.data as Record<string, unknown>;
    expect(data.offset).toBe(100);
    expect(data.limit).toBe(200);
  });

  it('rejects negative offset', () => {
    expectFailure(ReadFileInputSchema, { filePath: '/file.ts', offset: -1 });
  });

  it('rejects zero limit', () => {
    expectFailure(ReadFileInputSchema, { filePath: '/file.ts', limit: 0 });
  });

  it('rejects limit over max (10000)', () => {
    expectFailure(ReadFileInputSchema, { filePath: '/file.ts', limit: 10_001 });
  });

  it('accepts limit at max boundary', () => {
    expectSuccess(ReadFileInputSchema, { filePath: '/file.ts', limit: 10_000 });
  });

  it('rejects non-integer offset', () => {
    expectFailure(ReadFileInputSchema, { filePath: '/file.ts', offset: 1.5 });
  });

  it('rejects non-integer limit', () => {
    expectFailure(ReadFileInputSchema, { filePath: '/file.ts', limit: 2.5 });
  });

  it('rejects string type for offset', () => {
    expectFailure(ReadFileInputSchema, { filePath: '/file.ts', offset: 'abc' });
  });

  it('rejects string type for limit', () => {
    expectFailure(ReadFileInputSchema, { filePath: '/file.ts', limit: 'abc' });
  });
});

/* ------------------------------------------------------------------ */
/*  ReadFileAstInputSchema                                             */
/* ------------------------------------------------------------------ */

describe('ReadFileAstInputSchema', () => {
  it('accepts valid file path', () => {
    expectSuccess(ReadFileAstInputSchema, { filePath: '/src/component.tsx' });
  });

  it('rejects empty filePath', () => {
    expectFailure(ReadFileAstInputSchema, { filePath: '' });
  });

  it('rejects filePath over 500 chars', () => {
    expectFailure(ReadFileAstInputSchema, { filePath: 'a'.repeat(501) });
  });
});

/* ------------------------------------------------------------------ */
/*  FirecrawlScrapeInputSchema                                         */
/* ------------------------------------------------------------------ */

describe('FirecrawlScrapeInputSchema', () => {
  it('accepts a valid URL with defaults', () => {
    const result = expectSuccess(FirecrawlScrapeInputSchema, { url: 'https://example.com' });
    const data = result.data as Record<string, unknown>;
    expect(data.timeoutMs).toBe(10_000);
  });

  it('accepts URL with path and query', () => {
    expectSuccess(FirecrawlScrapeInputSchema, {
      url: 'https://example.com/page?q=test#anchor',
    });
  });

  it('rejects an invalid URL', () => {
    expectFailure(FirecrawlScrapeInputSchema, { url: 'not-a-url' });
  });

  it('rejects an empty string', () => {
    expectFailure(FirecrawlScrapeInputSchema, { url: '' });
  });

  it('accepts custom timeoutMs', () => {
    const result = expectSuccess(FirecrawlScrapeInputSchema, {
      url: 'https://example.com',
      timeoutMs: 20_000,
    });
    expect((result.data as Record<string, unknown>).timeoutMs).toBe(20_000);
  });

  it('rejects timeoutMs over max (30000)', () => {
    expectFailure(FirecrawlScrapeInputSchema, {
      url: 'https://example.com',
      timeoutMs: 30_001,
    });
  });

  it('rejects timeoutMs under min (100)', () => {
    expectFailure(FirecrawlScrapeInputSchema, {
      url: 'https://example.com',
      timeoutMs: 50,
    });
  });

  it('accepts optional headers', () => {
    expectSuccess(FirecrawlScrapeInputSchema, {
      url: 'https://example.com',
      headers: { Authorization: 'Bearer token' },
    });
  });

  it('rejects headers with non-string values', () => {
    expectFailure(FirecrawlScrapeInputSchema, {
      url: 'https://example.com',
      headers: { 'X-Count': 5 },
    });
  });
});

/* ------------------------------------------------------------------ */
/*  GitPushInputSchema                                                 */
/* ------------------------------------------------------------------ */

describe('GitPushInputSchema', () => {
  it('accepts valid input with cwd only', () => {
    expectSuccess(GitPushInputSchema, { cwd: '/repo' });
  });

  it('accepts all optional fields', () => {
    expectSuccess(GitPushInputSchema, {
      cwd: '/repo',
      commitMessage: 'feat: add feature',
      remote: 'origin',
      branch: 'main',
      addAll: true,
      files: ['src/index.ts'],
      skipCommit: false,
      skipPush: false,
      createTag: 'v1.0.0',
    });
  });

  it('rejects empty cwd', () => {
    expectFailure(GitPushInputSchema, { cwd: '' });
  });

  it('rejects cwd over 500 chars', () => {
    expectFailure(GitPushInputSchema, { cwd: 'a'.repeat(501) });
  });

  it('rejects commitMessage over 1000 chars', () => {
    expectFailure(GitPushInputSchema, { cwd: '/repo', commitMessage: 'x'.repeat(1001) });
  });
});

/* ------------------------------------------------------------------ */
/*  DockerOrchestratorInputSchema                                      */
/* ------------------------------------------------------------------ */

describe('DockerOrchestratorInputSchema', () => {
  it('accepts each valid action', () => {
    for (const action of ['run', 'stop', 'remove', 'list', 'logs', 'exec']) {
      expectSuccess(DockerOrchestratorInputSchema, { action });
    }
  });

  it('rejects an invalid action', () => {
    expectFailure(DockerOrchestratorInputSchema, { action: 'restart' });
  });

  it('rejects missing action', () => {
    expectFailure(DockerOrchestratorInputSchema, {});
  });

  it('accepts optional containerName', () => {
    expectSuccess(DockerOrchestratorInputSchema, {
      action: 'run',
      containerName: 'my-container',
    });
  });

  it('rejects containerName over 200 chars', () => {
    expectFailure(DockerOrchestratorInputSchema, {
      action: 'run',
      containerName: 'x'.repeat(201),
    });
  });

  it('accepts optional image', () => {
    expectSuccess(DockerOrchestratorInputSchema, {
      action: 'run',
      image: 'node:18-alpine',
    });
  });

  it('accepts optional command', () => {
    expectSuccess(DockerOrchestratorInputSchema, {
      action: 'exec',
      command: 'npm install',
    });
  });

  it('rejects command over 2000 chars', () => {
    expectFailure(DockerOrchestratorInputSchema, {
      action: 'exec',
      command: 'x'.repeat(2001),
    });
  });

  it('accepts optional env record', () => {
    expectSuccess(DockerOrchestratorInputSchema, {
      action: 'run',
      env: { NODE_ENV: 'production' },
    });
  });

  it('accepts optional ports record', () => {
    expectSuccess(DockerOrchestratorInputSchema, {
      action: 'run',
      ports: { '3000': '3000', '8080': '80' },
    });
  });

  it('accepts optional volumes array', () => {
    expectSuccess(DockerOrchestratorInputSchema, {
      action: 'run',
      volumes: ['/host/path:/container/path'],
    });
  });

  it('rejects volume entry over 500 chars', () => {
    expectFailure(DockerOrchestratorInputSchema, {
      action: 'run',
      volumes: ['x'.repeat(501)],
    });
  });

  it('accepts a full run configuration', () => {
    expectSuccess(DockerOrchestratorInputSchema, {
      action: 'run',
      containerName: 'web',
      image: 'nginx:latest',
      command: 'nginx -g "daemon off;"',
      env: { NGINX_HOST: 'localhost' },
      ports: { '80': '8080' },
      volumes: ['/data:/usr/share/nginx/html'],
    });
  });
});

/* ------------------------------------------------------------------ */
/*  ToolInputSchema (discriminated union)                              */
/* ------------------------------------------------------------------ */

describe('ToolInputSchema', () => {
  it('routes execute_bash to ExecuteBashInputSchema', () => {
    const result = expectSuccess(ToolInputSchema, {
      tool: 'execute_bash',
      params: { command: 'echo hello' },
    });
    const data = result.data as { tool: string; params: Record<string, unknown> };
    expect(data.tool).toBe('execute_bash');
    expect(data.params.command).toBe('echo hello');
    expect(data.params.timeoutMs).toBe(10_000); // default
  });

  it('validates execute_bash params (rejects empty command)', () => {
    expectFailure(ToolInputSchema, {
      tool: 'execute_bash',
      params: { command: '' },
    });
  });

  it('routes patch_file to PatchFileInputSchema', () => {
    expectSuccess(ToolInputSchema, {
      tool: 'patch_file',
      params: { filePath: '/src/file.ts', patch: 'diff content' },
    });
  });

  it('validates patch_file params (rejects empty patch)', () => {
    expectFailure(ToolInputSchema, {
      tool: 'patch_file',
      params: { filePath: '/file.ts', patch: '' },
    });
  });

  it('routes read_file to ReadFileInputSchema', () => {
    const result = expectSuccess(ToolInputSchema, {
      tool: 'read_file',
      params: { filePath: '/src/app.ts' },
    });
    const data = result.data as { params: Record<string, unknown> };
    expect(data.params.offset).toBe(0);
    expect(data.params.limit).toBe(500);
  });

  it('routes read_file_ast to ReadFileAstInputSchema', () => {
    expectSuccess(ToolInputSchema, {
      tool: 'read_file_ast',
      params: { filePath: '/src/index.ts' },
    });
  });

  it('routes firecrawl_scrape to FirecrawlScrapeInputSchema', () => {
    expectSuccess(ToolInputSchema, {
      tool: 'firecrawl_scrape',
      params: { url: 'https://example.com' },
    });
  });

  it('validates firecrawl_scrape params (rejects bad URL)', () => {
    expectFailure(ToolInputSchema, {
      tool: 'firecrawl_scrape',
      params: { url: 'not-a-url' },
    });
  });

  it('routes docker_orchestrator to DockerOrchestratorInputSchema', () => {
    expectSuccess(ToolInputSchema, {
      tool: 'docker_orchestrator',
      params: { action: 'list' },
    });
  });

  it('validates docker_orchestrator params (rejects invalid action)', () => {
    expectFailure(ToolInputSchema, {
      tool: 'docker_orchestrator',
      params: { action: 'destroy' },
    });
  });

  it('routes git_push to GitPushInputSchema', () => {
    expectSuccess(ToolInputSchema, {
      tool: 'git_push',
      params: { cwd: '/repo' },
    });
  });

  it('rejects an unknown tool name', () => {
    expectFailure(ToolInputSchema, {
      tool: 'unknown_tool',
      params: {},
    });
  });

  it('rejects missing tool field', () => {
    expectFailure(ToolInputSchema, { params: { command: 'ls' } });
  });

  it('rejects missing params field', () => {
    expectFailure(ToolInputSchema, { tool: 'execute_bash' });
  });
});
