import type { NotificationType, Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

/**
 * Domain events the API publishes. Each one is POSTed to
 * `${N8N_WEBHOOK_BASE_URL}/<event>` where an n8n workflow picks it up
 * (emails, admin alerts, and so on). See n8n/workflows/.
 */
export type DomainEvent =
  | 'user.registered'
  | 'order.paid'
  | 'order.status_changed'
  | 'payment.failed'
  | 'inventory.low'
  | 'password.reset_requested';

const WEBHOOK_TIMEOUT_MS = 5_000;
/**
 * Backoff between attempts: 1s, 2s, 4s, 8s (~15s total). n8n answers 404 for a few seconds
 * after it reports healthy while it registers webhooks (measured ~4s), so 404 is retried too.
 */
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000];

async function postWithRetry(url: string, body: unknown): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        // n8n workflows reject events without this shared secret, so nobody else can
        // make the store send emails by calling the webhook URLs directly.
        headers: { 'content-type': 'application/json', 'x-api-key': env.N8N_API_KEY ?? '' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      });
      if (res.ok) return;
      if (res.status === 404) throw new Error('n8n webhook not registered (n8n starting, or workflow not published)');
      throw new Error(`n8n responded ${res.status}`);
    } catch (err) {
      if (attempt >= RETRY_DELAYS_MS.length) throw err;
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
}

/**
 * Fire-and-forget: automation failures are logged, never surfaced to the
 * customer, so checkout keeps working if n8n is down. Delivery is best-effort:
 * an event is dropped (and logged) if n8n stays unreachable past the retry window.
 */
export function publishEvent(event: DomainEvent, payload: Record<string, unknown>): void {
  if (!env.N8N_WEBHOOK_BASE_URL || env.isTest) return;
  if (!env.N8N_API_KEY) {
    logger.warn({ event }, 'N8N_API_KEY is not set; n8n will reject this event');
  }
  const url = `${env.N8N_WEBHOOK_BASE_URL.replace(/\/$/, '')}/${event}`;
  const body = { event, occurredAt: new Date().toISOString(), data: payload };
  postWithRetry(url, body)
    .then(() => logger.debug({ event }, 'Event delivered to n8n'))
    .catch((err) => logger.warn({ event, err: (err as Error).message }, 'Event delivery to n8n failed'));
}

export async function notify(userId: string, type: NotificationType, message: string): Promise<void> {
  await prisma.notification.create({ data: { userId, type, message } }).catch((err) => {
    logger.warn({ err, userId, type }, 'Failed to create notification');
  });
}

export async function audit(
  action: string,
  opts: { userId?: string; entity?: string; entityId?: string; metadata?: Prisma.InputJsonValue } = {},
): Promise<void> {
  await prisma.auditLog.create({ data: { action, ...opts } }).catch((err) => {
    logger.warn({ err, action }, 'Failed to write audit log');
  });
}
