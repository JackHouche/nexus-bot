/**
 * Class Mastery System — long-term progression per class.
 *
 * Leveling a class unlocks rewards at milestones (3,5,7,10,12,15,18,20).
 * At level 10 the player picks one of three Ascendances.
 * At level 20 the player picks one Transcendence (ultimate evolution).
 */

import { prisma } from '../database.js';
import type { ClassId } from '../roguelite/classes.js';

// ============================================================
//  XP & LEVELING CURVE
// ============================================================

const MAX_MASTERY_LEVEL = 20;

/** XP required to advance FROM a given level to the next. */
export function xpForLevel(level: number): number {
  // Smooth quadratic-ish curve. Level 0→1 cheap, 19→20 expensive.
  return Math.floor(100 * Math.pow(level, 1.5)) + 50;
}

/** Total XP required to reach a given level (from 0). */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let lvl = 0; lvl < level; lvl++) {
    total += xpForLevel(lvl);
  }
  return total;
}

// ============================================================
//  MASTERY REWARDS
// ============================================================

export interface MasteryReward {
  level: number;
  description: string;
  type:
    | 'perk'
    | 'stat'
    | 'special'
    | 'ascendance'
    | 'luck'
    | 'power_perk'
    | 'coins'
    | 'transcendence';
}

export const MASTERY_REWARDS: Record<number, MasteryReward> = {
  3: {
    level: 3,
    description: 'Débloque un perk spécifique à la classe',
    type: 'perk',
  },
  5: {
    level: 5,
    description: '+10 HP permanent',
    type: 'stat',
  },
  7: {
    level: 7,
    description: 'Spécial amélioré',
    type: 'special',
  },
  10: {
    level: 10,
    description: 'Choisis ton Ascendance',
    type: 'ascendance',
  },
  12: {
    level: 12,
    description: '+5% chance de perk rare',
    type: 'luck',
  },
  15: {
    level: 15,
    description: 'Débloque un perk puissant de classe',
    type: 'power_perk',
  },
  18: {
    level: 18,
    description: '+15% pièces',
    type: 'coins',
  },
  20: {
    level: 20,
    description: 'Choisis ta Transcendance',
    type: 'transcendence',
  },
};

// ============================================================
//  ASCENDANCES — chosen at mastery level 10 (3 per class)
// ============================================================

export type StatModifierKey =
  | 'hpPct'
  | 'atkPct'
  | 'defPct'
  | 'spellDamagePct'
  | 'critDamagePct'
  | 'critChance'
  | 'dodgeChance'
  | 'luckPct'
  | 'coinsPct';

export interface StatModifiers {
  hpPct?: number;
  atkPct?: number;
  defPct?: number;
  spellDamagePct?: number;
  critDamagePct?: number;
  critChance?: number;
  dodgeChance?: number;
  luckPct?: number;
  coinsPct?: number;
  /** Behavioral flags — encoded as strings in statModifiers for serialization safety. */
  flags?: string[];
}

export interface Ascendance {
  id: string;
  name: string;
  emoji: string;
  description: string;
  statModifiers: StatModifiers;
}

export type AscendanceMap = Record<ClassId, Ascendance[]>;

export const ASCENDANCES: AscendanceMap = {
  warrior: [
    {
      id: 'champion',
      name: 'Champion',
      emoji: '🛡️',
      description: '+20% HP, le spécial soigne',
      statModifiers: { hpPct: 0.2, flags: ['special_heals'] },
    },
    {
      id: 'berzerker',
      name: 'Berzerker',
      emoji: '🪓',
      description: '-20% HP, +50% ATK',
      statModifiers: { hpPct: -0.2, atkPct: 0.5 },
    },
    {
      id: 'bastion',
      name: 'Bastion',
      emoji: '🏰',
      description: '+50% DEF, immunisé aux debuffs',
      statModifiers: { defPct: 0.5, flags: ['immune_debuffs'] },
    },
  ],
  mage: [
    {
      id: 'archmage',
      name: 'Archimage',
      emoji: '🔮',
      description: '+30% dégâts des sorts',
      statModifiers: { spellDamagePct: 0.3 },
    },
    {
      id: 'blood_mage',
      name: 'Mage de Sang',
      emoji: '🩸',
      description: 'Les sorts coûtent des HP au lieu de l\'énergie',
      statModifiers: { flags: ['spells_cost_hp'] },
    },
    {
      id: 'storm_mage',
      name: 'Mage de la Tempête',
      emoji: '⛈️',
      description: 'AoE sur toutes les attaques',
      statModifiers: { flags: ['aoe_all_attacks'] },
    },
  ],
  gambler: [
    {
      id: 'high_roller',
      name: 'High Roller',
      emoji: '🎲',
      description: '+15% chance globale',
      statModifiers: { luckPct: 0.15 },
    },
    {
      id: 'cheat',
      name: 'Tricheur',
      emoji: '🃏',
      description: 'Voir l\'ennemi avant de parier',
      statModifiers: { flags: ['peek_enemy'] },
    },
    {
      id: 'wildcard',
      name: 'Joker',
      emoji: '🌟',
      description: 'Un perk aléatoire à chaque étage',
      statModifiers: { flags: ['random_perk_per_floor'] },
    },
  ],
  rogue: [
    {
      id: 'assassin',
      name: 'Assassin',
      emoji: '🗡️',
      description: '+50% dégâts critiques',
      statModifiers: { critDamagePct: 0.5 },
    },
    {
      id: 'shadow',
      name: 'Ombre',
      emoji: '🌑',
      description: 'Le premier coup critique toujours',
      statModifiers: { flags: ['first_hit_crit'] },
    },
    {
      id: 'acrobat',
      name: 'Acrobate',
      emoji: '🤸',
      description: '30% d\'esquive',
      statModifiers: { dodgeChance: 0.3 },
    },
  ],
};

