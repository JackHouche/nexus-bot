/**
 * NEXUS — Raids: Global Boss System
 * A daily server-wide boss that all players contribute to defeating.
 */

import { prisma } from '../database.js';

export interface RaidBossDef {
  name: string;
  emoji: string;
  baseHp: bigint;
  description: string;
}

const RAID_BOSSES: RaidBossDef[] = [
  { name: 'Le Dragon Ancien', emoji: '🐉', baseHp: 15_000_000n, description: 'Un dragon colossal qui hante les profondeurs depuis des millénaires.' },
  { name: 'Le Titan de Feu', emoji: '🌋', baseHp: 20_000_000n, description: 'Une entité de roche en fusion qui écrase tout sur son passage.' },
  { name: 'La Sorcière Cosmique', emoji: '🌌', baseHp: 18_000_000n, description: 'Elle plie les étoiles à sa volonté et dévore les âmes.' },
  { name: 'Le Colosse d\'Argent', emoji: '🗿', baseHp: 25_000_000n, description: 'Un golem d\'argent indestructible qui ne s\'arrête jamais.' },
  { name: 'La Faucheuse', emoji: '💀', baseHp: 16_000_000n, description: 'La mort incarnée. Personne ne lui a jamais échappé.' },
  { name: 'L\'Hydre Éternelle', emoji: '🐍', baseHp: 30_000_000n, description: 'Pour chaque tête coupée, dix repoussent.' },
];

/**
 * Get or create today's raid boss.
 * One boss per day, resets at midnight UTC.
 */
export async function getDailyRaid(): Promise<{ id: string; name: string; emoji: string; hp: bigint; maxHp: bigint; expiresAt: Date; defeated: boolean } | null> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const existing = await prisma.raidBoss.findFirst({
    where: { createdAt: { gte: todayStart }, defeated: false },
    include: { contributors: true },
  });

  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      emoji: existing.emoji,
      hp: existing.hp,
      maxHp: existing.maxHp,
      expiresAt: existing.expiresAt,
      defeated: existing.defeated,
    };
  }

  // Check if today already had a defeated boss
  const defeatedToday = await prisma.raidBoss.findFirst({
    where: { createdAt: { gte: todayStart }, defeated: true },
  });
  if (defeatedToday) return null;

  // Create a new raid boss
  const bossDef = RAID_BOSSES[Math.floor(Math.random() * RAID_BOSSES.length)];
  const expiry = new Date(todayStart);
  expiry.setDate(expiry.getDate() + 1);

  const raid = await prisma.raidBoss.create({
    data: {
      name: bossDef.name,
      emoji: bossDef.emoji,
      hp: bossDef.baseHp,
      maxHp: bossDef.baseHp,
      expiresAt: expiry,
      defeated: false,
    },
  });

  return {
    id: raid.id,
    name: raid.name,
    emoji: raid.emoji,
    hp: raid.hp,
    maxHp: raid.maxHp,
    expiresAt: raid.expiresAt,
    defeated: raid.defeated,
  };
}

/**
 * Contribute damage to the raid boss.
 * Called after each combat victory during a run.
 */
export async function contributeToRaid(
  userId: string,
  raidId: string,
  damage: bigint,
  runFloor: number
): Promise<{ totalDamage: bigint; bossDefeated: boolean; isTopContributor: boolean }> {
  const contrib = await prisma.raidContribution.upsert({
    where: { raidId_userId: { raidId, userId } },
    update: { damage: { increment: damage }, runsDone: { increment: 1 } },
    create: { raidId, userId, damage, runsDone: 1 },
  });

  // Decrement boss HP
  const updated = await prisma.raidBoss.update({
    where: { id: raidId },
    data: { hp: { decrement: damage } },
  });

  let bossDefeated = false;
  if (updated.hp <= 0n) {
    bossDefeated = true;
    await prisma.raidBoss.update({
      where: { id: raidId },
      data: { defeated: true, hp: 0n },
    });
  }

  // Check if top contributor
  const topContribs = await prisma.raidContribution.findMany({
    where: { raidId },
    orderBy: { damage: 'desc' },
    take: 1,
  });
  const isTopContributor = topContribs[0]?.userId === userId;

  return {
    totalDamage: contrib.damage,
    bossDefeated,
    isTopContributor,
  };
}

/**
 * Get the raid leaderboard (top contributors).
 */
export async function getRaidLeaderboard(raidId: string, limit: number = 10) {
  const contributors = await prisma.raidContribution.findMany({
    where: { raidId },
    orderBy: { damage: 'desc' },
    take: limit,
  });

  // Get usernames
  const userIds = contributors.map((c: typeof contributors[number]) => c.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true },
  });
  const userMap = new Map(users.map((u: typeof users[number]) => [u.id, u.username]));

  return contributors.map((c: typeof contributors[number], i: number) => ({
    rank: i + 1,
    userId: c.userId,
    username: userMap.get(c.userId) ?? 'Inconnu',
    damage: c.damage,
    runs: c.runsDone,
  }));
}

/**
 * Distribute rewards when a raid is defeated.
 * Called once when the boss is defeated.
 */
export async function distributeRaidRewards(raidId: string): Promise<{ participants: number; rewardPerPlayer: bigint }> {
  const contributors = await prisma.raidContribution.findMany({
    where: { raidId },
  });

  const baseReward = 5000n;
  const topBonus = [10000n, 5000n, 2500n]; // top 3

  for (let i = 0; i < contributors.length; i++) {
    const c = contributors[i];
    const sorted = contributors.sort((a: typeof contributors[number], b: typeof contributors[number]) => Number(b.damage - a.damage));
    const rank = sorted.findIndex((s: typeof sorted[number]) => s.userId === c.userId);
    let reward = baseReward;
    if (rank < 3) reward += topBonus[rank];

    await prisma.user.update({
      where: { id: c.userId },
      data: { coins: { increment: reward }, gems: { increment: 10 } },
    });

    await prisma.transaction.create({
      data: {
        userId: c.userId,
        type: 'raid',
        amount: reward,
        meta: { raidId, rank: rank + 1, damage: c.damage.toString() },
      },
    });
  }

  return { participants: contributors.length, rewardPerPlayer: baseReward };
}
