/**
 * Gear / Equipment System — persistent items that grant stats during runs.
 *
 * 5 slots × 5 rarities × 8 sets.
 * Gear degrades by 1 durability per run; can be repaired with souls.
 * Set bonuses activate at 2 and 4 equipped pieces of the same set.
 */

import { prisma } from '../database.js';
import { RNG } from '../roguelite/rng.js';

// ============================================================
//  SLOTS & RARITIES
// ============================================================

export const GEAR_SLOTS = ['weapon', 'armor', 'ring', 'amulet', 'boots'] as const;
export type GearSlot = (typeof GEAR_SLOTS)[number];

export type GearRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface RarityDef {
  color: number; // Discord embed color
  statRange: [number, number]; // base stat multiplier range
  durability: number;
  weight: number; // relative drop weight
}

export const GEAR_RARITIES: Record<GearRarity, RarityDef> = {
  common:    { color: 0x9ca3af, statRange: [1.0, 1.5],  durability: 50,  weight: 100 },
  rare:      { color: 0x3b82f6, statRange: [1.5, 2.5],  durability: 70,  weight: 45 },
  epic:      { color: 0xa855f7, statRange: [2.5, 4.0],  durability: 85,  weight: 18 },
  legendary: { color: 0xf59e0b, statRange: [4.0, 6.5],  durability: 100, weight: 6 },
  mythic:    { color: 0xef4444, statRange: [6.5, 10.0], durability: 120, weight: 1 },
};

export const RARITY_ORDER: GearRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];

// ============================================================
//  GEAR SETS — 8 sets, each with 2- and 4-piece bonuses
// ============================================================

export interface GearSetBonus {
  description: string;
  effect: GearStatBonuses;
}

export interface GearSet {
  id: string;
  name: string;
  emoji: string;
  /** Number of distinct pieces in the full set (used for set-bonus counting). */
  pieces: number;
  bonus2: GearSetBonus;
  bonus4: GearSetBonus;
}

// Forward-declared bonuses shape (defined fully below).
export interface GearStatBonuses {
  hpFlat?: number;
  hpPct?: number;
  atkFlat?: number;
  atkPct?: number;
  defFlat?: number;
  defPct?: number;
  critChance?: number;
  critDamagePct?: number;
  energyFlat?: number;
  lifestealPct?: number;
  regenPerTurn?: number;
  dodgeChance?: number;
  luckPct?: number;
  coinsPct?: number;
  flags?: string[];
}

