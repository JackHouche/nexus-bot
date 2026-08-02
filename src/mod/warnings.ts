/**
 * NEXUS — Warning system (3-strike escalation)
 * Redis-backed: key `warnings:{guildId}:{userId}` stores a JSON array.
 */

import { redis } from '../redis.js';
import { logger } from '../logger.js';

// ============================================================
//  TYPES
// ============================================================

export interface Warning {
  reason: string;
  moderatorId: string;
  timestamp: number;
}

export interface AutoActionResult {
  action: 'none' | 'mute' | 'kick' | 'ban';
  /** Duration in minutes. Omitted = permanent. */
  duration?: number;
}

// ============================================================
//  ESCALATION THRESHOLDS
// ============================================================

const THRESHOLDS = {
  MUTE: 3,    // 3 warnings → mute 1h
  TEMP_BAN: 5, // 5 warnings → ban 7 days
  PERM_BAN: 7, // 7 warnings → permanent ban
} as const;

const MUTE_DURATION_MIN = 60;             // 1 hour
const TEMP_BAN_DURATION_MIN = 7 * 24 * 60; // 7 days

// ============================================================
//  REDIS HELPERS
// ============================================================

const key = (guildId: string, userId: string) => `warnings:${guildId}:${userId}`;

// ============================================================
//  PUBLIC API
// ============================================================

/**
 * Warn a user and persist the warning in Redis.
 * Returns the full updated warnings array.
 */
export async function warnUser(
  guildId: string,
  userId: string,
  moderatorId: string,
  reason: string,
): Promise<Warning[]> {
  const raw = await redis.get(key(guildId, userId));
  const warnings: Warning[] = raw ? JSON.parse(raw) as Warning[] : [];

  warnings.push({ reason, moderatorId, timestamp: Date.now() });
  await redis.set(key(guildId, userId), JSON.stringify(warnings));

  logger.info(
    { guildId, userId, moderatorId, reason, total: warnings.length },
    'User warned',
  );
  return warnings;
}

/**
 * Get all warnings for a user.
 */
export async function getWarnings(
  guildId: string,
  userId: string,
): Promise<Warning[]> {
  const raw = await redis.get(key(guildId, userId));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Warning[];
  } catch {
    return [];
  }
}

/**
 * Determine the automatic escalation action based on warning count.
 * - 3 warnings → mute 1h
 * - 5 warnings → ban 7 days
 * - 7 warnings → permanent ban
 */
export function checkAutoAction(warnings: Warning[]): AutoActionResult {
  const count = warnings.length;

  if (count >= THRESHOLDS.PERM_BAN) {
    return { action: 'ban' }; // permanent
  }
  if (count >= THRESHOLDS.TEMP_BAN) {
    return { action: 'ban', duration: TEMP_BAN_DURATION_MIN };
  }
  if (count >= THRESHOLDS.MUTE) {
    return { action: 'mute', duration: MUTE_DURATION_MIN };
  }
  return { action: 'none' };
}

/**
 * Clear all warnings for a user (admin reset).
 */
export async function clearWarnings(
  guildId: string,
  userId: string,
): Promise<void> {
  await redis.del(key(guildId, userId));
  logger.info({ guildId, userId }, 'Warnings cleared');
}
