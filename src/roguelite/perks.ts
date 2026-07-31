/**
 * Perk system for NEXUS roguelite.
 * Each perk modifies the player's stats or behavior during a run.
 */

export type PerkCategory =
  | 'offensive'
  | 'defensive'
  | 'utility'
  | 'gamble'
  | 'curse'
  | 'relic';

export interface PerkEffect {
  // Stat modifiers (additive or multiplicative)
  atkFlat?: number;
  atkPct?: number;
  defFlat?: number;
  defPct?: number;
  hpFlat?: number;
  hpPct?: number;
  critChance?: number; // additive to base
  critMult?: number;
  lifestealPct?: number;
  // Behavior flags
  doubleAttack?: boolean;
  aoeAttack?: boolean;
  stunChance?: number;
  dodgeChance?: number;
  blockChance?: number;
  regenPerTurn?: number;
  // Economy
  coinsPct?: number;
  pactMultiplier?: number;
  // RNG
  luckBonus?: number; // additive to favorable probabilities
  rerollFree?: boolean;
  // Curse mechanics
  cantFlee?: boolean;
  berserkLowHp?: boolean; // x3 dmg if hp < 25%
  fragile?: boolean; // dies if hp < 20% and hit
}

export interface Perk {
  id: string;
  name: string;
  emoji: string;
  category: PerkCategory;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  effects: PerkEffect;
}