export const GEAR_SETS: Record<string, GearSet> = {
  phoenix: {
    id: 'phoenix',
    name: 'Set du Phénix',
    emoji: '🔥',
    pieces: 4,
    bonus2: {
      description: '+5 régénération HP/tour',
      effect: { regenPerTurn: 5 },
    },
    bonus4: {
      description: 'Résurrection une fois par run (50% HP)',
      effect: { flags: ['revive_once'] },
    },
  },
  vampire: {
    id: 'vampire',
    name: 'Set du Vampire',
    emoji: '🦇',
    pieces: 4,
    bonus2: {
      description: '+10% vol de vie',
      effect: { lifestealPct: 0.1 },
    },
    bonus4: {
      description: 'Spécial gratuit une fois par combat',
      effect: { flags: ['free_special_once'] },
    },
  },
  dragon: {
    id: 'dragon',
    name: 'Set du Dragon',
    emoji: '🐉',
    pieces: 4,
    bonus2: {
      description: '+50% HP',
      effect: { hpPct: 0.5 },
    },
    bonus4: {
      description: '+200% HP, immunité brûlure',
      effect: { hpPct: 2.0, flags: ['immune_burn'] },
    },
  },
  titan: {
    id: 'titan',
    name: 'Set du Titan',
    emoji: '🗿',
    pieces: 4,
    bonus2: {
      description: '+10 DEF',
      effect: { defFlat: 10 },
    },
    bonus4: {
      description: '+50% DEF, immunisé aux debuffs',
      effect: { defPct: 0.5, flags: ['immune_debuffs'] },
    },
  },
  assassin: {
    id: 'assassin',
    name: 'Set de l\'Assassin',
    emoji: '🗡️',
    pieces: 4,
    bonus2: {
      description: '+10% crit chance',
      effect: { critChance: 0.1 },
    },
    bonus4: {
      description: '+50% dégâts crit, premier coup toujours crit',
      effect: { critDamagePct: 0.5, flags: ['first_hit_crit'] },
    },
  },
  sage: {
    id: 'sage',
    name: 'Set du Sage',
    emoji: '📜',
    pieces: 4,
    bonus2: {
      description: '+2 énergie max',
      effect: { energyFlat: 2 },
    },
    bonus4: {
      description: '+4 énergie max, sorts -50% coût',
      effect: { energyFlat: 4, flags: ['spells_half_cost'] },
    },
  },
  berserker: {
    id: 'berserker',
    name: 'Set du Berserker',
    emoji: '😡',
    pieces: 4,
    bonus2: {
      description: '+20% ATK si HP < 50%',
      effect: { flags: ['berserk_low_hp'] },
    },
    bonus4: {
      description: 'x3 dégâts si HP < 25%, +30% ATK',
      effect: { atkPct: 0.3, flags: ['berserk_frenzy'] },
    },
  },
  cosmos: {
    id: 'cosmos',
    name: 'Set du Cosmos',
    emoji: '🌌',
    pieces: 4,
    bonus2: {
      description: '+15% toutes stats aléatoires',
      effect: { flags: ['cosmos_random_2'] },
    },
    bonus4: {
      description: 'Effet puissant aléatoire chaque combat',
      effect: { flags: ['cosmos_random_4'] },
    },
  },
};

// ============================================================
//  ITEM NAME POOLS — used by generateGear
// ============================================================

const SLOT_NAMES: Record<GearSlot, { prefixes: string[]; bases: string[]; emojis: string[] }> = {
  weapon:  {
    prefixes: ['Épée', 'Hache', 'Marteau', 'Dague', 'Bâton', 'Arc'],
    bases: ['du Guerrier', 'de Feu', 'de Glace', 'des Anciens', 'Maudite', 'Bénie'],
    emojis: ['⚔️', '🪓', '🔨', '🗡️', '🪄', '🏹'],
  },
  armor: {
    prefixes: ['Armure', 'Cotte', 'Plastron', 'Robe', 'Cape'],
    bases: ['du Gardien', 'en Mithril', 'de Dragon', 'Éternelle', 'de Bataille'],
    emojis: ['🛡️', '🥋', '👘', '🧥', '🎽'],
  },
  ring: {
    prefixes: ['Anneau', 'Bague', 'Chevalière'],
    bases: ['de Puissance', 'de Sagesse', 'de Vitesse', 'Maudit', 'Royal'],
    emojis: ['💍', '🗨️', '🔱'],
  },
  amulet: {
    prefixes: ['Amulette', 'Pendentif', 'Talisman', 'Médaillon'],
    bases: ['de Vie', 'd\'Âme', 'du Néant', 'Éternel', 'Lumineux'],
    emojis: ['📿', '🔮', '✨', '🔯'],
  },
  boots: {
    prefixes: ['Bottes', 'Sandales', 'Jambières', 'Souliers'],
    bases: ['de Vitesse', 'du Vent', 'du Voyageur', 'Légères', 'de Plomb'],
    emojis: ['🥾', '👢', '🦵', '👞'],
  },
};

const RARITY_PREFIX: Record<GearRarity, string> = {
  common: '',
  rare: 'Rare ',
  epic: 'Épique ',
  legendary: 'Légendaire ',
  mythic: 'Mythique ',
};

// ============================================================
//  TYPES
// ============================================================

export type GearStats = Record<string, number>;

