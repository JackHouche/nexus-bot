/**
 * Perk & Enemy Modifier System for NEXUS roguelite.
 *
 * Perk modifiers ("variants") mutate a base perk's behavior — adding DoT, AoE,
 * lifesteal, or multiplying power at a cost. Enemy modifiers transform a base
 * enemy into a tougher, weirder version. Both are rolled based on floor depth
 * so deeper floors see rarer / more dangerous modifiers.
 */

import { RNG } from './rng.js';
import type { Perk, PerkEffect } from './perks.js';
import type { Enemy } from './enemies.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModifierRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/**
 * A perk modifier. `effects` are merged into the base perk's `effects`.
 * `malus` is an optional downside applied alongside the buff.
 */
export interface PerkModifier {
  id: string;
  name: string;
  rarity: ModifierRarity;
  effects: PerkEffect;
  /** Optional downside merged on top of effects (e.g. corrupted). */
  malus?: PerkEffect;
  description: string;
}

/**
 * Runtime shape of an enemy modifier — flags consumed by combat resolution.
 * These are carried on the enemy and read by the combat loop.
 */
export interface EnemyModifierEffects {
  atkMult?: number;
  atkAddPerTurn?: number;
  hpMult?: number;
  defMult?: number;
  defAdd?: number;
  lifestealPct?: number;
  attacksPerTurn?: number;
  attacksFirst?: boolean;
  blocksFirstHit?: boolean;
  auraDamagePerTurn?: number;
  explodesOnDeath?: boolean;
  poisonsOnHit?: boolean;
  stealsEnergy?: number;
  copiesPlayerPerks?: boolean;
  shiftsTypeEachTurn?: boolean;
  disablesRandomPerk?: boolean;
  berserk?: boolean;
}

export interface EnemyModifier {
  id: string;
  name: string;
  rarity: ModifierRarity;
  effects: EnemyModifierEffects;
  description: string;
}

/** A perk after a modifier is applied. */
export interface ModifiedPerk extends Perk {
  modifierId: string;
  modifierName: string;
  /** Original description retained for UI display. */
  baseDescription: string;
}

/** An enemy after a modifier is applied. */
export interface ModifiedEnemy extends Enemy {
  modifierId: string;
  modifierName: string;
  modifierEffects: EnemyModifierEffects;
}

// ---------------------------------------------------------------------------
// Perk modifiers (30)
// ---------------------------------------------------------------------------

