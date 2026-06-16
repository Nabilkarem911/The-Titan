import { getLogger } from '@titan/logging';
import { createHmac, randomBytes } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { enqueue, QUEUE_NAMES } from '@titan/queue';
import { webhooks as webhooksRepo } from '@titan/database';

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

function dbToEndpoint(rec: { id: string; ownerId: string; name: string; url: string; secret: string; events: string[]; isActive: boolean; metadata: Record<string, unknown>; createdAt: Date }): WebhookEndpoint {
  return {
    id: rec.id,
    name: rec.name,
    agentId: (rec.metadata.agentId as string) ?? '',
    secret: rec.secret,
    promptTemplate: (rec.metadata.promptTemplate as string) ?? '{{payload}}',
    enabled: rec.isActive,
    events: rec.events,
    createdAt: rec.createdAt,
    userId: rec.ownerId,
    lastTriggeredAt: rec.metadata.lastTriggeredAt ? new Date(rec.metadata.lastTriggeredAt as string) : undefined,
    triggerCount: (rec.metadata.triggerCount as number) ?? 0,
  };
}

export async function createWebhook(input: Omit<WebhookEndpoint, 'id' | 'secret' | 'createdAt' | 'triggerCount'>): Promise<WebhookEndpoint> {
  const secret = randomBytes(32).toString('hex');
  const rec = await webhooksRepo.create({
    ownerId: input.userId ?? 'system',
    name: input.name,
    url: `internal://agent/${input.agentId}`,
    secret,
    events: input.events,
  });
  // Store agent-specific metadata
  await webhooksRepo.update(rec.id, {});
  // We need to store promptTemplate and agentId as metadata — update via raw query
  const { query } = await import('@titan/database');
  await query(
    `UPDATE webhooks SET metadata = $1 WHERE id = $2`,
    [JSON.stringify({ agentId: input.agentId, promptTemplate: input.promptTemplate, triggerCount: 0 }), rec.id],
  );
  const endpoint: WebhookEndpoint = {
    id: rec.id,
    name: rec.name,
    agentId: input.agentId,
    secret,
    promptTemplate: input.promptTemplate,
    enabled: input.enabled,
    events: input.events,
    createdAt: rec.createdAt,
    userId: input.userId,
    triggerCount: 0,
  };
  log.info({ webhookId: endpoint.id, name: endpoint.name }, 'webhook created');
  return endpoint;
}

export async function updateWebhook(
  id: string,
  patch: Partial<Pick<WebhookEndpoint, 'name' | 'promptTemplate' | 'enabled' | 'events'>>,
): Promise<WebhookEndpoint> {
  const rec = await webhooksRepo.findById(id);
  if (!rec) throw new Error(`Webhook not found: ${id}`);

  const dbPatch: { name?: string; events?: string[]; isActive?: boolean } = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.events !== undefined) dbPatch.events = patch.events;
  if (patch.enabled !== undefined) dbPatch.isActive = patch.enabled;

  if (Object.keys(dbPatch).length > 0) {
    await webhooksRepo.update(id, dbPatch);
  }

  if (patch.promptTemplate !== undefined) {
    const { query } = await import('@titan/database');
    const newMeta = { ...rec.metadata, promptTemplate: patch.promptTemplate };
    await query('UPDATE webhooks SET metadata = $1, updated_at = now() WHERE id = $2', [JSON.stringify(newMeta), id]);
  }

  const updated = await webhooksRepo.findById(id);
  if (!updated) throw new Error(`Webhook not found after update: ${id}`);
  log.info({ webhookId: id }, 'webhook updated');
  return dbToEndpoint(updated);
}

export async function rotateWebhookSecret(id: string): Promise<WebhookEndpoint> {
  const newSecret = randomBytes(32).toString('hex');
  const rec = await webhooksRepo.rotateSecret(id, newSecret);
  if (!rec) throw new Error(`Webhook not found: ${id}`);
  log.info({ webhookId: id }, 'webhook secret rotated');
  return dbToEndpoint(rec);
}

export async function deleteWebhook(id: string): Promise<void> {
  await webhooksRepo.delete(id);
  log.info({ webhookId: id }, 'webhook deleted');
}

export async function listWebhooks(userId?: string): Promise<WebhookEndpoint[]> {
  if (!userId) {
    const { query } = await import('@titan/database');
    const r = await query<Record<string, unknown>>('SELECT * FROM webhooks ORDER BY created_at DESC LIMIT 100');
    return r.rows.map((row) => dbToEndpoint({
      id: row.id as string,
      ownerId: row.owner_id as string,
      name: row.name as string,
      url: row.url as string,
      secret: row.secret as string,
      events: (row.events as string[]) ?? ['*'],
      isActive: row.is_active as boolean,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(row.created_at as string),
    }));
  }
  const recs = await webhooksRepo.listForOwner(userId);
  return recs.map(dbToEndpoint);
}

export async function getWebhook(id: string): Promise<WebhookEndpoint | undefined> {
  const rec = await webhooksRepo.findById(id);
  return rec ? dbToEndpoint(rec) : undefined;
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
  const wh = await getWebhook(webhookId);
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
    // Update trigger count in DB
    const { query } = await import('@titan/database');
    const rec = await webhooksRepo.findById(webhookId);
    if (rec) {
      const newMeta = { ...rec.metadata, triggerCount: ((rec.metadata.triggerCount as number) ?? 0) + 1, lastTriggeredAt: new Date().toISOString() };
      await query('UPDATE webhooks SET metadata = $1, updated_at = now() WHERE id = $2', [JSON.stringify(newMeta), webhookId]);
    }
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
