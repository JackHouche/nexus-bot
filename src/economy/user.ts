/**
 * Economy helpers — get or create user, daily rewards, transfers.
 */

import { prisma } from '../database.js';
import { setCooldown } from '../redis.js';

const DAILY_REWARDS = [200, 250, 300, 400, 500, 700, 1000];
const DAILY_GEMS_DAY = 6; // gems on day 7

export async function getOrCreateUser(
  discordId: string,
  username: string
) {
  return prisma.user.upsert({
    where: { id: discordId },
    update: { username },
    create: { id: discordId, username },
  });
}

export async function claimDaily(
  userId: string,
  username: string
): Promise<{ coins: number; gems: number; streak: number; isJackpot: boolean }> {
  const user = await getOrCreateUser(userId, username);
  const now = new Date();
  const lastDaily = user.lastDaily;

  // Check if already claimed today
  if (lastDaily) {
    const hoursSince = (now.getTime() - lastDaily.getTime()) / (1000 * 60 * 60);
    if (hoursSince < 24) {
      throw new Error(
        `Tu as déjà récupéré ta récompense quotidienne ! Reviens dans ${Math.ceil(24 - hoursSince)}h.`
      );
    }
  }

  // Determine streak
  let streak = user.dailyStreak;
  if (lastDaily) {
    const hoursSince = (now.getTime() - lastDaily.getTime()) / (1000 * 60 * 60);
    if (hoursSince < 48) {
      streak += 1; // continue streak
    } else {
      streak = 1; // streak broken, reset
    }
  } else {
    streak = 1;
  }

  const streakIndex = (streak - 1) % DAILY_REWARDS.length;
  const coins = DAILY_REWARDS[streakIndex];
  const gems = streakIndex === DAILY_GEMS_DAY ? 5 : 0;
  const isJackpot = streakIndex === DAILY_REWARDS.length - 1;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        coins: { increment: BigInt(coins) },
        gems: { increment: gems },
        dailyStreak: streak,
        lastDaily: now,
      },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: 'daily',
        amount: BigInt(coins),
        meta: { streak, gems },
      },
    }),
  ]);

  // 4-hour cooldown
  await setCooldown(userId, 'daily', 0); // the 24h check is handled above

  return { coins, gems, streak, isJackpot };
}