export const PERKS: Record<string, Perk> = {
  // === OFFENSIVE ===
  pyromancie: {
    id: 'pyromancie', name: 'Pyromancie', emoji: '🔥', category: 'offensive',
    description: 'Dégâts de feu +50%', rarity: 'uncommon',
    effects: { atkPct: 0.5 },
  },
  frappe_rapide: {
    id: 'frappe_rapide', name: 'Frappe Rapide', emoji: '⚡', category: 'offensive',
    description: 'Attaque 2x par tour', rarity: 'rare',
    effects: { doubleAttack: true },
  },
  attaque_circulaire: {
    id: 'attaque_circulaire', name: 'Attaque Circulaire', emoji: '🌀', category: 'offensive',
    description: 'Touche tous les ennemis', rarity: 'rare',
    effects: { aoeAttack: true },
  },
  execution: {
    id: 'execution', name: 'Exécution', emoji: '☠️', category: 'offensive',
    description: '+50% dégâts si ennemi <30% HP', rarity: 'uncommon',
    effects: {},
  },
  chasseur_de_sang: {
    id: 'chasseur_de_sang', name: 'Chasseur de Sang', emoji: '🩸', category: 'offensive',
    description: 'Marque les ennemis <30% HP', rarity: 'common',
    effects: {},
  },
  onde_de_choc: {
    id: 'onde_de_choc', name: 'Onde de Choc', emoji: '💥', category: 'offensive',
    description: '20% chance de stun l\'ennemi', rarity: 'uncommon',
    effects: { stunChance: 0.2 },
  },
  frappe_mortelle: {
    id: 'frappe_mortelle', name: 'Frappe Mortelle', emoji: '💀', category: 'offensive',
    description: '5% chance d\'instant kill', rarity: 'legendary',
    effects: {},
  },
  fureur: {
    id: 'fureur', name: 'Fureur', emoji: '😡', category: 'offensive',
    description: '+1 ATK par tour de combat', rarity: 'uncommon',
    effects: {},
  },

  // === DEFENSIVE ===
  peau_de_pierre: {
    id: 'peau_de_pierre', name: 'Peau de Pierre', emoji: '🪨', category: 'defensive',
    description: '+50% DEF', rarity: 'uncommon',
    effects: { defPct: 0.5 },
  },
  regeneration: {
    id: 'regeneration', name: 'Régénération', emoji: '💚', category: 'defensive',
    description: 'Soigne 5 HP/tour', rarity: 'rare',
    effects: { regenPerTurn: 5 },
  },
  bouclier_sacre: {
    id: 'bouclier_sacre', name: 'Bouclier Sacré', emoji: '🛡️', category: 'defensive',
    description: 'Immunise au premier coup de chaque combat', rarity: 'rare',
    effects: { blockChance: 1.0 },
  },
  dernier_souffle: {
    id: 'dernier_souffle', name: 'Dernier Souffle', emoji: '🕯️', category: 'defensive',
    description: 'Survit à 1 HP une fois par run', rarity: 'epic',
    effects: {},
  },
  cuivre_renforce: {
    id: 'cuivre_renforce', name: 'Cuivre Renforcé', emoji: '🟤', category: 'defensive',
    description: '+30 HP max', rarity: 'common',
    effects: { hpFlat: 30 },
  },
  armure_epineuse: {
    id: 'armure_epineuse', name: 'Armure Épineuse', emoji: '🌵', category: 'defensive',
    description: 'Reflète 25% des dégâts reçus', rarity: 'rare',
    effects: {},
  },
  phoenix: {
    id: 'phoenix', name: 'Phénix', emoji: '🦅', category: 'defensive',
    description: 'Ressuscite une fois à 50% HP', rarity: 'legendary',
    effects: {},
  },

  // === UTILITY ===
  voleur_agile: {
    id: 'voleur_agile', name: 'Voleur Agile', emoji: '🏃', category: 'utility',
    description: '+30% chance de fuite réussie', rarity: 'common',
    effects: {},
  },
  vision_tactique: {
    id: 'vision_tactique', name: 'Vision Tactique', emoji: '🔮', category: 'utility',
    description: 'Voit le type d\'étage suivant', rarity: 'uncommon',
    effects: {},
  },
  marchandage: {
    id: 'marchandage', name: 'Marchandage', emoji: '🤝', category: 'utility',
    description: '-25% prix en shop', rarity: 'common',
    effects: {},
  },
  explorer: {
    id: 'explorer', name: 'Explorer', emoji: '🧭', category: 'utility',
    description: '+1 choix de perk (4 au lieu de 3)', rarity: 'rare',
    effects: {},
  },
  chance_doree: {
    id: 'chance_doree', name: 'Chance Dorée', emoji: '💰', category: 'utility',
    description: '+25% coins en run', rarity: 'uncommon',
    effects: { coinsPct: 0.25 },
  },
  assurance_vie: {
    id: 'assurance_vie', name: 'Assurance Vie', emoji: '📋', category: 'utility',
    description: 'Récupère 25% des coins dépensés si mort', rarity: 'uncommon',
    effects: {},
  },

  // === GAMBLE ===
  chance_amplifiee: {
    id: 'chance_amplifiee', name: 'Chance Amplifiée', emoji: '🍀', category: 'gamble',
    description: '+10% à toutes les probas favorables', rarity: 'rare',
    effects: { luckBonus: 0.1 },
  },
  maitre_des_des: {
    id: 'maitre_des_des', name: 'Maître des Dés', emoji: '🎲', category: 'gamble',
    description: 'Reroll gratuit une fois par étage gamble', rarity: 'rare',
    effects: { rerollFree: true },
  },
  inversion: {
    id: 'inversion', name: 'Inversion', emoji: '🔄', category: 'gamble',
    description: '15% chance qu\'un échec devienne réussite', rarity: 'epic',
    effects: { luckBonus: 0.15 },
  },
  des_pipes: {
    id: 'des_pipes', name: 'Dés Pipés', emoji: '🎰', category: 'gamble',
    description: '+1 au résultat de chaque dé lancé', rarity: 'rare',
    effects: {},
  },

  // === CURSE (powerful but with downside) ===
  pacte_demoniaque: {
    id: 'pacte_demoniaque', name: 'Pacte Démoniaque', emoji: '😈', category: 'curse',
    description: '+100% ATK mais -30% HP max', rarity: 'epic',
    effects: { atkPct: 1.0, hpPct: -0.3 },
  },
  sang_vampirique: {
    id: 'sang_vampirique', name: 'Sang Vampirique', emoji: '🦇', category: 'curse',
    description: 'Vole 50% des dégâts en HP, mais -50% heal', rarity: 'epic',
    effects: { lifestealPct: 0.5 },
  },
  armure_maudite: {
    id: 'armure_maudite', name: 'Armure Maudite', emoji: '⛓️', category: 'curse',
    description: '+100% DEF mais ne peut pas fuir', rarity: 'rare',
    effects: { defPct: 1.0, cantFlee: true },
  },
  berserk_total: {
    id: 'berserk_total', name: 'Berserk Total', emoji: '🤬', category: 'curse',
    description: 'x3 dégâts si HP < 25%, mais DEF = 0', rarity: 'epic',
    effects: { berserkLowHp: true },
  },
  cristal_fragile: {
    id: 'cristal_fragile', name: 'Cristal Fragile', emoji: '💎', category: 'curse',
    description: 'x2 coins de run, mais meurt en 1 coup si HP < 20%', rarity: 'rare',
    effects: { coinsPct: 1.0, fragile: true },
  },

  // === RELIC (extraordinary, rare) ===
  sablier_temporel: {
    id: 'sablier_temporel', name: 'Sablier Temporel', emoji: '⏳', category: 'relic',
    description: 'Rewind 1 étage (une fois par run)', rarity: 'legendary',
    effects: {},
  },
  coeur_de_dragon: {
    id: 'coeur_de_dragon', name: 'Cœur de Dragon', emoji: '🐉', category: 'relic',
    description: '+200% HP max, -50% heal', rarity: 'legendary',
    effects: { hpPct: 2.0 },
  },
  lame_celeste: {
    id: 'lame_celeste', name: 'Lame Céleste', emoji: '⚔️', category: 'relic',
    description: 'Ignore TOUTE défense ennemie', rarity: 'legendary',
    effects: {},
  },
  calice_dor: {
    id: 'calice_dor', name: 'Calice d\'Or', emoji: '🏆', category: 'relic',
    description: 'Triple coins de run', rarity: 'legendary',
    effects: { coinsPct: 2.0 },
  },
};

