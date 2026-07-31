/**
 * Synergy system for NEXUS roguelite.
 * When certain perk combinations are present, a named synergy is triggered
 * with a bonus effect.
 */

export interface SynergyDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  requiredPerks: string[]; // all must be present
  bonus: string; // human-readable description of the bonus
}

export const SYNERGIES: SynergyDef[] = [
  {
    id: 'tempete_de_feu',
    name: 'Tempête de Feu',
    emoji: '🌋',
    description: 'Pyromancie + Frappe Rapide',
    requiredPerks: ['pyromancie', 'frappe_rapide'],
    bonus: 'Chaque frappe inflige des dégâts de feu doubled',
  },
  {
    id: 'le_mur',
    name: 'Le Mur Infranchissable',
    emoji: '🧱',
    description: 'Peau de Pierre + Armure Épineuse + Régénération',
    requiredPerks: ['peau_de_pierre', 'armure_epineuse', 'regeneration'],
    bonus: 'Immunisé aux debuffs, regen +10 HP/tour supplémentaire',
  },
  {
    id: 'le_parieur',
    name: 'Le Parieur',
    emoji: '🎰',
    description: 'Chance Amplifiée + Maître des Dés + Dés Pipés',
    requiredPerks: ['chance_amplifiee', 'maitre_des_des', 'des_pipes'],
    bonus: 'Toutes les probas favorables +20% supplémentaire',
  },
  {
    id: 'limmortel',
    name: 'L\'Immortel',
    emoji: '♾️',
    description: 'Phénix + Dernier Souffle + Régénération',
    requiredPerks: ['phoenix', 'dernier_souffle', 'regeneration'],
    bonus: 'Ne peut pas mourir (3 revives + regen massive)',
  },
  {
    id: 'le_tueur',
    name: 'Le Tueur à Gages',
    emoji: '🎯',
    description: 'Exécution + Chasseur de Sang + Frappe Mortelle',
    requiredPerks: ['execution', 'chasseur_de_sang', 'frappe_mortelle'],
    bonus: 'Instant kill chance portée à 20% sur ennemis blessés',
  },
  {
    id: 'blitzkrieg',
    name: 'Blitzkrieg',
    emoji: '⚡',
    description: 'Frappe Rapide + Onde de Choc + Attaque Circulaire',
    requiredPerks: ['frappe_rapide', 'onde_de_choc', 'attaque_circulaire'],
    bonus: 'Chaque attaque frappe tous les ennemis 2x avec 40% stun',
  },
  {
    id: 'la_maison',
    name: 'La Maison Gagne Toujours',
    emoji: '🏠',
    description: 'Chance Amplifiée + Inversion + Maître des Dés',
    requiredPerks: ['chance_amplifiee', 'inversion', 'maitre_des_des'],
    bonus: '25% chance qu\'un échec devienne réussite critique',
  },
  {
    id: 'dracula',
    name: 'Dracula',
    emoji: '🧛',
    description: 'Sang Vampirique + Peau de Pierre + Fureur',
    requiredPerks: ['sang_vampirique', 'peau_de_pierre', 'fureur'],
    bonus: 'Vole 75% des dégâts en HP, ATK croît de 2/tour',
  },
  {
    id: 'apocalypse_brumlante',
    name: 'L\'Apocalypse Brûlante',
    emoji: '☄️',
    description: 'Pyromancie + Attaque Circulaire + Berserk Total',
    requiredPerks: ['pyromancie', 'attaque_circulaire', 'berserk_total'],
    bonus: 'AoE de feu x3 dégâts quand HP < 25%',
  },
  {
    id: 'le_fort',
    name: 'La Forteresse Vampirique',
    emoji: '🏰',
    description: 'Sang Vampirique + Peau de Pierre + Armure Maudite',
    requiredPerks: ['sang_vampirique', 'peau_de_pierre', 'armure_maudite'],
    bonus: 'Tank invincible qui se heal massivement au contact',
  },
  {
    id: 'jackpot',
    name: 'Le Jackpot',
    emoji: '💎',
    description: 'Calice d\'Or + Chance Dorée + Chance Amplifiée',
    requiredPerks: ['calice_dor', 'chance_doree', 'chance_amplifiee'],
    bonus: 'Coins de run x5 + bonus RNG sur les gambles',
  },
  {
    id: 'le_demon',
    name: 'Le Démon Intarissable',
    emoji: '👿',
    description: 'Pacte Démoniaque + Sang Vampirique + Berserk Total',
    requiredPerks: ['pacte_demoniaque', 'sang_vampirique', 'berserk_total'],
    bonus: 'Glass cannon ultime : x4 dégâts, vol de vie 75%, mais 1 HP = mort',
  },
];

/**
 * Check which synergies are active given the player's current perks.
 */
export function detectSynergies(activePerkIds: string[]): SynergyDef[] {
  return SYNERGIES.filter((syn) =>
    syn.requiredPerks.every((id) => activePerkIds.includes(id))
  );
}

/**
 * Check if picking a new perk would unlock a new synergy.
 * Returns the new synergies that would be triggered.
 */
export function previewSynergies(
  activePerkIds: string[],
  newPerkId: string
): SynergyDef[] {
  const hypothetical = [...activePerkIds, newPerkId];
  const current = new Set(detectSynergies(activePerkIds).map((s) => s.id));
  return detectSynergies(hypothetical).filter(
    (s) => !current.has(s.id)
  );
}
