/**
 * Floor types and generation for NEXUS roguelite.
 * Each floor is a challenge the player must overcome.
 */

import { RNG } from './rng.js';
import { getCommonEnemies, getBoss, isBossFloor, scaleEnemy, pickEnemy, type Enemy } from './enemies.js';

export type FloorType = 'combat' | 'gamble' | 'puzzle' | 'dilemma' | 'shop' | 'boss';

export interface FloorEvent {
  type: FloorType;
  enemy?: { enemy: Enemy; hp: number; atk: number; def: number };
  gambleVariant?: string;
  puzzleData?: unknown;
  shopItems?: ShopItem[];
  dilemmaOptions?: { id: string; emoji: string; label: string; description: string }[];
}

export interface ShopItem {
  id: string;
  emoji: string;
  name: string;
  description: string;
  price: number; // in run-coins
}

const SHOP_ITEMS: ShopItem[] = [
  { id: 'potion_hp', emoji: '🧪', name: 'Potion de Soin', description: '+40 HP', price: 150 },
  { id: 'potion_atk', emoji: '⚗️', name: 'Potion de Force', description: '+5 ATK permanent (ce run)', price: 300 },
  { id: 'key_mystery', emoji: '🗝️', name: 'Clef Mystère', description: 'Débloque un étage bonus', price: 500 },
  { id: 'reroll', emoji: '♻️', name: 'Reroll Perks', description: 'Change tes choix de perk', price: 200 },
  { id: 'relic_random', emoji: '💎', name: 'Relique Aléatoire', description: 'Une relique puissante', price: 400 },
  { id: 'potion_def', emoji: '🛡️', name: 'Potion de Défense', description: '+3 DEF permanent (ce run)', price: 250 },
  { id: 'energy_crystal', emoji: '🔋', name: 'Cristal d\'Énergie', description: '+1 énergie max (ce run)', price: 350 },
];

/**
 * Generate a floor event for the given floor number using the seeded RNG.
 */
export function generateFloor(rng: RNG, floor: number): FloorEvent {
  // Boss every 5 floors
  if (isBossFloor(floor)) {
    const boss = getBoss(floor);
    const scaled = scaleEnemy(boss, floor);
    return {
      type: 'boss',
      enemy: { enemy: boss, ...scaled },
    };
  }

  // Weighted random floor type
  const roll = rng.float();
  let type: FloorType;

  if (roll < 0.35) {
    type = 'combat';
  } else if (roll < 0.55) {
    type = 'gamble';
  } else if (roll < 0.70) {
    type = 'puzzle';
  } else if (roll < 0.85) {
    type = 'dilemma';
  } else {
    type = 'shop';
  }

  switch (type) {
    case 'combat': {
      const enemies = getCommonEnemies();
      const enemy = pickEnemy(enemies, floor, rng.pick.bind(rng));
      const scaled = scaleEnemy(enemy, floor);
      return {
        type: 'combat',
        enemy: { enemy, ...scaled },
      };
    }

    case 'gamble': {
      const variants = ['double_or_nothing', 'dice_duel', 'wheel_of_pain', 'mystery_chest'];
      return {
        type: 'gamble',
        gambleVariant: rng.pick(variants),
      };
    }

    case 'puzzle': {
      const variants = ['sequence', 'anagram', 'memory', 'math_rush', 'pattern'];
      return {
        type: 'puzzle',
        puzzleData: { variant: rng.pick(variants) },
      };
    }

    case 'dilemma': {
      return {
        type: 'dilemma',
        dilemmaOptions: rng.pick(DILEMMAS),
      };
    }

    case 'shop': {
      // Pick 4 random items
      const items = rng.pickN(SHOP_ITEMS, 4);
      return {
        type: 'shop',
        shopItems: items,
      };
    }

    default:
      // Fallback to combat
      return generateFloor(rng, floor);
  }
}

// === Dilemma templates ===
const DILEMMAS: { id: string; emoji: string; label: string; description: string }[][] = [
  [
    { id: 'help', emoji: '🤝', label: 'Aider', description: '-10% HP, +1 perk aléatoire' },
    { id: 'ignore', emoji: '🚶', label: 'Ignorer', description: 'Rien ne se passe' },
    { id: 'rob', emoji: '💰', label: 'Voler', description: '+500 coins, +1 Malédiction' },
  ],
  [
    { id: 'fight', emoji: '⚔️', label: 'Combattre', description: 'Combat normal' },
    { id: 'feed', emoji: '🥩', label: 'Nourrir', description: '-200 coins, passe sans combat' },
    { id: 'charm', emoji: '✨', label: 'Charmer', description: 'Nécessite perk spécial, gagne un allié' },
  ],
  [
    { id: 'risk', emoji: '🔴', label: 'Risquer', description: 'Pacte x2, mais -20 HP immédiat' },
    { id: 'safe', emoji: '🟢', label: 'Prudent', description: 'Pacte x1.1, soigne 15 HP' },
    { id: 'skip', emoji: '⏭️', label: 'Passer', description: 'Aucun effet, étage suivant' },
  ],
];

// === Pacte calculation ===
/**
 * Calculate the pact amount for a given floor.
 * Grows exponentially with floor number, with random variance.
 */
export function calculatePact(floor: number, rng: RNG): bigint {
  const base = 100;
  const growth = 1.35;
  const variance = 0.8 + rng.float() * 0.6; // 0.8 to 1.4

  const amount = Math.floor(base * Math.pow(growth, floor) * variance);
  return BigInt(Math.max(0, amount));
}

/**
 * Pact multiplier for special events (boss kill, no-damage, etc.)
 */
export function applyPactMultiplier(
  pact: bigint,
  multiplier: number
): bigint {
  return BigInt(Math.floor(Number(pact) * multiplier));
}