/**
 * Get a list of perk IDs by category.
 */
export function getPerksByCategory(category: PerkCategory): Perk[] {
  return Object.values(PERKS).filter((p) => p.category === category);
}

/**
 * Get all perk IDs.
 */
export function getAllPerkIds(): string[] {
  return Object.keys(PERKS);
}

/**
 * Get a perk by ID.
 */
export function getPerk(id: string): Perk | undefined {
  return PERKS[id];
}

/**
 * Apply perk effects to compute the player's effective stats.
 */
export interface PlayerStats {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  critChance: number;
  critMult: number;
  lifestealPct: number;
  doubleAttack: boolean;
  aoeAttack: boolean;
  stunChance: number;
  blockChance: number;
  regenPerTurn: number;
  luckBonus: number;
  coinsPct: number;
  cantFlee: boolean;
  berserkLowHp: boolean;
  fragile: boolean;
}

export function computeStats(
  baseHp: number,
  baseAtk: number,
  baseDef: number,
  perks: Perk[]
): PlayerStats {
  let maxHp = baseHp;
  let atk = baseAtk;
  let def = baseDef;
  let critChance = 0;
  let critMult = 2.0;
  let lifestealPct = 0;
  let doubleAttack = false;
  let aoeAttack = false;
  let stunChance = 0;
  let blockChance = 0;
  let regenPerTurn = 0;
  let luckBonus = 0;
  let coinsPct = 0;
  let cantFlee = false;
  let berserkLowHp = false;
  let fragile = false;

  for (const perk of perks) {
    const e = perk.effects;
    if (e.atkFlat) atk += e.atkFlat;
    if (e.atkPct) atk *= 1 + e.atkPct;
    if (e.defFlat) def += e.defFlat;
    if (e.defPct) def *= 1 + e.defPct;
    if (e.hpFlat) maxHp += e.hpFlat;
    if (e.hpPct) maxHp *= 1 + e.hpPct;
    if (e.critChance) critChance += e.critChance;
    if (e.critMult) critMult = e.critMult;
    if (e.lifestealPct) lifestealPct += e.lifestealPct;
    if (e.doubleAttack) doubleAttack = true;
    if (e.aoeAttack) aoeAttack = true;
    if (e.stunChance) stunChance += e.stunChance;
    if (e.blockChance) blockChance += e.blockChance;
    if (e.regenPerTurn) regenPerTurn += e.regenPerTurn;
    if (e.luckBonus) luckBonus += e.luckBonus;
    if (e.coinsPct) coinsPct += e.coinsPct;
    if (e.cantFlee) cantFlee = true;
    if (e.berserkLowHp) berserkLowHp = true;
    if (e.fragile) fragile = true;
  }

  return {
    hp: maxHp,
    maxHp: Math.floor(maxHp),
    atk: Math.floor(atk),
    def: Math.floor(def),
    critChance,
    critMult,
    lifestealPct,
    doubleAttack,
    aoeAttack,
    stunChance,
    blockChance,
    regenPerTurn,
    luckBonus,
    coinsPct,
    cantFlee,
    berserkLowHp,
    fragile,
  };
}