export interface GearItem {
  id: string;
  slot: GearSlot;
  itemId: string;
  name: string;
  emoji: string;
  rarity: GearRarity;
  stats: GearStats;
  setId: string | null;
  durability: number;
  maxDurability: number;
  equipped: boolean;
}

/** Shape returned by getGearBonus — aggregated equipped stats. */
export interface AggregatedGearBonus {
  hpFlat: number;
  hpPct: number;
  atkFlat: number;
  atkPct: number;
  defFlat: number;
  defPct: number;
  critChance: number;
  critDamagePct: number;
  energyFlat: number;
  lifestealPct: number;
  regenPerTurn: number;
  dodgeChance: number;
  luckPct: number;
  coinsPct: number;
  flags: string[];
  /** Active set bonuses (setId → which bonus tiers are active). */
  activeSets: { setId: string; name: string; pieces: number; tiers: ('bonus2' | 'bonus4')[] }[];
}

// ============================================================
//  GENERATION
// ============================================================

/** Pick a rarity by weighted random given the floor (higher floor → better odds). */
function rollRarity(rng: RNG, floor: number): GearRarity {
  // Floor nudges weights toward rarer tiers.
  const floorBoost = Math.min(floor / 50, 1); // 0 at floor 0 → 1 at floor 50+
  const entries = RARITY_ORDER.map((r, idx) => {
    const base = GEAR_RARITIES[r].weight;
    // Rarer tiers get a larger relative boost from floor.
    const boost = 1 + floorBoost * idx * 0.8;
    return { r, w: base * boost };
  });
  const total = entries.reduce((s, e) => s + e.w, 0);
  let roll = rng.float() * total;
  for (const e of entries) {
    roll -= e.w;
    if (roll <= 0) return e.r;
  }
  return 'common';
}

/** Stat keys appropriate to a slot. */
function statKeysForSlot(slot: GearSlot): string[] {
  switch (slot) {
    case 'weapon':  return ['atk', 'critChance', 'critDamagePct'];
    case 'armor':   return ['def', 'hp'];
    case 'ring':    return ['atk', 'def', 'hp', 'luckPct'];
    case 'amulet':  return ['hp', 'energyFlat', 'critChance', 'lifestealPct'];
    case 'boots':   return ['dodgeChance', 'hp', 'energyFlat'];
  }
}

/** Base magnitude per stat key (before rarity scaling). */
function baseStatMagnitude(key: string, floor: number): number {
  const floorScale = 1 + floor * 0.1; // stats grow with floor
  switch (key) {
    case 'atk':             return 3 * floorScale;
    case 'def':             return 2 * floorScale;
    case 'hp':              return 15 * floorScale;
    case 'critChance':      return 0.02; // 2%
    case 'critDamagePct':   return 0.05; // 5%
    case 'energyFlat':      return 0.5;
    case 'lifestealPct':    return 0.02;
    case 'dodgeChance':     return 0.02;
    case 'luckPct':         return 0.02;
    default:                return 1;
  }
}

/** Round a stat to a sensible number of decimals for its key. */
function roundStat(key: string, value: number): number {
  switch (key) {
    case 'atk':
    case 'def':
    case 'hp':
    case 'energyFlat':
      return Math.max(1, Math.round(value));
    case 'critChance':
    case 'critDamagePct':
    case 'lifestealPct':
    case 'dodgeChance':
    case 'luckPct':
      return Math.round(value * 1000) / 1000;
    default:
      return Math.round(value * 100) / 100;
  }
}

/**
 * Generate a new gear piece appropriate to the given floor and (optional) rarity.
 * Uses the provided RNG for deterministic output.
 */
