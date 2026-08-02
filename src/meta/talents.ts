/**
 * Talent Tree System — persistent stat boosts bought with talent points.
 *
 * Four branches × 15 nodes each:
 *   - combat     → offensive/defensive stats & special tuning
 *   - economy    → coins, shop, pacts, duels
 *   - exploration → perks, floors, energy, rerolls
 *   - gamble     → luck, gamble rerolls, insurance, D-or-N
 *
 * Each branch has a Capstone (requires all 15 nodes).
 * The single Omega talent requires all 4 Capstones.
 *
 * Points are awarded from player level (see getTotalPoints).
 * Talents can only be reset via Prestige.
 */

import { prisma } from '../database.js';

// ============================================================
//  TYPES
// ============================================================

export type TalentBranch = 'combat' | 'economy' | 'exploration' | 'gamble';

export interface TalentEffect {
  // Flat / percent stat deltas applied when the node is ranked up.
  atkFlat?: number;
  atkPct?: number;
  hpFlat?: number;
  hpPct?: number;
  defFlat?: number;
  defPct?: number;
  critChance?: number;
  critDamagePct?: number;
  specialDamagePct?: number;
  specialCostFlat?: number; // negative = cheaper
  energyFlat?: number;
  luckPct?: number;
  coinsPct?: number;
  shopDiscountPct?: number;
  pactBonusPct?: number;
  duelTaxPct?: number; // negative = less tax
  perkChoicesFlat?: number;
  rerollFree?: boolean;
  gambleReroll?: boolean;
  gambleInsurancePct?: number;
  doubleOrNothingUpgraded?: boolean;
  seeNextFloor?: boolean;
  skipFloor?: boolean;
  dailyStreakProtection?: boolean;
  flags?: string[];
}

export interface TalentNode {
  id: string;
  branch: TalentBranch;
  name: string;
  emoji: string;
  description: string;
  /** Per-rank effect (applied once per rank invested). */
  effect: TalentEffect;
  /** Maximum ranks investable. */
  maxRank: number;
}

export interface AggregatedBonuses {
  atkFlat: number;
  atkPct: number;
  hpFlat: number;
  hpPct: number;
  defFlat: number;
  defPct: number;
  critChance: number;
  critDamagePct: number;
  specialDamagePct: number;
  specialCostFlat: number;
  energyFlat: number;
  luckPct: number;
  coinsPct: number;
  shopDiscountPct: number;
  pactBonusPct: number;
  duelTaxPct: number;
  perkChoicesFlat: number;
  gambleInsurancePct: number;
  flags: string[];
}

// ============================================================
//  TALENT TREE — 4 branches × 15 nodes
// ============================================================

/**
 * Helper to keep node definitions compact.
 * Branch is inferred from being inside a branch block.
 */
function node(
  branch: TalentBranch,
  id: string,
  name: string,
  emoji: string,
  description: string,
  effect: TalentEffect,
  maxRank = 5,
): TalentNode {
  return { id: `${branch}_${id}`, branch, name, emoji, description, effect, maxRank };
}

