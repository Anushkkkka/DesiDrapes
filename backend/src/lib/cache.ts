import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Thin Redis cache wrapper. Every call degrades to a cache miss when Redis is
 * absent or down, so the API keeps serving from Postgres.
 */
const redis = env.REDIS_URL
  ? new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false })
  : null;

let ready = false;
if (redis) {
  redis.on('ready', () => {
    ready = true;
    logger.info('Redis connected');
  });
  redis.on('end', () => (ready = false));
  redis.on('error', (err) => {
    if (ready) logger.warn({ err: err.message }, 'Redis error');
    ready = false;
  });
  redis.connect().catch((err) => logger.warn({ err: err.message }, 'Redis unavailable, caching disabled'));
}

export const cache = {
  isReady: () => ready,

  async get<T>(key: string): Promise<T | null> {
    if (!redis || !ready) return null;
    try {
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    if (!redis || !ready) return;
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      /* cache writes are best-effort */
    }
  },

  /** Deletes every key with the given prefix (SCAN, not KEYS, so it won't block Redis). */
  async invalidate(prefix: string): Promise<void> {
    if (!redis || !ready) return;
    try {
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
        cursor = next;
        if (keys.length) await redis.del(...keys);
      } while (cursor !== '0');
    } catch {
      /* best-effort */
    }
  },

  async quit(): Promise<void> {
    if (redis) await redis.quit().catch(() => undefined);
  },
};