export function generateGear(
  rng: RNG,
  floor: number,
  rarity?: GearRarity,
): GearItem {
  const slot = rng.pick(GEAR_SLOTS as readonly GearSlot[]);
  const finalRarity = rarity ?? rollRarity(rng, floor);
  const rarityDef = GEAR_RARITIES[finalRarity];

  // Roll 1-3 stat lines depending on rarity.
  const statLineCount =
    finalRarity === 'common' ? 1
    : finalRarity === 'rare' ? 2
    : finalRarity === 'epic' ? 3
    : finalRarity === 'legendary' ? 3
    : 4; // mythic

  const possibleKeys = statKeysForSlot(slot);
  const chosenKeys = rng.pickN(possibleKeys, Math.min(statLineCount, possibleKeys.length));

  const stats: GearStats = {};
  const [minMul, maxMul] = rarityDef.statRange;
  for (const key of chosenKeys) {
    const base = baseStatMagnitude(key, floor);
    const mul = minMul + rng.float() * (maxMul - minMul);
    stats[key] = roundStat(key, base * mul);
  }

  // 30% chance to belong to a set (only at rare+).
  let setId: string | null = null;
  if (finalRarity !== 'common' && rng.chance(0.3)) {
    setId = rng.pick(Object.keys(GEAR_SETS));
  }

  // Name
  const pool = SLOT_NAMES[slot];
  const prefix = rng.pick(pool.prefixes);
  const base = rng.pick(pool.bases);
  const emoji = rng.pick(pool.emojis);
  const name = `${RARITY_PREFIX[finalRarity]}${prefix} ${base}`;

  const durability = rarityDef.durability;
  const itemId = `${slot}_${finalRarity}_${Math.floor(rng.float() * 1e9).toString(36)}`;

  return {
    id: '', // filled on DB insert
    slot,
    itemId,
    name,
    emoji,
    rarity: finalRarity,
    stats,
    setId,
    durability,
    maxDurability: durability,
    equipped: false,
  };
}

// ============================================================
//  HELPERS
// ============================================================

function toAggregated(b: GearStatBonuses, target: AggregatedGearBonus): void {
  if (b.hpFlat)          target.hpFlat += b.hpFlat;
  if (b.hpPct)           target.hpPct += b.hpPct;
  if (b.atkFlat)         target.atkFlat += b.atkFlat;
  if (b.atkPct)          target.atkPct += b.atkPct;
  if (b.defFlat)         target.defFlat += b.defFlat;
  if (b.defPct)          target.defPct += b.defPct;
  if (b.critChance)      target.critChance += b.critChance;
  if (b.critDamagePct)   target.critDamagePct += b.critDamagePct;
  if (b.energyFlat)      target.energyFlat += b.energyFlat;
  if (b.lifestealPct)    target.lifestealPct += b.lifestealPct;
  if (b.regenPerTurn)    target.regenPerTurn += b.regenPerTurn;
  if (b.dodgeChance)     target.dodgeChance += b.dodgeChance;
  if (b.luckPct)         target.luckPct += b.luckPct;
  if (b.coinsPct)        target.coinsPct += b.coinsPct;
  if (b.flags)           for (const f of b.flags) target.flags.push(f);
}

// ============================================================
//  DATABASE FUNCTIONS
// ============================================================

/** Internal: convert a Prisma gear row into a GearItem. */
function rowToItem(row: GearRow): GearItem {
  return {
    id: row.id,
    slot: row.slot as GearSlot,
    itemId: row.itemId,
    name: row.name,
    emoji: row.emoji,
    rarity: row.rarity as GearRarity,
    stats: (row.stats ?? {}) as GearStats,
    setId: row.setId,
    durability: row.durability,
    maxDurability: row.maxDurability,
    equipped: row.equipped,
  };
}

type GearRow = {
  id: string;
  ownerId: string;
  slot: string;
  itemId: string;
  name: string;
  emoji: string;
  rarity: string;
  stats: unknown;
  setId: string | null;
  durability: number;
  maxDurability: number;
  equipped: boolean;
};

/**
 * Equip a gear piece. Unequips whatever was previously in that slot.
 * The piece must belong to the user and not be broken (durability > 0).
 */