export const TALENT_TREE: Record<TalentBranch, TalentNode[]> = {
  // ----------------------------------------------------------
  //  COMBAT
  // ----------------------------------------------------------
  combat: [
    node('combat', 'atk_1', 'Force', '💪', '+2 ATK par rang', { atkFlat: 2 }),
    node('combat', 'atk_2', 'Puissance', '⚔️', '+3% ATK par rang', { atkPct: 0.03 }),
    node('combat', 'hp_1', 'Vitalité', '❤️', '+15 HP par rang', { hpFlat: 15 }),
    node('combat', 'hp_2', 'Robustesse', '🫀', '+4% HP par rang', { hpPct: 0.04 }),
    node('combat', 'def_1', 'Armure', '🛡️', '+2 DEF par rang', { defFlat: 2 }),
    node('combat', 'def_2', 'Muraille', '🏰', '+5% DEF par rang', { defPct: 0.05 }),
    node('combat', 'crit_1', 'Précision', '🎯', '+2% crit par rang', { critChance: 0.02 }),
    node('combat', 'crit_2', 'Létalité', '💥', '+15% dégâts crit par rang', { critDamagePct: 0.15 }),
    node('combat', 'special_dmg', 'Spécial Puissant', '✨', '+10% dégâts spécial par rang', { specialDamagePct: 0.10 }),
    node('combat', 'special_cost', 'Économie d\'Énergie', '🔋', '-1 coût spécial par rang', { specialCostFlat: -1 }, 2),
    node('combat', 'lifesteal', 'Vampirisme', '🧛', 'Vol de vie 3% par rang', { flags: ['lifesteal'] }, 3),
    node('combat', 'regen', 'Régénération', '🌱', '+2 HP/tour par rang', { flags: ['regen'] }, 3),
    node('combat', 'dodge', 'Esquive', '🌪️', '+3% esquive par rang', { flags: ['dodge'] }, 3),
    node('combat', 'execute', 'Exécution', '☠️', '+50% dmg si ennemi <30% HP', { flags: ['execute'] }, 1),
    node('combat', 'berserk', 'Berserk', '😡', 'x2 dmg si HP <25%', { flags: ['berserk'] }, 1),
  ],

  // ----------------------------------------------------------
  //  ECONOMY
  // ----------------------------------------------------------
  economy: [
    node('economy', 'coins_1', 'Fortune', '💰', '+3% pièces par rang', { coinsPct: 0.03 }),
    node('economy', 'coins_2', 'Magnat', '🏦', '+5% pièces par rang', { coinsPct: 0.05 }),
    node('economy', 'shop_1', 'Marchandage', '🤝', '-3% prix boutique par rang', { shopDiscountPct: 0.03 }),
    node('economy', 'shop_2', 'Négociateur', '📿', '-5% prix boutique par rang', { shopDiscountPct: 0.05 }),
    node('economy', 'pact_1', 'Pacte Rentable', '📜', '+5% pacte par rang', { pactBonusPct: 0.05 }),
    node('economy', 'pact_2', 'Maître des Pactes', '🩸', '+8% pacte par rang', { pactBonusPct: 0.08 }),
    node('economy', 'duel_1', 'Duelliste', '⚔️', '-2% taxe duel par rang', { duelTaxPct: -0.02 }),
    node('economy', 'duel_2', 'Champion de l\'Arène', '🏆', '-3% taxe duel par rang', { duelTaxPct: -0.03 }),
    node('economy', 'streak_1', 'Routine', '📅', 'Protection série quotidienne', { dailyStreakProtection: true }, 1),
    node('economy', 'streak_2', 'Assiduité', '🗓️', '+50% bonus série 7j', { flags: ['daily_streak_boost'] }, 1),
    node('economy', 'interest', 'Intérêts', '📈', '+1% intérêt pièces/jour par rang', { flags: ['interest'] }, 3),
    node('economy', 'loot_1', 'Butin', '💎', '+5% drop pièces par rang', { coinsPct: 0.05 }),
    node('economy', 'loot_2', 'Trésor', '🪙', '+8% drop pièces par rang', { coinsPct: 0.08 }),
    node('economy', 'soul_1', 'Récolteur d\'Âmes', '👻', '+5% âmes gagnées par rang', { flags: ['soul_bonus'] }),
    node('economy', 'soul_2', 'Nécromancien', '💀', '+10% âmes gagnées par rang', { flags: ['soul_bonus'] }),
  ],

  // ----------------------------------------------------------
  //  EXPLORATION
  // ----------------------------------------------------------
  exploration: [
    node('exploration', 'perk_1', 'Choix Élargi', '🎴', '+1 choix de perk par rang', { perkChoicesFlat: 1 }, 2),
    node('exploration', 'perk_2', 'Sélection', '🃏', '+1 reroll perk gratuit', { rerollFree: true }, 2),
    node('exploration', 'see_floor', 'Clairvoyance', '🔮', 'Voir le prochain étage', { seeNextFloor: true }, 1),
    node('exploration', 'energy_1', 'Endurance', '⚡', '+1 énergie max par rang', { energyFlat: 1 }, 3),
    node('exploration', 'energy_2', 'Réserve', '🔋', '+2 énergie max par rang', { energyFlat: 2 }, 2),
    node('exploration', 'skip_floor', 'Raccourci', '⏭️', 'Ignorer 1 étage par run', { skipFloor: true }, 1),
    node('exploration', 'reroll', 'Reroll Gratuit', '♻️', '1 reroll gratuit par étage', { rerollFree: true }, 1),
    node('exploration', 'rare_perk', 'Chance de Perk', '🍀', '+5% perk rare par rang', { flags: ['rare_perk_chance'] }, 3),
    node('exploration', 'mystery', 'Mystère', '🗝️', 'Étage bonus caché occasionnel', { flags: ['mystery_floor'] }, 1),
    node('exploration', 'scout', 'Éclaireur', '🔭', 'Voir stats ennemi', { flags: ['scout'] }, 1),
    node('exploration', 'fast_travel', 'Téléportation', '🌀', '+1 skip d\'étage par rang', { flags: ['extra_skip'] }, 2),
    node('exploration', 'loot_vision', 'Vision du Butin', '👁️', 'Voir drops avant combat', { flags: ['loot_vision'] }, 1),
    node('exploration', 'boss_scout', 'Analyste de Boss', '👑', 'Voir faiblesse du boss', { flags: ['boss_scout'] }, 1),
    node('exploration', 'perk_keep', 'Conservation', '🔒', 'Garde 1 perk entre 2 étages', { flags: ['perk_keep'] }, 1),
    node('exploration', 'extra_floor', 'Étage Bonus', '🎁', 'Étage bonus tous les 5 étages', { flags: ['bonus_floor_5'] }, 1),
  ],

  // ----------------------------------------------------------
  //  GAMBLE
  // ----------------------------------------------------------
  gamble: [
    node('gamble', 'luck_1', 'Chance', '🍀', '+3% chance globale par rang', { luckPct: 0.03 }),
    node('gamble', 'luck_2', 'Destinée', '🌟', '+5% chance globale par rang', { luckPct: 0.05 }),
    node('gamble', 'reroll', 'Reroll de Jeu', '🎲', '1 reroll de pari par rang', { gambleReroll: true }, 2),
    node('gamble', 'insurance', 'Assurance', '🛡️', 'Récupère 20% en cas de perte par rang', { gambleInsurancePct: 0.20 }, 3),
    node('gamble', 'don', 'Double-or-Nothing+', '🎰', 'Double-or-Nothing amélioré', { doubleOrNothingUpgraded: true }, 1),
    node('gamble', 'peek', 'Œil de Lynx', '👁️', 'Voir résultat avant validation', { flags: ['gamble_peek'] }, 1),
    node('gamble', 'streak', 'Série Chanceuse', '🔥', '+10% par victoire consécutive par rang', { flags: ['gamble_streak'] }, 3),
    node('gamble', 'high_stakes', 'Hautes Mises', '💸', 'Débloque paris élevés', { flags: ['high_stakes'] }, 1),
    node('gamble', 'refund', 'Remboursement', '🪙', '5% des pertes remboursées par rang', { flags: ['gamble_refund'] }, 3),
    node('gamble', 'crit_gamble', 'Crit de Pari', '⚡', '10% de chance de x2 gain par rang', { flags: ['gamble_crit'] }, 3),
    node('gamble', 'safe_bet', 'Pari Sécurisé', '🛟', 'Pari minimum gratuit/jour', { flags: ['safe_bet'] }, 1),
    node('gamble', 'compound', 'Intérêts Composés', '📊', '+5% gains cumulés par rang', { flags: ['gamble_compound'] }, 3),
    node('gamble', 'insurance_plus', 'Assurance+', '🛡️', '+10% récupération perte par rang', { gambleInsurancePct: 0.10 }, 2),
    node('gamble', 'jackpot', 'Jackpot', '🎰', 'Débloque jackpot progressif', { flags: ['jackpot'] }, 1),
    node('gamble', 'all_in', 'All-In', '👑', 'Débloque pari tout-en', { flags: ['all_in'] }, 1),
  ],
};