export const PERK_MODIFIERS: PerkModifier[] = [
  // --- Common (flavorful minor buffs) ---
  {
    id: 'burning', name: 'Ardent', rarity: 'common',
    effects: {}, description: 'Ajoute des dégâts de brûlure (DoT) à chaque attaque.',
  },
  {
    id: 'frozen', name: 'Givré', rarity: 'common',
    effects: { stunChance: 0.1 }, description: 'Ralentit l\'ennemi : 10% de stun.',
  },
  {
    id: 'toxic', name: 'Toxique', rarity: 'common',
    effects: {}, description: 'Empoisonne l\'ennemi (dégâts cumulatifs).',
  },
  {
    id: 'sharp', name: 'Affûté', rarity: 'common',
    effects: { atkFlat: 3 }, description: '+3 ATK plat.',
  },
  {
    id: 'sturdy', name: 'Robuste', rarity: 'common',
    effects: { defFlat: 3 }, description: '+3 DEF plat.',
  },
  {
    id: 'lucky', name: 'Chanceux', rarity: 'common',
    effects: { luckBonus: 0.05 }, description: '+5% aux probabilités favorables.',
  },
  {
    id: 'gleaming', name: 'Étincelant', rarity: 'common',
    effects: { coinsPct: 0.15 }, description: '+15% de coins.',
  },
  {
    id: 'quickened', name: 'Vif', rarity: 'common',
    effects: { dodgeChance: 0.1 }, description: '+10% d\'esquive.',
  },
  {
    id: 'vigorous', name: 'Vigoureux', rarity: 'common',
    effects: { hpFlat: 20 }, description: '+20 HP max.',
  },

  // --- Uncommon (notable mechanics) ---
  {
    id: 'explosive', name: 'Explosif', rarity: 'uncommon',
    effects: { aoeAttack: true }, description: 'Les attaques explosent (AoE).',
  },
  {
    id: 'piercing', name: 'Perçant', rarity: 'uncommon',
    effects: {}, description: 'Ignore la DEF ennemie.',
  },
  {
    id: 'vampiric', name: 'Vampirique', rarity: 'uncommon',
    effects: { lifestealPct: 0.25 }, description: 'Vole 25% des dégâts en HP.',
  },
  {
    id: 'heavy', name: 'Lourd', rarity: 'uncommon',
    effects: { atkPct: 0.3, defPct: -0.1 }, description: '+30% ATK, -10% DEF.',
  },
  {
    id: 'blessed', name: 'Béni', rarity: 'uncommon',
    effects: { regenPerTurn: 3 }, description: 'Soigne 3 HP/tour.',
  },
  {
    id: 'critical', name: 'Critique', rarity: 'uncommon',
    effects: { critChance: 0.15 }, description: '+15% de coup critique.',
  },
  {
    id: 'swift', name: 'Véloce', rarity: 'uncommon',
    effects: { doubleAttack: true }, description: 'Attaque 2x par tour.',
  },

  // --- Rare (powerful, may carry a cost) ---
  {
    id: 'echo', name: 'Écho', rarity: 'rare',
    effects: { doubleAttack: true }, description: 'Déclenche l\'effet 2x.',
  },
  {
    id: 'ethereal', name: 'Éthéré', rarity: 'rare',
    effects: {}, description: 'Duplique l\'effet (deux sources).',
  },
  {
    id: 'stormcharged', name: 'Chargé Tempête', rarity: 'rare',
    effects: { atkPct: 0.4, stunChance: 0.15 }, description: '+40% ATK, 15% stun.',
  },
  {
    id: 'runed', name: 'Runique', rarity: 'rare',
    effects: { atkPct: 0.25, defPct: 0.25 }, description: '+25% ATK & DEF.',
  },
  {
    id: 'bloodbound', name: 'Lié au Sang', rarity: 'rare',
    effects: { atkPct: 0.5, lifestealPct: 0.2 }, description: '+50% ATK, vole 20% HP.',
  },

  // --- Epic (huge power, real downside) ---
  {
    id: 'corrupted', name: 'Corrompu', rarity: 'epic',
    effects: { atkPct: 1.0 },
    malus: { defPct: -0.3, hpPct: -0.2 },
    description: 'Double la puissance (malus DEF/HP).',
  },
  {
    id: 'ancient', name: 'Ancien', rarity: 'epic',
    effects: { atkPct: 0.8, defPct: 0.8, hpPct: 0.3 },
    description: '+80% ATK & DEF, +30% HP.',
  },
  {
    id: 'voidtouched', name: 'Touché du Néant', rarity: 'epic',
    effects: { critChance: 0.3, critMult: 3.0 },
    malus: { hpPct: -0.25 },
    description: '+30% crit x3, mais -25% HP.',
  },
  {
    id: 'soulforged', name: 'Forgé d\'Âme', rarity: 'epic',
    effects: { atkPct: 0.6, lifestealPct: 0.4, defPct: 0.2 },
    description: '+60% ATK, vole 40% HP, +20% DEF.',
  },

  // --- Legendary (ultimate forms) ---
  {
    id: 'primordial', name: 'Primordial', rarity: 'legendary',
    effects: { atkPct: 1.5, defPct: 1.0, hpPct: 1.0, lifestealPct: 0.5 },
    description: 'Forme ultime : tous les stats doublés, vol de vie massif.',
  },
  {
    id: 'celestial', name: 'Céleste', rarity: 'legendary',
    effects: { atkPct: 1.0, defPct: 1.0, regenPerTurn: 10, blockChance: 0.5 },
    description: 'Bénédiction céleste : +100% stats, regen 10/tour, 50% block.',
  },
  {
    id: 'abyssal', name: 'Abyssal', rarity: 'legendary',
    effects: { atkPct: 2.0, critChance: 0.5, critMult: 4.0 },
    malus: { defPct: -0.5, hpPct: -0.3 },
    description: 'Puissance abyssale : +200% ATK, crit massif, mais très fragile.',
  },
  {
    id: 'golden', name: 'Doré', rarity: 'rare',
    effects: { coinsPct: 0.5, luckBonus: 0.1, hpFlat: 30 },
    description: '+50% coins, +10% chance, +30 HP. Le confort avant tout.',
  },
  {
    id: 'mythic', name: 'Mythique', rarity: 'legendary',
    effects: {
      atkPct: 1.2, defPct: 0.8, hpPct: 0.8,
      critChance: 0.25, critMult: 3.0, lifestealPct: 0.3, regenPerTurn: 5,
    },
    description: 'L\'aboutissement légendaire : tous les stats décuplés, regen et vol de vie.',
  },
];