export async function equipGear(
  userId: string,
  gearId: string,
): Promise<{ ok: boolean; error?: string }> {
  const gear = await prisma.gear.findUnique({ where: { id: gearId } });
  if (!gear || gear.ownerId !== userId) {
    return { ok: false, error: 'Équipement introuvable.' };
  }
  if (gear.durability <= 0) {
    return { ok: false, error: 'Équipement cassé — répare-le d\'abord.' };
  }

  await prisma.$transaction([
    prisma.gear.updateMany({
      where: { ownerId: userId, slot: gear.slot, equipped: true },
      data: { equipped: false },
    }),
    prisma.gear.update({
      where: { id: gearId },
      data: { equipped: true },
    }),
  ]);
  return { ok: true };
}

/** Unequip whatever is in a given slot. */
export async function unequipGear(
  userId: string,
  slot: GearSlot,
): Promise<{ ok: boolean; error?: string }> {
  const res = await prisma.gear.updateMany({
    where: { ownerId: userId, slot, equipped: true },
    data: { equipped: false },
  });
  if (res.count === 0) {
    return { ok: false, error: 'Aucun équipement dans cet emplacement.' };
  }
  return { ok: true };
}

/**
 * Degrade all equipped gear by 1 durability. Called once per run.
 * Items reaching 0 durability stay equipped but are effectively broken.
 * Returns the list of items that broke this tick.
 */
export async function degradeGear(
  userId: string,
): Promise<{ broke: GearItem[] }> {
  const equipped = await prisma.gear.findMany({
    where: { ownerId: userId, equipped: true },
  });

  const broke: GearItem[] = [];
  for (const g of equipped) {
    const newDur = Math.max(0, g.durability - 1);
    await prisma.gear.update({
      where: { id: g.id },
      data: { durability: newDur },
    });
    if (g.durability === 1 && newDur === 0) {
      broke.push(rowToItem(g as GearRow));
    }
  }
  return { broke };
}

/**
 * Repair a gear item to full durability. Cost scales with rarity and missing durability.
 * Returns { ok, cost, error? } — on success the souls have been spent.
 */
export async function repairGear(
  userId: string,
  gearId: string,
): Promise<{ ok: boolean; cost?: number; error?: string }> {
  const gear = await prisma.gear.findUnique({ where: { id: gearId } });
  if (!gear || gear.ownerId !== userId) {
    return { ok: false, error: 'Équipement introuvable.' };
  }
  const missing = gear.maxDurability - gear.durability;
  if (missing === 0) {
    return { ok: false, error: 'Déjà en parfait état.' };
  }

  const rarityIdx = RARITY_ORDER.indexOf(gear.rarity as GearRarity);
  const perPoint = 2 * (rarityIdx + 1); // common=2 ... mythic=10 souls/point
  const cost = missing * perPoint;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { souls: true },
  });
  if (!user) return { ok: false, error: 'Utilisateur introuvable.' };
  if (user.souls < cost) {
    return { ok: false, error: `Âmes insuffisantes (${cost} requis).` };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { souls: { decrement: cost } },
    }),
    prisma.gear.update({
      where: { id: gearId },
      data: { durability: gear.maxDurability },
    }),
  ]);
  return { ok: true, cost };
}

/**
 * Aggregate stats from all equipped gear + active set bonuses.
 */