// ============================================================
//  CAPSTONES — require all 15 nodes in their branch
// ============================================================

export interface CapstoneTalent extends TalentNode {
  requiresBranch: TalentBranch;
}

export const CAPSTONE_TALENTS: CapstoneTalent[] = [
  {
    ...node(
      'combat',
      'capstone',
      'Maître de Guerre',
      '⚔️',
      'Capstone Combat: +25% tous dégâts, spécial toujours crit',
      { atkPct: 0.25, flags: ['special_always_crit'] },
      1,
    ),
    requiresBranch: 'combat',
  },
  {
    ...node(
      'economy',
      'capstone',
      'Magnat Suprême',
      '💎',
      'Capstone Économie: +50% pièces, boutique gratuite 1x/run',
      { coinsPct: 0.5, flags: ['free_shop_once'] },
      1,
    ),
    requiresBranch: 'economy',
  },
  {
    ...node(
      'exploration',
      'capstone',
      'Explorateur Légendaire',
      '🗺️',
      'Capstone Exploration: +3 choix perks, voit tout',
      { perkChoicesFlat: 3, seeNextFloor: true, flags: ['full_vision'] },
      1,
    ),
    requiresBranch: 'exploration',
  },
  {
    ...node(
      'gamble',
      'capstone',
      'Maître du Destin',
      '🎲',
      'Capstone Jeu: +30% chance, reroll illimité',
      { luckPct: 0.3, gambleReroll: true, flags: ['unlimited_reroll'] },
      1,
    ),
    requiresBranch: 'gamble',
  },
];

