/**
 * NEXUS — Prestige System
 * Reset level + talents for permanent bonuses and content unlocks.
 */

import { prisma } from '../database.js';
import { logger } from '../logger.js';

export interface PrestigeReward {
  prestige: number;
  bonusXpPct: number;
  bonusCoinsPct: number;
  unlocks: string;
  title?: string;
}

export const PRESTIGE_REWARDS: PrestigeReward[] = [
  { prestige: 1, bonusXpPct: 5, bonusCoinsPct: 5, unlocks: 'Mode Hardcore (1 vie, x3 récompenses)' },
  { prestige: 2, bonusXpPct: 10, bonusCoinsPct: 10, unlocks: 'Reset gratuit d\'ascendance' },
  { prestige: 3, bonusXpPct: 15, bonusCoinsPct: 15, unlocks: '5e classe: Paladin' },
  { prestige: 4, bonusXpPct: 20, bonusCoinsPct: 20, unlocks: '6e classe: Alchimiste' },
  { prestige: 5, bonusXpPct: 25, bonusCoinsPct: 25, unlocks: 'Daily Seed compétitif + classe Nécromancien' },
  { prestige: 6, bonusXpPct: 30, bonusCoinsPct: 30, unlocks: '7e classe: Berserker' },
  { prestige: 7, bonusXpPct: 35, bonusCoinsPct: 35, unlocks: 'Mode Custom (choisis 2 perks de départ)' },
  { prestige: 8, bonusXpPct: 40, bonusCoinsPct: 40, unlocks: '8e classe: Étoile' },
  { prestige: 9, bonusXpPct: 45, bonusCoinsPct: 45, unlocks: '9e classe: Roi' },
  { prestige: 10, bonusXpPct: 50, bonusCoinsPct: 50, unlocks: 'Titre "Transcendant" + skin mythique', title: 'Transcendant' },
  { prestige: 15, bonusXpPct: 75, bonusCoinsPct: 75, unlocks: 'Cosmétique exclusif prestige 15' },
  { prestige: 20, bonusXpPct: 100, bonusCoinsPct: 100, unlocks: 'Statue dans le Hall of Fame + Titre "L\'Éternel"', title: 'L\'Éternel' },
];

/**
 * Get a user's prestige info.
 */
export async function getPrestige(userId: string) {
  return prisma.prestige.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

/**
 * Check if a user can prestige (must be level 100).
 */
export async function canPrestige(userId: string): Promise<{ canPrestige: boolean; reason?: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { canPrestige: false, reason: 'Utilisateur introuvable' };

  if (user.level < 100) {
    return { canPrestige: false, reason: `Tu dois être niveau 100 (actuellement ${user.level})` };
  }

  const prestige = await getPrestige(userId);
  if (prestige.level >= 20) {
    return { canPrestige: false, reason: 'Prestige maximum atteint (20)' };
  }

  return { canPrestige: true };
}

/**
 * Execute prestige: reset level + talents, grant bonuses.
 */
export async function doPrestige(userId: string): Promise<{ newPrestige: number; bonusXp: number; bonusCoins: number; unlocked: string }> {
  const check = await canPrestige(userId);
  if (!check.canPrestige) throw new Error(check.reason);

  const current = await getPrestige(userId);
  const newPrestigeLevel = current.level + 1;

  const reward = PRESTIGE_REWARDS.find((r) => r.prestige === newPrestigeLevel);
  const bonusXp = newPrestigeLevel * 5;
  const bonusCoins = newPrestigeLevel * 5;

  // Reset level + talents, update prestige
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        level: 1,
        xp: 0,
      },
    }),
    prisma.userTalent.deleteMany({ where: { userId } }),
    prisma.prestige.upsert({
      where: { userId },
      update: {
        level: newPrestigeLevel,
        bonusXp: bonusXp,
        bonusCoins: bonusCoins,
        lastPrestigeAt: new Date(),
      },
      create: {
        userId,
        level: newPrestigeLevel,
        bonusXp: bonusXp,
        bonusCoins: bonusCoins,
        lastPrestigeAt: new Date(),
      },
    }),
  ]);

  // Unlock classes based on prestige level
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) {
    const unlocked = [...user.unlockedClasses];
    if (newPrestigeLevel >= 3 && !unlocked.includes('paladin')) unlocked.push('paladin');
    if (newPrestigeLevel >= 4 && !unlocked.includes('alchemist')) unlocked.push('alchemist');
    if (newPrestigeLevel >= 5 && !unlocked.includes('necromancer')) unlocked.push('necromancer');
    if (newPrestigeLevel >= 6 && !unlocked.includes('berserker')) unlocked.push('berserker');
    if (newPrestigeLevel >= 8 && !unlocked.includes('star')) unlocked.push('star');
    if (newPrestigeLevel >= 9 && !unlocked.includes('king')) unlocked.push('king');
    await prisma.user.update({ where: { id: userId }, data: { unlockedClasses: unlocked } });
  }

  logger.info({ userId, newPrestigeLevel }, 'User prestiged');

  return {
    newPrestige: newPrestigeLevel,
    bonusXp,
    bonusCoins,
    unlocked: reward?.unlocks ?? 'Bonus cumulé',
  };
}