// ============================================================
//  TRANSCENDENCES — chosen at mastery level 20 (1 per class)
// ============================================================

export interface Transcendence {
  id: string;
  name: string;
  emoji: string;
  description: string;
  statModifiers: StatModifiers;
}

export type TranscendenceMap = Record<ClassId, Transcendence>;

export const TRANSCENDENCES: TranscendenceMap = {
  warrior: {
    id: 'colosse',
    name: 'Colosse',
    emoji: '🗿',
    description: '+100% HP, étage bonus tous les 3 étages',
    statModifiers: { hpPct: 1.0, flags: ['bonus_floor_every_3'] },
  },
  mage: {
    id: 'archmage_supreme',
    name: 'Archimage Suprême',
    emoji: '✨',
    description: 'Sorts gratuits, triple lancer',
    statModifiers: { flags: ['spells_free', 'triple_cast'] },
  },
  gambler: {
    id: 'destiny_weaver',
    name: 'Tisseur de Destin',
    emoji: '🌀',
    description: 'Réécris n\'importe quel lancer',
    statModifiers: { flags: ['rewrite_any_roll'] },
  },
  rogue: {
    id: 'shadow_sovereign',
    name: 'Souverain de l\'Ombre',
    emoji: '👑',
    description: 'Ne peut pas mourir en un coup, 50% crit',
    statModifiers: { critChance: 0.5, flags: ['cannot_die_in_one_hit'] },
  },
};

// ============================================================
//  TYPES
// ============================================================

export interface MasteryProgress {
  userId: string;
  classId: ClassId;
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNext: number;
  ascendance: string | null;
  transcendence: string | null;
  rewardsUnlocked: number[];
  pendingChoices: ('ascendance' | 'transcendence')[];
}

// ============================================================
//  HELPERS
// ============================================================

/** Compute the level a user has reached for a given total XP. */
export function levelFromXp(totalXp: number): number {
  let level = 0;
  let remaining = totalXp;
  while (level < MAX_MASTERY_LEVEL) {
    const need = xpForLevel(level);
    if (remaining < need) break;
    remaining -= need;
    level++;
  }
  return level;
}

/** Returns reward levels that have been unlocked at the given mastery level. */
export function rewardsForLevel(level: number): number[] {
  return Object.keys(MASTERY_REWARDS)
    .map(Number)
    .filter((lvl) => level >= lvl)
    .sort((a, b) => a - b);
}

/** Choices the player still needs to make at the current level. */
export function pendingChoices(level: number): ('ascendance' | 'transcendence')[] {
  const pending: ('ascendance' | 'transcendence')[] = [];
  if (level >= 10) pending.push('ascendance');
  if (level >= 20) pending.push('transcendence');
  return pending;
}

/** Look up an ascendance definition by class + id. */
export function getAscendance(
  classId: ClassId,
  ascendanceId: string,
): Ascendance | undefined {
  return ASCENDANCES[classId]?.find((a) => a.id === ascendanceId);
}

/** Look up a transcendence definition by class + id. */
export function getTranscendence(
  classId: ClassId,
  transcId: string,
): Transcendence | undefined {
  const t = TRANSCENDENCES[classId];
  return t && t.id === transcId ? t : undefined;
}

// ============================================================
//  DATABASE FUNCTIONS
// ============================================================

/**
 * Get the mastery progress record for a user/class, creating it if missing.
 */