// ============================================================
//  OMEGA — requires all 4 Capstones
// ============================================================

export const OMEGA_TALENT: TalentNode = {
  id: 'omega_transcendance_totale',
  branch: 'combat', // stored under combat for lookup convenience
  name: 'Transcendance Totale',
  emoji: '🌌',
  description:
    'Talents Omega: toutes les stats +50%, tous les flags activés, maître absolu',
  effect: {
    atkPct: 0.5,
    hpPct: 0.5,
    defPct: 0.5,
    critChance: 0.5,
    coinsPct: 0.5,
    luckPct: 0.5,
    flags: ['omega_transcendance'],
  },
  maxRank: 1,
};

// ============================================================
//  INDEXES (for fast lookup)
// ============================================================

const ALL_NODES: TalentNode[] = [
  ...Object.values(TALENT_TREE).flat(),
  ...CAPSTONE_TALENTS,
  OMEGA_TALENT,
];

const NODE_INDEX = new Map<string, TalentNode>(
  ALL_NODES.map((n) => [n.id, n]),
);

export function getTalentNode(nodeId: string): TalentNode | undefined {
  return NODE_INDEX.get(nodeId);
}

export function getAllTalentNodes(): TalentNode[] {
  return ALL_NODES;
}

// ============================================================
//  POINT FORMULA — based on player level
// ============================================================

/**
 * Total talent points a player has earned by a given level.
 * 1 point per level + 1 bonus every 5 levels + 5 at level 50.
 */
export function getTotalPoints(level: number): number {
  if (level < 1) return 0;
  let points = level; // 1/level
  points += Math.floor(level / 5); // bonus every 5
  if (level >= 50) points += 5; // capstone bonus
  return points;
}

// ============================================================
//  DATABASE FUNCTIONS
// ============================================================

export interface UserTalentRow {
  nodeId: string;
  rank: number;
}

/**
 * Get all talents invested by a user, as nodeId → rank map.
 * Multiple rows for the same nodeId are summed (defensive — schema is unique).
 */
export async function getUserTalents(userId: string): Promise<Map<string, number>> {
  const rows = await prisma.userTalent.findMany({ where: { userId } });
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.nodeId, (map.get(r.nodeId) ?? 0) + 1);
  }
  return map;
}

/**
 * Count how many points the user has already spent.
 */
export async function getSpentPoints(userId: string): Promise<number> {
  const talents = await getUserTalents(userId);
  let spent = 0;
  for (const rank of talents.values()) spent += rank;
  return spent;
}

/**
 * Count available (unspent) talent points for a user given their level.
 */
export async function getAvailablePoints(
  userId: string,
  level: number,
): Promise<number> {
  return getTotalPoints(level) - (await getSpentPoints(userId));
}

/**
 * Check whether a node's prerequisites are met by the user's invested talents.
 * - Branch nodes: require the previous 3 nodes in the branch at max rank (simple chain).
 *   For simplicity we only enforce "rank budget + maxRank"; deeper chains can be added later.
 * - Capstones: require all 15 regular nodes of their branch at max rank.
 * - Omega: require all 4 capstones.
 */
export function isPrerequisiteMet(
  nodeId: string,
  invested: Map<string, number>,
): { ok: boolean; reason?: string } {
  const capstone = CAPSTONE_TALENTS.find((c) => c.id === nodeId);
  if (capstone) {
    const branchNodes = TALENT_TREE[capstone.requiresBranch];
    for (const n of branchNodes) {
      if ((invested.get(n.id) ?? 0) < n.maxRank) {
        return {
          ok: false,
          reason: `Capstone requiert tous les nodes ${capstone.requiresBranch} au max.`,
        };
      }
    }
    return { ok: true };
  }

  if (nodeId === OMEGA_TALENT.id) {
    for (const c of CAPSTONE_TALENTS) {
      if ((invested.get(c.id) ?? 0) < 1) {
        return { ok: false, reason: 'Omega requiert tous les 4 Capstones.' };
      }
    }
    return { ok: true };
  }

  // Regular node — accept (chain gating intentionally minimal here).
  return { ok: true };
}

