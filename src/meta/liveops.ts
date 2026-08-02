/**
 * NEXUS — LiveOps: Seasons, Battle Pass, Daily Seed, Events
 */

import { prisma } from '../database.js';
import { logger } from '../logger.js';

// ============================================================
//  SEASONS
// ============================================================

export const SEASON_DURATION_DAYS = 56; // 8 weeks

export interface SeasonTheme {
  id: string;
  name: string;
  emoji: string;
  description: string;
  enemyMultiplier: string;
  newPerks: string;
  newEnemies: string;
  skinName: string;
}

export const SEASON_THEMES: SeasonTheme[] = [
  {
    id: 'phoenix',
    name: 'Les Cendres du Phoenix',
    emoji: '🔥',
    description: 'Des flammes éternelles consument les profondeurs. Les ennemis de feu sont 50% plus nombreux.',
    enemyMultiplier: 'feu +50%',
    newPerks: 'Coeur de Braise, Ailes de Cendres, Renaissance',
    newEnemies: 'Salamandre, Phénix Corrompu, Golem de Magma',
    skinName: 'Phoenix Warrior',
  },
  {
    id: 'ice_age',
    name: 'L\'Âge de Glace',
    emoji: '❄️',
    description: 'Un froid absolu s\'abat sur les profondeurs. Les ennemis gèlent leurs victimes.',
    enemyMultiplier: 'glace +50%',
    newPerks: 'Coeur de Glace, Marche-Glace, Sang-Froid',
    newEnemies: 'Wendigo, Golem de Glace, Wraith Glacial',
    skinName: 'Guerrier du Gel',
  },
  {
    id: 'cosmic_horror',
    name: 'L\'Horreur Cosmique',
    emoji: '🌌',
    description: 'Des entités cosmiques surgissent du néant. La folie guette ceux qui descendent.',
    enemyMultiplier: 'cosmique +50%',
    newPerks: 'Esprit Cosmique, Tentacule, Vue au-delà',
    newEnemies: 'Cthulhu Mineur, Marcheur du Néant, Yeux Innombrables',
    skinName: 'Mangeur d\'Étoiles',
  },
];

/**
 * Get the active season.
 */
export async function getActiveSeason() {
  return prisma.season.findFirst({
    where: { active: true },
    orderBy: { id: 'desc' },
  });
}

/**
 * Create a new season.
 */
export async function createSeason(themeId: string): Promise<number> {
  const theme = SEASON_THEMES.find((t) => t.id === themeId);
  if (!theme) throw new Error('Thème saisonnier invalide');

  const now = new Date();
  const endsAt = new Date(now);
  endsAt.setDate(endsAt.getDate() + SEASON_DURATION_DAYS);

  const season = await prisma.season.create({
    data: {
      name: theme.name,
      theme: theme.id,
      startsAt: now,
      endsAt,
      active: true,
      battlePass: generateBattlePass() as unknown as object,
    },
  });

  // Deactivate previous seasons
  await prisma.season.updateMany({
    where: { id: { not: season.id } },
    data: { active: false },
  });

  logger.info({ seasonId: season.id, theme: theme.name }, 'New season created');
  return season.id;
}

// ============================================================
//  BATTLE PASS
// ============================================================

interface BattlePassTier {
  level: number;
  freeReward: { type: string; amount: number; name: string; emoji: string };
  premiumReward: { type: string; amount: number; name: string; emoji: string };
}

function generateBattlePass(): BattlePassTier[] {
  const tiers: BattlePassTier[] = [];
  for (let i = 1; i <= 100; i++) {
    tiers.push({
      level: i,
      freeReward: getFreeReward(i),
      premiumReward: getPremiumReward(i),
    });
  }
  return tiers;
}

