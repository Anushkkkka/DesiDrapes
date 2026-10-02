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
  | 'order.created'
  | 'order.paid'
  | 'order.status_changed'
  | 'payment.failed'
  | 'inventory.low'
  | 'password.reset_requested';

const WEBHOOK_TIMEOUT_MS = 5_000;
const RETRIES = 2;

async function postWithRetry(url: string, body: unknown): Promise<void> {
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      });
      if (res.ok) return;
      // 404 means the workflow isn't imported/active; retrying won't help.
      if (res.status === 404) throw new Error('n8n webhook not registered (is the workflow active?)');
      throw new Error(`n8n responded ${res.status}`);
    } catch (err) {
      if (attempt === RETRIES || (err as Error).message.includes('not registered')) throw err;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
}

/**
 * Fire-and-forget: automation failures are logged, never surfaced to the
 * customer, so checkout keeps working if n8n is down.
 */
export function publishEvent(event: DomainEvent, payload: Record<string, unknown>): void {
  if (!env.N8N_WEBHOOK_BASE_URL || env.isTest) return;
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
