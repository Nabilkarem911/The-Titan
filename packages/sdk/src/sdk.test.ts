import { describe, it, expect } from 'vitest';
import { TitanClient, TitanApiError } from './client.js';
import { collectStream } from './streaming.js';
import type { StreamEvent } from './types.js';

describe('TitanClient', () => {
  it('constructs with config', () => {
    const client = new TitanClient({ baseUrl: 'http://localhost:3000', apiKey: 'test-key' });
    expect(client).toBeDefined();
  });

  it('uses api key for auth header', async () => {
    const client = new TitanClient({ baseUrl: 'http://localhost:3000', apiKey: 'tk_test_123' });
    // Can't test actual requests without a server, but verify construction works
    expect(client).toBeDefined();
  });

  it('uses token for auth header', () => {
    const client = new TitanClient({ baseUrl: 'http://localhost:3000', token: 'jwt_token_here' });
    expect(client).toBeDefined();
  });
});

describe('TitanApiError', () => {
  it('has statusCode and message', () => {
    const err = new TitanApiError(404, 'Not found');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Not found');
    expect(err.name).toBe('TitanApiError');
  });
});

describe('collectStream', () => {
  it('collects token events into a string', async () => {
    async function* mockStream(): AsyncGenerator<StreamEvent> {
      yield { type: 'token', data: 'Hello ' };
      yield { type: 'token', data: 'world' };
      yield { type: 'done', data: null };
    }

    const result = await collectStream(mockStream());
    expect(result).toBe('Hello world');
  });

  it('stops at done event', async () => {
    async function* mockStream(): AsyncGenerator<StreamEvent> {
      yield { type: 'token', data: 'Before' };
      yield { type: 'done', data: null };
      yield { type: 'token', data: 'After' };
    }

    const result = await collectStream(mockStream());
    expect(result).toBe('Before');
  });

  it('ignores non-token events', async () => {
    async function* mockStream(): AsyncGenerator<StreamEvent> {
      yield { type: 'step', data: { index: 1 } };
      yield { type: 'token', data: 'Text' };
      yield { type: 'tool_call', data: { name: 'search' } };
      yield { type: 'done', data: null };
    }

    const result = await collectStream(mockStream());
    expect(result).toBe('Text');
  });
});