function getFreeReward(level: number): { type: string; amount: number; name: string; emoji: string } {
  if (level === 100) return { type: 'achievement', amount: 1, name: 'Survivant S1', emoji: '🏆' };
  if (level % 25 === 0) return { type: 'gems', amount: 30, name: '30 Gems', emoji: '💎' };
  if (level % 10 === 0) return { type: 'relic', amount: 1, name: 'Relique', emoji: '🏺' };
  if (level % 5 === 0) return { type: 'souls', amount: 20, name: '20 Souls', emoji: '👻' };
  return { type: 'coins', amount: 200 + level * 10, name: `${200 + level * 10} Coins`, emoji: '🪙' };
}

function getPremiumReward(level: number): { type: string; amount: number; name: string; emoji: string } {
  if (level === 100) return { type: 'mythic_gear', amount: 1, name: 'Gear Mythique + Titre', emoji: '🔴' };
  if (level === 50) return { type: 'skin', amount: 1, name: 'Skin Phoenix', emoji: '🎨' };
  if (level === 75) return { type: 'legendary_gear', amount: 1, name: 'Gear Légendaire', emoji: '🟡' };
  if (level % 10 === 0) return { type: 'gems', amount: 50, name: '50 Gems', emoji: '💎' };
  if (level % 5 === 0) return { type: 'coins', amount: 1000 + level * 20, name: `${1000 + level * 20} Coins`, emoji: '💰' };
  return { type: 'gems', amount: 10, name: '10 Gems', emoji: '💎' };
}

/**
 * Get a user's season progress.
 */
export async function getSeasonProgress(userId: string, seasonId: number) {
  return prisma.seasonProgress.upsert({
    where: { userId_seasonId: { userId, seasonId } },
    update: {},
    create: { userId, seasonId },
  });
}

/**
 * Add season XP to a user.
 */
export async function addSeasonXp(userId: string, xpAmount: number): Promise<void> {
  const season = await getActiveSeason();
  if (!season) return;

  await prisma.seasonProgress.upsert({
    where: { userId_seasonId: { userId, seasonId: season.id } },
    update: { xp: { increment: xpAmount } },
    create: { userId, seasonId: season.id, xp: xpAmount },
  });

  // Check level up (100 XP per level)
  const progress = await getSeasonProgress(userId, season.id);
  const newLevel = Math.floor(progress.xp / 100) + 1;
  if (newLevel > progress.level) {
    await prisma.seasonProgress.update({
      where: { userId_seasonId: { userId, seasonId: season.id } },
      data: { level: newLevel },
    });
    logger.debug({ userId, seasonLevel: newLevel }, 'Battle Pass level up');
  }
}

// ============================================================
//  DAILY SEED
// ============================================================

/**
 * Get today's daily seed (same for all players).
 */
export async function getDailySeed(): Promise<number> {
  const today = new Date();
  const dateKey = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const existing = await prisma.dailySeed.findUnique({
    where: { date: dateKey },
  });

  if (existing) return existing.seed;

  // Generate a deterministic seed from the date
  const seed = dateKey.getTime() % 2147483647;

  await prisma.dailySeed.create({
    data: {
      date: dateKey,
      seed,
      leaderboard: {},
    },
  });

  return seed;
}

/**
 * Update the daily seed leaderboard with a player's result.
 */
export async function updateDailySeedLeaderboard(
  userId: string,
  username: string,
  seed: number,
  bestFloor: number,
  className: string
): Promise<void> {
  const today = new Date();
  const dateKey = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const dailySeed = await prisma.dailySeed.findUnique({
    where: { date: dateKey },
  });
  if (!dailySeed) return;

  const leaderboard = dailySeed.leaderboard as Record<string, { username: string; bestFloor: number; className: string }>;
  const current = leaderboard[userId];

  if (!current || bestFloor > current.bestFloor) {
    leaderboard[userId] = { username, bestFloor, className };
    await prisma.dailySeed.update({
      where: { date: dateKey },
      data: { leaderboard },
    });
  }
}

/**
 * Get the daily seed leaderboard (sorted).
 */