/**
 * Invest one talent point into a node.
 * Enforces: node exists, not at maxRank, points available, prerequisites met.
 */
export async function investTalentPoint(
  userId: string,
  nodeId: string,
): Promise<{ ok: boolean; error?: string }> {
  const def = getTalentNode(nodeId);
  if (!def) return { ok: false, error: 'Talent inconnu.' };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { level: true },
  });
  if (!user) return { ok: false, error: 'Utilisateur introuvable.' };

  const invested = await getUserTalents(userId);
  const currentRank = invested.get(nodeId) ?? 0;
  if (currentRank >= def.maxRank) {
    return { ok: false, error: 'Rang maximum atteint.' };
  }

  const prereq = isPrerequisiteMet(nodeId, invested);
  if (!prereq.ok) {
    return { ok: false, error: prereq.reason };
  }

  const available = await getAvailablePoints(userId, user.level);
  if (available <= 0) {
    return { ok: false, error: 'Pas assez de points de talent.' };
  }

  await prisma.userTalent.create({ data: { userId, nodeId } });
  return { ok: true };
}

/**
 * Reset ALL talents for a user. Only allowed during Prestige.
 * Returns the number of points freed.
 */
export async function resetTalents(userId: string): Promise<number> {
  const freed = await getSpentPoints(userId);
  if (freed > 0) {
    await prisma.userTalent.deleteMany({ where: { userId } });
  }
  return freed;
}

/**
 * Aggregate all invested talents into a single bonus object.
 * Each effect field is summed across nodes × rank.
 * Flags are collected into a unique set.
 */
export async function getTalentBonuses(userId: string): Promise<AggregatedBonuses> {
  const invested = await getUserTalents(userId);

  const bonuses: AggregatedBonuses = {
    atkFlat: 0,
    atkPct: 0,
    hpFlat: 0,
    hpPct: 0,
    defFlat: 0,
    defPct: 0,
    critChance: 0,
    critDamagePct: 0,
    specialDamagePct: 0,
    specialCostFlat: 0,
    energyFlat: 0,
    luckPct: 0,
    coinsPct: 0,
    shopDiscountPct: 0,
    pactBonusPct: 0,
    duelTaxPct: 0,
    perkChoicesFlat: 0,
    gambleInsurancePct: 0,
    flags: [],
  };

  const flagSet = new Set<string>();

  for (const [nodeId, rank] of invested) {
    const def = NODE_INDEX.get(nodeId);
    if (!def) continue;
    const e = def.effect;
    const r = rank; // effect is per-rank

    bonuses.atkFlat += (e.atkFlat ?? 0) * r;
    bonuses.atkPct += (e.atkPct ?? 0) * r;
    bonuses.hpFlat += (e.hpFlat ?? 0) * r;
    bonuses.hpPct += (e.hpPct ?? 0) * r;
    bonuses.defFlat += (e.defFlat ?? 0) * r;
    bonuses.defPct += (e.defPct ?? 0) * r;
    bonuses.critChance += (e.critChance ?? 0) * r;
    bonuses.critDamagePct += (e.critDamagePct ?? 0) * r;
    bonuses.specialDamagePct += (e.specialDamagePct ?? 0) * r;
    bonuses.specialCostFlat += (e.specialCostFlat ?? 0) * r;
    bonuses.energyFlat += (e.energyFlat ?? 0) * r;
    bonuses.luckPct += (e.luckPct ?? 0) * r;
    bonuses.coinsPct += (e.coinsPct ?? 0) * r;
    bonuses.shopDiscountPct += (e.shopDiscountPct ?? 0) * r;
    bonuses.pactBonusPct += (e.pactBonusPct ?? 0) * r;
    bonuses.duelTaxPct += (e.duelTaxPct ?? 0) * r;
    bonuses.perkChoicesFlat += (e.perkChoicesFlat ?? 0) * r;
    bonuses.gambleInsurancePct += (e.gambleInsurancePct ?? 0) * r;

    for (const f of e.flags ?? []) flagSet.add(f);
    if (e.rerollFree) flagSet.add('reroll_free');
    if (e.gambleReroll) flagSet.add('gamble_reroll');
    if (e.doubleOrNothingUpgraded) flagSet.add('don_upgraded');
    if (e.seeNextFloor) flagSet.add('see_next_floor');
    if (e.skipFloor) flagSet.add('skip_floor');
    if (e.dailyStreakProtection) flagSet.add('daily_streak_protected');
  }

  bonuses.flags = [...flagSet];
  return bonuses;
}