// ---------------------------------------------------------------------------
// Enemy modifiers (15)
// ---------------------------------------------------------------------------

export const ENEMY_MODIFIERS: EnemyModifier[] = [
  {
    id: 'enraged', name: 'Enragé', rarity: 'uncommon',
    effects: { atkMult: 1.8, hpMult: 0.67 },
    description: '+80% ATK, -33% HP.',
  },
  {
    id: 'armored', name: 'Cuirassé', rarity: 'uncommon',
    effects: { defMult: 2.0 },
    description: '+100% DEF.',
  },
  {
    id: 'mirror', name: 'Miroir', rarity: 'epic',
    effects: { copiesPlayerPerks: true },
    description: 'Copie les perks du joueur.',
  },
  {
    id: 'poisonous', name: 'Venimeux', rarity: 'common',
    effects: { poisonsOnHit: true },
    description: 'Inflige du poison à chaque coup.',
  },
  {
    id: 'berserk', name: 'Berserk', rarity: 'rare',
    effects: { berserk: true, atkAddPerTurn: 2 },
    description: 'L\'ATK augmente chaque tour.',
  },
  {
    id: 'vampiric', name: 'Vampirique', rarity: 'rare',
    effects: { lifestealPct: 0.5 },
    description: 'Soigne 50% des dégâts infligés.',
  },
  {
    id: 'exploder', name: 'Exploseur', rarity: 'uncommon',
    effects: { explodesOnDeath: true },
    description: 'Explose à la mort.',
  },
  {
    id: 'shifter', name: 'Métamorphe', rarity: 'rare',
    effects: { shiftsTypeEachTurn: true },
    description: 'Change de type chaque tour.',
  },
  {
    id: 'colossal', name: 'Colossal', rarity: 'uncommon',
    effects: { hpMult: 3.0 },
    description: '+200% HP.',
  },
  {
    id: 'swift', name: 'Fulgurant', rarity: 'uncommon',
    effects: { attacksFirst: true },
    description: 'Attaque en premier.',
  },
  {
    id: 'cursed', name: 'Maudit', rarity: 'epic',
    effects: { disablesRandomPerk: true },
    description: 'Désactive une perk aléatoire du joueur.',
  },
  {
    id: 'fortified', name: 'Fortifié', rarity: 'rare',
    effects: { blocksFirstHit: true },
    description: 'Bloque le premier coup.',
  },
  {
    id: 'noxious', name: 'Nocif', rarity: 'uncommon',
    effects: { auraDamagePerTurn: 5 },
    description: 'Aura : 5 dégâts/tour.',
  },
  {
    id: 'soulstealer', name: 'Voleur d\'Âmes', rarity: 'epic',
    effects: { stealsEnergy: 1 },
    description: 'Vole 1 énergie par tour.',
  },
  {
    id: 'frenzied', name: 'Frénétique', rarity: 'rare',
    effects: { attacksPerTurn: 2 },
    description: '2 attaques par tour.',
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

const PERK_MODIFIER_MAP: ReadonlyMap<string, PerkModifier> = new Map(
  PERK_MODIFIERS.map((m) => [m.id, m]),
);

const ENEMY_MODIFIER_MAP: ReadonlyMap<string, EnemyModifier> = new Map(
  ENEMY_MODIFIERS.map((m) => [m.id, m]),
);

export function getPerkModifier(id: string): PerkModifier | undefined {
  return PERK_MODIFIER_MAP.get(id);
}

export function getEnemyModifier(id: string): EnemyModifier | undefined {
  return ENEMY_MODIFIER_MAP.get(id);
}

// ---------------------------------------------------------------------------
// Effect merging
// ---------------------------------------------------------------------------

/**
 * Merge two PerkEffect records. Numeric fields add; booleans OR together.
 * Fields are handled explicitly so TypeScript can type-check each assignment.
 */
function mergePerkEffects(a: PerkEffect, b: PerkEffect): PerkEffect {
  const out: PerkEffect = { ...a };

  // Numeric fields: additive.
  const addNum = (key: keyof PerkEffect): void => {
    const bv = b[key];
    if (typeof bv === 'number') {
      const av = out[key];
      (out[key] as number) = (typeof av === 'number' ? av : 0) + bv;
    }
  };
  addNum('atkFlat');
  addNum('atkPct');
  addNum('defFlat');
  addNum('defPct');
  addNum('hpFlat');
  addNum('hpPct');
  addNum('critChance');
  addNum('critMult');
  addNum('lifestealPct');
  addNum('stunChance');
  addNum('dodgeChance');
  addNum('blockChance');
  addNum('regenPerTurn');
  addNum('coinsPct');
  addNum('pactMultiplier');
  addNum('luckBonus');

  // Boolean fields: OR together.
  if (b.doubleAttack) out.doubleAttack = true;
  if (b.aoeAttack) out.aoeAttack = true;
  if (b.rerollFree) out.rerollFree = true;
  if (b.cantFlee) out.cantFlee = true;
  if (b.berserkLowHp) out.berserkLowHp = true;
  if (b.fragile) out.fragile = true;

  return out;
}

// ---------------------------------------------------------------------------
// Perk modifier functions
// ---------------------------------------------------------------------------

/**
 * Apply a perk modifier to a base perk. Returns a new perk object with merged
 * effects, an updated name/description, and metadata about the modifier.
 * Unknown modifier IDs return the base perk unchanged.
 */
export function applyPerkModifier(basePerk: Perk, modifierId: string): ModifiedPerk {
  const mod = PERK_MODIFIER_MAP.get(modifierId);
  if (!mod) {
    return {
      ...basePerk,
      modifierId: 'none',
      modifierName: '',
      baseDescription: basePerk.description,
    };
  }

  let merged = mergePerkEffects(basePerk.effects, mod.effects);
  if (mod.malus) {
    merged = mergePerkEffects(merged, mod.malus);
  }

  return {
    ...basePerk,
    name: `${basePerk.name} ${mod.name}`,
    effects: merged,
    description: `${basePerk.description} [${mod.name}: ${mod.description}]`,
    rarity: higherRarity(basePerk.rarity, mod.rarity),
    modifierId: mod.id,
    modifierName: mod.name,
    baseDescription: basePerk.description,
  };
}

const RARITY_ORDER: ModifierRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

function higherRarity(a: ModifierRarity, b: ModifierRarity): ModifierRarity {
  return RARITY_ORDER.indexOf(a) >= RARITY_ORDER.indexOf(b) ? a : b;
}

// ---------------------------------------------------------------------------
// Perk modifier rolling
// ---------------------------------------------------------------------------

/**
 * Roll a perk variant for a base perk id. Deeper floors raise the odds of
 * rarer modifiers. Returns the base perk (unmodified) if the roll fails.
 *
 * Note: `basePerkId` is accepted to keep the signature stable with future
 * lookups; the modifier table is floor-weighted, not perk-specific.
 */
export function rollPerkVariant(basePerkId: string, rng: RNG, floor = 1): ModifiedPerk {
  // Resolve the base perk lazily so this module stays decoupled from the
  // PERKS registry import at module-load time.
  // (Caller is expected to pass a real Perk to applyPerkModifier; this helper
  //  instead rolls a modifier id and builds a synthetic base perk.)
  const syntheticBase: Perk = {
    id: basePerkId,
    name: basePerkId,
    emoji: '✨',
    category: 'utility',
    description: '',
    rarity: 'common',
    effects: {},
  };

  const mod = rollPerkModifier(rng, floor);
  return mod ? applyPerkModifier(syntheticBase, mod.id) : applyPerkModifier(syntheticBase, 'none');
}

/** Internal: pick a perk modifier id by floor-weighted rarity, or null. */
function rollPerkModifier(rng: RNG, floor: number): PerkModifier | null {
  // Base chance to get ANY modifier at all. Scales with depth.
  const baseChance = Math.min(0.85, 0.3 + floor * 0.012);
  if (!rng.chance(baseChance)) return null;

  // Rarity weights shift toward rarer mods as floor rises.
  const depthFactor = Math.min(1, floor / 50); // 0..1
  const weights: Record<ModifierRarity, number> = {
    common: 50 - depthFactor * 30,
    uncommon: 30 - depthFactor * 10,
    rare: 15 + depthFactor * 15,
    epic: 4 + depthFactor * 18,
    legendary: 1 + depthFactor * 12,
  };

  return rollByRarity(rng, PERK_MODIFIERS, weights);
}

// ---------------------------------------------------------------------------
// Enemy modifier functions
// ---------------------------------------------------------------------------

/**
 * Apply an enemy modifier to a base enemy. Returns a new enemy with scaled
 * stats and a `modifierEffects` block the combat loop reads.
 * Unknown modifier IDs return the base enemy unchanged.
 */
export function applyEnemyModifier(baseEnemy: Enemy, modifierId: string): ModifiedEnemy {
  const mod = ENEMY_MODIFIER_MAP.get(modifierId);
  if (!mod) {
    return {
      ...baseEnemy,
      modifierId: 'none',
      modifierName: '',
      modifierEffects: {},
    };
  }

  const e = mod.effects;
  const hpMult = e.hpMult ?? 1;
  const atkMult = e.atkMult ?? 1;
  const defMult = e.defMult ?? 1;

  return {
    ...baseEnemy,
    name: `${baseEnemy.name} ${mod.name}`,
    baseHp: Math.max(1, Math.floor(baseEnemy.baseHp * hpMult)),
    baseAtk: Math.max(1, Math.floor(baseEnemy.baseAtk * atkMult)),
    baseDef: Math.max(0, Math.floor(baseEnemy.baseDef * defMult) + (e.defAdd ?? 0)),
    abilities: [...(baseEnemy.abilities ?? []), mod.id],
    modifierId: mod.id,
    modifierName: mod.name,
    modifierEffects: { ...e },
  };
}

/**
 * Roll an enemy modifier for a given floor. Returns the modifier id or null
 * (no modifier). Deeper floors → higher chance of having one AND rarer mods.
 */
export function rollEnemyModifier(rng: RNG, floor: number): string | null {
  // Chance the enemy gets a modifier at all. Floors 1-3 are mostly clean.
  const chance = Math.min(0.75, Math.max(0, (floor - 3) * 0.04));
  if (!rng.chance(chance)) return null;

  const depthFactor = Math.min(1, floor / 50);
  const weights: Record<ModifierRarity, number> = {
    common: 45 - depthFactor * 25,
    uncommon: 35 - depthFactor * 10,
    rare: 15 + depthFactor * 20,
    epic: 4 + depthFactor * 12,
    legendary: 1 + depthFactor * 5,
  };

  const mod = rollByRarity(rng, ENEMY_MODIFIERS, weights);
  return mod ? mod.id : null;
}

// ---------------------------------------------------------------------------
// Shared rarity-weighted roll
// ---------------------------------------------------------------------------

function rollByRarity<T extends { rarity: ModifierRarity }>(
  rng: RNG,
  pool: readonly T[],
  weights: Record<ModifierRarity, number>,
): T | null {
  // Sum weights per rarity, then pick a rarity, then a random member of it.
  const rarityPool = new Map<ModifierRarity, T[]>();
  for (const item of pool) {
    const arr = rarityPool.get(item.rarity) ?? [];
    arr.push(item);
    rarityPool.set(item.rarity, arr);
  }

  let total = 0;
  const entries: { rarity: ModifierRarity; weight: number }[] = [];
  for (const r of RARITY_ORDER) {
    if (!rarityPool.has(r)) continue;
    const w = Math.max(0, weights[r] ?? 0);
    if (w > 0) {
      total += w;
      entries.push({ rarity: r, weight: w });
    }
  }
  if (total === 0 || entries.length === 0) return null;

  let roll = rng.float() * total;
  let chosenRarity: ModifierRarity = entries[0]!.rarity;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) {
      chosenRarity = entry.rarity;
      break;
    }
  }

  const candidates = rarityPool.get(chosenRarity);
  return candidates && candidates.length > 0 ? rng.pick(candidates) : null;
}