export async function getDailySeedLeaderboard(): Promise<{ userId: string; username: string; bestFloor: number; className: string }[]> {
  const today = new Date();
  const dateKey = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const dailySeed = await prisma.dailySeed.findUnique({
    where: { date: dateKey },
  });
  if (!dailySeed) return [];

  const leaderboard = dailySeed.leaderboard as Record<string, { username: string; bestFloor: number; className: string }>;
  return Object.entries(leaderboard)
    .map(([userId, data]) => ({ userId, ...data }))
    .sort((a, b) => b.bestFloor - a.bestFloor);
}

// ============================================================
//  GAME EVENTS
// ============================================================

export const EVENT_TYPES = {
  double_pacte: {
    name: 'Double Pacte',
    emoji: '💰',
    description: 'Tous les pactes sont doublés',
    durationHours: 1,
  },
  blood_moon: {
    name: 'Lune de Sang',
    emoji: '🌙',
    description: 'Ennemis x2 ATK, loot x3',
    durationHours: 2,
  },
  golden_shop: {
    name: 'Boutique Dorée',
    emoji: '🏪',
    description: 'Tous les shops ont un item légendaire garanti, -50% prix',
    durationHours: 1,
  },
  fog: {
    name: 'Brouillard',
    emoji: '🌫️',
    description: 'Types d\'étages masqués — tout est surprise',
    durationHours: 2,
  },
  invasion: {
    name: 'Invasion',
    emoji: '⚔️',
    description: 'Boss aléatoire à un étage aléatoire',
    durationHours: 1,
  },
  double_xp: {
    name: 'Double XP',
    emoji: '⭐',
    description: 'Toute l\'XP est doublée',
    durationHours: 2,
  },
} as const;

export type EventType = keyof typeof EVENT_TYPES;

/**
 * Create a new game event.
 */
export async function createEvent(type: EventType, durationHours?: number): Promise<void> {
  const def = EVENT_TYPES[type];
  const now = new Date();
  const endsAt = new Date(now);
  endsAt.setHours(endsAt.getHours() + (durationHours ?? def.durationHours));

  await prisma.gameEvent.create({
    data: {
      type,
      startsAt: now,
      endsAt,
      active: true,
    },
  });

  logger.info({ type, endsAt }, 'Game event started');
}

/**
 * Get all active events.
 */
export async function getActiveEvents() {
  const now = new Date();
  const events = await prisma.gameEvent.findMany({
    where: { active: true, endsAt: { gte: now } },
  });

  // Deactivate expired events
  const expired = events.filter((e: any) => e.endsAt < now);
  if (expired.length > 0) {
    await prisma.gameEvent.updateMany({
      where: { id: { in: expired.map((e: any) => e.id) } },
      data: { active: false },
    });
  }

  return events.filter((e: any) => e.endsAt >= now);
}

/**
 * Check if a specific event type is active.
 */
export async function isEventActive(type: EventType): Promise<boolean> {
  const active = await getActiveEvents();
  return active.some((e: typeof active[number]) => e.type === type);
}

// ============================================================
//  WEEKLY EVENT ROTATION (automated)
// ============================================================

const WEEKLY_ROTATION: EventType[] = [
  'double_pacte',  // Week 1
  'blood_moon',    // Week 2
  'golden_shop',   // Week 3
  'double_xp',     // Week 4
  'fog',           // Week 5
  'invasion',      // Week 6
  'double_pacte',  // Week 7
  'double_xp',     // Week 8 (finale)
];

/**
 * Check if the weekly rotation should trigger a new event.
 * Called by the bot on startup or periodically.
 */
export async function checkWeeklyRotation(): Promise<void> {
  const season = await getActiveSeason();
  if (!season) return;

  const weekSinceStart = Math.floor((Date.now() - season.startsAt.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const eventType = WEEKLY_ROTATION[weekSinceStart % WEEKLY_ROTATION.length];

  // Check if this week's event is already active
  const alreadyActive = await isEventActive(eventType);
  if (alreadyActive) return;

  // Start the event for 24 hours
  await createEvent(eventType, 24);
  logger.info({ week: weekSinceStart, eventType }, 'Weekly rotation event started');
}