export async function getGearBonus(userId: string): Promise<AggregatedGearBonus> {
  const equipped = await prisma.gear.findMany({
    where: { ownerId: userId, equipped: true },
  });

  const bonus: AggregatedGearBonus = {
    hpFlat: 0, hpPct: 0, atkFlat: 0, atkPct: 0, defFlat: 0, defPct: 0,
    critChance: 0, critDamagePct: 0, energyFlat: 0, lifestealPct: 0,
    regenPerTurn: 0, dodgeChance: 0, luckPct: 0, coinsPct: 0,
    flags: [],
    activeSets: [],
  };

  // 1) Sum per-item stats.
  for (const g of equipped) {
    const stats = (g.stats ?? {}) as GearStats;
    if (typeof stats.atk === 'number')           bonus.atkFlat += stats.atk;
    if (typeof stats.def === 'number')           bonus.defFlat += stats.def;
    if (typeof stats.hp === 'number')            bonus.hpFlat += stats.hp;
    if (typeof stats.critChance === 'number')    bonus.critChance += stats.critChance;
    if (typeof stats.critDamagePct === 'number') bonus.critDamagePct += stats.critDamagePct;
    if (typeof stats.energyFlat === 'number')    bonus.energyFlat += stats.energyFlat;
    if (typeof stats.lifestealPct === 'number')  bonus.lifestealPct += stats.lifestealPct;
    if (typeof stats.dodgeChance === 'number')   bonus.dodgeChance += stats.dodgeChance;
    if (typeof stats.luckPct === 'number')       bonus.luckPct += stats.luckPct;
  }

  // 2) Apply active set bonuses.
  const setActive = await getSetActive(userId);
  for (const s of setActive) {
    const setDef = GEAR_SETS[s.setId];
    if (!setDef) continue;
    if (s.tiers.includes('bonus2')) toAggregated(setDef.bonus2.effect, bonus);
    if (s.tiers.includes('bonus4')) toAggregated(setDef.bonus4.effect, bonus);
  }
  bonus.activeSets = setActive;

  return bonus;
}

/**
 * Compute active set bonuses based on currently equipped gear.
 * Returns one entry per set with >= 2 equipped pieces.
 */
export async function getSetActive(
  userId: string,
): Promise<{ setId: string; name: string; pieces: number; tiers: ('bonus2' | 'bonus4')[] }[]> {
  const equipped = await prisma.gear.findMany({
    where: { ownerId: userId, equipped: true, setId: { not: null } },
    select: { setId: true },
  });

  const counts = new Map<string, number>();
  for (const g of equipped) {
    if (!g.setId) continue;
    counts.set(g.setId, (counts.get(g.setId) ?? 0) + 1);
  }

  const result: { setId: string; name: string; pieces: number; tiers: ('bonus2' | 'bonus4')[] }[] = [];
  for (const [setId, pieces] of counts) {
    const def = GEAR_SETS[setId];
    if (!def) continue;
    const tiers: ('bonus2' | 'bonus4')[] = [];
    if (pieces >= 2) tiers.push('bonus2');
    if (pieces >= 4) tiers.push('bonus4');
    if (tiers.length > 0) {
      result.push({ setId, name: def.name, pieces, tiers });
    }
  }
  return result;
}

/**
 * Persist a freshly generated gear item to a user's inventory.
 * (generateGear itself stays pure / deterministic; this is the persistence step.)
 */
export async function grantGear(
  userId: string,
  item: GearItem,
): Promise<GearItem> {
  const created = await prisma.gear.create({
    data: {
      ownerId: userId,
      slot: item.slot,
      itemId: item.itemId,
      name: item.name,
      emoji: item.emoji,
      rarity: item.rarity,
      stats: item.stats as Record<string, number>,
      setId: item.setId,
      durability: item.durability,
      maxDurability: item.maxDurability,
      equipped: false,
    },
  });
  return rowToItem(created as GearRow);
}

/** Get all gear owned by a user (optionally only a slot, or only equipped). */
export async function getUserGear(
  userId: string,
  opts?: { slot?: GearSlot; equipped?: boolean },
): Promise<GearItem[]> {
  const rows = await prisma.gear.findMany({
    where: {
      ownerId: userId,
      ...(opts?.slot ? { slot: opts.slot } : {}),
      ...(opts?.equipped !== undefined ? { equipped: opts.equipped } : {}),
    },
    orderBy: { acquiredAt: 'desc' },
  });
  return rows.map((r: typeof rows[number]) => rowToItem(r as GearRow));
}