export async function getMasteryProgress(
  userId: string,
  classId: ClassId,
): Promise<MasteryProgress> {
  const row = await prisma.classMastery.upsert({
    where: { userId_classId: { userId, classId } },
    create: { userId, classId },
    update: {},
  });

  const level = row.level > 0 ? row.level : levelFromXp(row.xp);
  const xpIntoLevel = row.xp - totalXpForLevel(level);
  const xpForNext =
    level >= MAX_MASTERY_LEVEL ? 0 : xpForLevel(level) - xpIntoLevel;

  return {
    userId,
    classId,
    level,
    xp: row.xp,
    xpIntoLevel,
    xpForNext,
    ascendance: row.ascendance,
    transcendence: row.transcendence,
    rewardsUnlocked: rewardsForLevel(level),
    pendingChoices: pendingChoices(level).filter((choice) => {
      if (choice === 'ascendance') return !row.ascendance;
      if (choice === 'transcendence') return !row.transcendence;
      return false;
    }),
  };
}

/**
 * Add XP to a class mastery. Also bumps the stored level if it changed.
 * Returns the updated progress (after any potential level-up).
 */
export async function addMasteryXp(
  userId: string,
  classId: ClassId,
  amount: number,
): Promise<MasteryProgress> {
  if (amount <= 0) {
    return getMasteryProgress(userId, classId);
  }

  const current = await prisma.classMastery.upsert({
    where: { userId_classId: { userId, classId } },
    create: { userId, classId, xp: amount, level: levelFromXp(amount) },
    update: {},
  });

  const newXp = current.xp + amount;
  const newLevel = levelFromXp(newXp);

  await prisma.classMastery.update({
    where: { userId_classId: { userId, classId } },
    data: { xp: newXp, level: newLevel },
  });

  return getMasteryProgress(userId, classId);
}

/**
 * Check (and apply) any level-ups that should have occurred given stored XP.
 * Useful as a safety net after manual DB edits.
 * Returns the list of newly unlocked reward levels (may be empty).
 */
export async function checkMasteryLevelUp(
  userId: string,
  classId: ClassId,
): Promise<number[]> {
  const row = await prisma.classMastery.findUnique({
    where: { userId_classId: { userId, classId } },
  });
  if (!row) return [];

  const computed = levelFromXp(row.xp);
  if (computed <= row.level) return [];

  // Level went up: persist new level, return newly crossed reward thresholds.
  const oldRewards = new Set(rewardsForLevel(row.level));
  const newRewards = rewardsForLevel(computed);
  const unlocked = newRewards.filter((lvl) => !oldRewards.has(lvl));

  await prisma.classMastery.update({
    where: { userId_classId: { userId, classId } },
    data: { level: computed },
  });

  return unlocked;
}

/**
 * Pick an Ascendance at mastery level 10.
 * Validates that the player is high enough level, hasn't already chosen one,
 * and that the chosen id belongs to the requested class.
 */
export async function chooseAscendance(
  userId: string,
  classId: ClassId,
  ascendanceId: string,
): Promise<{ ok: boolean; error?: string }> {
  const def = getAscendance(classId, ascendanceId);
  if (!def) {
    return { ok: false, error: 'Ascendance invalide pour cette classe.' };
  }

  const row = await prisma.classMastery.findUnique({
    where: { userId_classId: { userId, classId } },
  });
  if (!row) {
    return { ok: false, error: 'Aucune progression de maîtrise trouvée.' };
  }
  if (row.level < 10) {
    return {
      ok: false,
      error: `Niveau 10 requis (actuel: ${row.level}).`,
    };
  }
  if (row.ascendance) {
    return { ok: false, error: 'Ascendance déjà choisie.' };
  }

  await prisma.classMastery.update({
    where: { userId_classId: { userId, classId } },
    data: { ascendance: ascendanceId },
  });
  return { ok: true };
}

/**
 * Pick a Transcendence at mastery level 20.
 * Same validation shape as chooseAscendance.
 */
export async function chooseTranscendence(
  userId: string,
  classId: ClassId,
  transcId: string,
): Promise<{ ok: boolean; error?: string }> {
  const def = getTranscendence(classId, transcId);
  if (!def) {
    return { ok: false, error: 'Transcendance invalide pour cette classe.' };
  }

  const row = await prisma.classMastery.findUnique({
    where: { userId_classId: { userId, classId } },
  });
  if (!row) {
    return { ok: false, error: 'Aucune progression de maîtrise trouvée.' };
  }
  if (row.level < 20) {
    return {
      ok: false,
      error: `Niveau 20 requis (actuel: ${row.level}).`,
    };
  }
  if (row.transcendence) {
    return { ok: false, error: 'Transcendance déjà choisie.' };
  }

  await prisma.classMastery.update({
    where: { userId_classId: { userId, classId } },
    data: { transcendence: transcId },
  });
  return { ok: true };
}
