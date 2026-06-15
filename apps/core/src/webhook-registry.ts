import { getLogger } from '@titan/logging';
import { createHmac, randomBytes } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { enqueue, QUEUE_NAMES } from '@titan/queue';

const log = getLogger().child({ component: 'webhook-registry' });

export interface WebhookEndpoint {
  id: string;
  name: string;
  agentId: string;
  secret: string;
  promptTemplate: string;
  enabled: boolean;
  events: string[];
  createdAt: Date;
  userId?: string;
  lastTriggeredAt?: Date;
  triggerCount: number;
}

export interface WebhookDelivery {
  webhookId: string;
  deliveredAt: Date;
  payload: Record<string, unknown>;
  runId: string;
  status: 'ok' | 'error';
  error?: string;
}

const endpoints = new Map<string, WebhookEndpoint>();
const recentDeliveries: WebhookDelivery[] = [];
const MAX_DELIVERY_LOG = 100;

/**
 * Verify HMAC-SHA256 signature from payload.
 * Signature header format: "sha256=<hex>"
 */
export function verifyWebhookSignature(secret: string, rawBody: string, signature: string): boolean {
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`;
  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

export function createWebhook(input: Omit<WebhookEndpoint, 'id' | 'secret' | 'createdAt' | 'triggerCount'>): WebhookEndpoint {
  const endpoint: WebhookEndpoint = {
    ...input,
    id: randomUUID(),
    secret: randomBytes(32).toString('hex'),
    createdAt: new Date(),
    triggerCount: 0,
  };
  endpoints.set(endpoint.id, endpoint);
  log.info({ webhookId: endpoint.id, name: endpoint.name }, 'webhook created');
  return endpoint;
}

export function updateWebhook(
  id: string,
  patch: Partial<Pick<WebhookEndpoint, 'name' | 'promptTemplate' | 'enabled' | 'events'>>,
): WebhookEndpoint {
  const wh = endpoints.get(id);
  if (!wh) throw new Error(`Webhook not found: ${id}`);
  Object.assign(wh, patch);
  log.info({ webhookId: id }, 'webhook updated');
  return wh;
}

export function rotateWebhookSecret(id: string): WebhookEndpoint {
  const wh = endpoints.get(id);
  if (!wh) throw new Error(`Webhook not found: ${id}`);
  wh.secret = randomBytes(32).toString('hex');
  log.info({ webhookId: id }, 'webhook secret rotated');
  return wh;
}

export function deleteWebhook(id: string): void {
  endpoints.delete(id);
  log.info({ webhookId: id }, 'webhook deleted');
}

export function listWebhooks(userId?: string): WebhookEndpoint[] {
  const all = [...endpoints.values()];
  return userId ? all.filter((w) => w.userId === userId) : all;
}

export function getWebhook(id: string): WebhookEndpoint | undefined {
  return endpoints.get(id);
}

export function getWebhookDeliveries(webhookId: string): WebhookDelivery[] {
  return recentDeliveries.filter((d) => d.webhookId === webhookId).slice(-20);
}

/**
 * Process incoming webhook payload — builds prompt from template and enqueues agent run.
 */
export async function triggerWebhook(
  webhookId: string,
  payload: Record<string, unknown>,
): Promise<{ runId: string }> {
  const wh = endpoints.get(webhookId);
  if (!wh) throw new Error(`Webhook not found: ${webhookId}`);
  if (!wh.enabled) throw new Error(`Webhook ${webhookId} is disabled`);

  // Interpolate payload into prompt template
  // Supports {{key}} placeholders
  let prompt = wh.promptTemplate;
  for (const [key, value] of Object.entries(payload)) {
    prompt = prompt.replaceAll(`{{${key}}}`, String(value));
  }
  // Also inject full payload as JSON
  prompt = prompt.replaceAll('{{payload}}', JSON.stringify(payload, null, 2));

  const runId = randomUUID();
  const delivery: WebhookDelivery = {
    webhookId,
    deliveredAt: new Date(),
    payload,
    runId,
    status: 'ok',
  };

  try {
    await enqueue(QUEUE_NAMES.AGENT_EXECUTE, 'agent.run', {
      runId,
      agentId: wh.agentId,
      prompt,
      userId: wh.userId,
      maxSteps: 10,
    });
    wh.lastTriggeredAt = new Date();
    wh.triggerCount++;
    log.info({ webhookId, runId, agentId: wh.agentId }, 'webhook triggered');
  } catch (err) {
    delivery.status = 'error';
    delivery.error = (err as Error).message;
    log.error({ err, webhookId }, 'webhook trigger failed');
    throw err;
  } finally {
    recentDeliveries.push(delivery);
    if (recentDeliveries.length > MAX_DELIVERY_LOG) recentDeliveries.shift();
  }

  return { runId };
}
