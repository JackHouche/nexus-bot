import Redis from 'ioredis';
import { config } from './config.js';

export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('error', (err) => {
  console.error('[Redis] Error:', err.message);
});

/**
 * Set a cooldown for a user+command.
 * Returns true if the cooldown was set (i.e. NOT already cooling down).
 */
export async function setCooldown(
  userId: string,
  command: string,
  seconds: number
): Promise<boolean> {
  const key = `cooldown:${userId}:${command}`;
  const result = await redis.set(key, '1', 'EX', seconds, 'NX');
  return result === 'OK';
}

/**
 * Check remaining cooldown in seconds (0 = no cooldown).
 */
export async function getCooldown(userId: string, command: string): Promise<number> {
  const key = `cooldown:${userId}:${command}`;
  const ttl = await redis.ttl(key);
  return Math.max(0, ttl);
}

/**
 * Cache helper — JSON serialization.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function cacheDel(key: string): Promise<void> {
  await redis.del(key);
}
