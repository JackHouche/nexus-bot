/**
 * Items system — consumables usable during a run.
 */

export interface ItemDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  price: number;
  /** Effect when consumed */
  effect: {
    type: 'heal' | 'atk_buff' | 'def_buff' | 'energy_restore' | 'reroll' | 'mystery';
    value: number;
  };
  category: 'consumable' | 'relic';
}

export const ITEMS: Record<string, ItemDef> = {
  potion_hp: {
    id: 'potion_hp',
    name: 'Potion de Soin',
    emoji: '🧪',
    description: 'Restaure +40 HP immédiatement',
    price: 150,
    effect: { type: 'heal', value: 40 },
    category: 'consumable',
  },
  potion_atk: {
    id: 'potion_atk',
    name: 'Potion de Force',
    emoji: '⚗️',
    description: '+5 ATK permanent pour ce run',
    price: 300,
    effect: { type: 'atk_buff', value: 5 },
    category: 'consumable',
  },
  potion_def: {
    id: 'potion_def',
    name: 'Potion de Défense',
    emoji: '🛡️',
    description: '+3 DEF permanent pour ce run',
    price: 250,
    effect: { type: 'def_buff', value: 3 },
    category: 'consumable',
  },
  energy_crystal: {
    id: 'energy_crystal',
    name: 'Cristal d\'Énergie',
    emoji: '🔋',
    description: 'Restaure toute ton énergie',
    price: 350,
    effect: { type: 'energy_restore', value: 999 },
    category: 'consumable',
  },
  reroll_token: {
    id: 'reroll_token',
    name: 'Jeton de Reroll',
    emoji: '♻️',
    description: 'Relance les choix de perks',
    price: 200,
    effect: { type: 'reroll', value: 1 },
    category: 'consumable',
  },
  relic_random: {
    id: 'relic_random',
    name: 'Relique Aléatoire',
    emoji: '💎',
    description: 'Accorde une relique puissante aléatoire',
    price: 400,
    effect: { type: 'mystery', value: 1 },
    category: 'relic',
  },
  key_mystery: {
    id: 'key_mystery',
    name: 'Clef Mystère',
    emoji: '🗝️',
    description: 'Débloque un étage bonus caché',
    price: 500,
    effect: { type: 'mystery', value: 2 },
    category: 'relic',
  },
};

export function getItem(id: string): ItemDef | undefined {
  return ITEMS[id];
}

export function getAllItems(): ItemDef[] {
  return Object.values(ITEMS);
}

/**
 * Pick N random items for a shop floor.
 */
export function getRandomShopItems(amount: number = 4): ItemDef[] {
  const all = Object.values(ITEMS);
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(amount, all.length));
}
