/**
 * NEXUS — XP & leveling by chat activity
 * Gives 15-25 random XP per message (60 s cooldown per user).
 * Role rewards at 100 / 500 messages.
 */

import type { Message, Guild, User } from 'discord.js';
import { prisma } from '../database.js';
import { redis, setCooldown } from '../redis.js';
import { logger } from '../logger.js';

// ============================================================
//  CONSTANTS
// ============================================================

const XP_PER_LEVEL = 100;
const XP_MIN = 15;
const XP_MAX = 25;
const COOLDOWN_SECONDS = 60;
const COOLDOWN_COMMAND = 'message_xp';

const ROLE_THRESHOLDS = [
  { count: 100, name: '⭐ Actif' },
  { count: 500, name: '🔥 Légende' },
] as const;

const msgCountKey = (userId: string) => `msgcount:user:${userId}`;

// ============================================================
//  XP ADDITION
// ============================================================

/**
 * Add XP to a user and check for level-up.
 * Updates `User.xp` and `User.level` (100 XP per level).
 */
export async function addMessageXp(
  userId: string,
  amount: number,
): Promise<{ leveledUp: boolean; newLevel: number }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { leveledUp: false, newLevel: 1 };
  }

  const newTotalXp = user.xp + amount;
  const newLevel = Math.floor(newTotalXp / XP_PER_LEVEL) + 1;
  const leveledUp = newLevel > user.level;

  await prisma.user.update({
    where: { id: userId },
    data: { xp: newTotalXp, level: newLevel },
  });

  if (leveledUp) {
    logger.info({ userId, newLevel }, 'User leveled up via chat XP');
  }

  return { leveledUp, newLevel };
}

/**
 * Get a user's chat level info.
 * Returns current-level XP and remaining XP to the next level.
 */
export async function getChatLevel(
  userId: string,
): Promise<{ level: number; xp: number; xpToNext: number }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { level: 1, xp: 0, xpToNext: XP_PER_LEVEL };
  }

  const level = Math.floor(user.xp / XP_PER_LEVEL) + 1;
  const xpInCurrentLevel = user.xp % XP_PER_LEVEL;

  return {
    level,
    xp: xpInCurrentLevel,
    xpToNext: XP_PER_LEVEL - xpInCurrentLevel,
  };
}

/**
 * Main entry point: process a chat message for XP.
 * Gives 15-25 random XP, with a 60 s cooldown per user (Redis).
 * Returns null if the user is on cooldown.
 */
export async function processMessageForXp(
  message: Message,
): Promise<{ xpGained: number; leveledUp: boolean; newLevel: number } | null> {
  const userId = message.author.id;

  // Check / set cooldown (returns false if already cooling down)
  const canProceed = await setCooldown(userId, COOLDOWN_COMMAND, COOLDOWN_SECONDS);
  if (!canProceed) return null;

  // Increment message counter (for role rewards)
  await redis.incr(msgCountKey(userId));

  // Grant random XP
  const xp = Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;
  const { leveledUp, newLevel } = await addMessageXp(userId, xp);

  return { xpGained: xp, leveledUp, newLevel };
}

/**
 * Check and assign role rewards based on message count.
 * - 100 messages → ⭐ Actif
 * - 500 messages → 🔥 Légende
 * Returns the names of roles that were newly assigned.
 */
export async function getRoleRewards(guild: Guild, user: User): Promise<string[]> {
  const raw = await redis.get(msgCountKey(user.id));
  const msgCount = raw ? parseInt(raw, 10) : 0;

  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return [];

  const assigned: string[] = [];

  for (const threshold of ROLE_THRESHOLDS) {
    if (msgCount >= threshold.count) {
      const role = guild.roles.cache.find((r) => r.name === threshold.name);
      if (role && !member.roles.cache.has(role.id)) {
        try {
          await member.roles.add(role, `Récompense: ${threshold.count} messages`);
          assigned.push(threshold.name);
          logger.info(
            { userId: user.id, role: threshold.name, msgCount },
            'Role reward assigned',
          );
        } catch (err) {
          logger.warn(
            { err: (err as Error).message, role: threshold.name },
            'Failed to assign role reward',
          );
        }
      }
    }
  }

  return assigned;
}

/**
 * Get the raw message count for a user (for display / leaderboards).
 */
export async function getMessageCount(userId: string): Promise<number> {
  const raw = await redis.get(msgCountKey(userId));
  return raw ? parseInt(raw, 10) : 0;
}
