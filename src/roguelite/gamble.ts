/**
 * Gamble Resolver — pure logic for the 4 gamble variants.
 * No Discord dependencies. Returns results for the UI layer to render.
 */

import { RNG } from './rng.js';

export type GambleVariant = 'double_or_nothing' | 'dice_duel' | 'wheel_of_pain' | 'mystery_chest';

export interface GambleResult {
  variant: GambleVariant;
  won: boolean;
  /** HP change (negative = damage taken) */
  hpChange: number;
  /** Coins change */
  coinsChange: number;
  /** Perk granted (if any) */
  perkGranted: boolean;
  /** Narrative description for the player */
  description: string;
  /** Details for rendering (dice values, wheel segment, etc.) */
  details: Record<string, number | string>;
}

/**
 * Double or Nothing — coin flip. Win = pact x1.5, Lose = -25% HP.
 */
export function doubleOrNothing(rng: RNG, luckBonus: number = 0): GambleResult {
  const winChance = 0.5 + luckBonus;
  const won = rng.chance(winChance);
  const playerCall = rng.chance(0.5) ? 'Pile' : 'Face';
  const result = rng.chance(0.5) ? 'Pile' : 'Face';

  return {
    variant: 'double_or_nothing',
    won,
    hpChange: won ? 0 : -25,
    coinsChange: 0, // pact multiplier handled by caller
    perkGranted: false,
    description: won
      ? `🎲 ${playerCall} ! Tu gagnes — le pacte est multiplié par 1.5 !`
      : `🎲 ${result === playerCall ? 'Pile' : 'Face'}... Tu perds 25 HP !`,
    details: { playerCall, result, winChance: Math.round(winChance * 100) },
  };
}

/**
 * Dice Duel — player rolls 2d6 vs dealer 2d6. Highest wins.
 * Player can wager HP for a bigger reward.
 */
export function diceDuel(rng: RNG, luckBonus: number = 0): GambleResult {
  const playerRoll = rng.dice(2, 6) + Math.floor(luckBonus * 6);
  const dealerRoll = rng.dice(2, 6);
  const won = playerRoll > dealerRoll;

  return {
    variant: 'dice_duel',
    won,
    hpChange: won ? 10 : -20, // heal 10 on win, damage on loss
    coinsChange: won ? rng.int(100, 300) : 0,
    perkGranted: false,
    description: won
      ? `🎲 Tu fais ${playerRoll} contre ${dealerRoll} pour le croupier. Victoire ! +${Math.abs(won ? 10 : 0)} HP, +${won ? rng.int(100, 300) : 0} ¢`
      : `🎲 Tu fais ${playerRoll} contre ${dealerRoll} pour le croupier. Défaite... -20 HP`,
    details: { playerRoll, dealerRoll },
  };
}

/**
 * Wheel of Pain — 8 segments. 6 good, 2 bad (heavy damage).
 */
export function wheelOfPain(rng: RNG, luckBonus: number = 0): GambleResult {
  const goodSegments = 6 + Math.floor(luckBonus * 2);
  const totalSegments = 8;
  const segment = rng.int(1, totalSegments);
  const won = segment <= goodSegments;

  return {
    variant: 'wheel_of_pain',
    won,
    hpChange: won ? rng.int(5, 15) : -rng.int(20, 40),
    coinsChange: won ? rng.int(50, 200) : 0,
    perkGranted: false,
    description: won
      ? `🎡 La roue s'arrête sur le segment ${segment}. Bon résultat !`
      : `🎡 La roue s'arrête sur le segment ${segment}... DOULEUR !`,
    details: { segment, totalSegments, goodSegments },
  };
}

/**
 * Mystery Chest — 3 chests. 1 = perk, 1 = damage, 1 = empty.
 * Player picks blindly.
 */
export function mysteryChest(rng: RNG, _luckBonus: number = 0): GambleResult {
  const chests = ['perk', 'damage', 'empty'] as const;
  const picked = rng.pick([...chests]);

  switch (picked) {
    case 'perk':
      return {
        variant: 'mystery_chest',
        won: true,
        hpChange: 0,
        coinsChange: 0,
        perkGranted: true,
        description: '🎁 Coffre ouvert : un perk rare !',
        details: { picked: 'perk' },
      };
    case 'damage':
      return {
        variant: 'mystery_chest',
        won: false,
        hpChange: -rng.int(15, 30),
        coinsChange: 0,
        perkGranted: false,
        description: '🎁 Coffre ouvert : un piège ! Dégâts subis.',
        details: { picked: 'damage', damage: -rng.int(15, 30) },
      };
    case 'empty':
      return {
        variant: 'mystery_chest',
        won: false,
        hpChange: 0,
        coinsChange: 0,
        perkGranted: false,
        description: '🎁 Coffre ouvert : vide. Tu repars bredouille.',
        details: { picked: 'empty' },
      };
  }
}

/**
 * Master resolver — dispatches to the right variant.
 */
export function resolveGamble(
  variant: GambleVariant,
  rng: RNG,
  luckBonus: number = 0
): GambleResult {
  switch (variant) {
    case 'double_or_nothing':
      return doubleOrNothing(rng, luckBonus);
    case 'dice_duel':
      return diceDuel(rng, luckBonus);
    case 'wheel_of_pain':
      return wheelOfPain(rng, luckBonus);
    case 'mystery_chest':
      return mysteryChest(rng, luckBonus);
    default:
      return doubleOrNothing(rng, luckBonus);
  }
}

/**
 * Get a human-readable name for each variant.
 */
export function getGambleName(variant: GambleVariant): string {
  switch (variant) {
    case 'double_or_nothing':
      return 'Double ou Rien';
    case 'dice_duel':
      return 'Duel de Dés';
    case 'wheel_of_pain':
      return 'Roue de la Douleur';
    case 'mystery_chest':
      return 'Coffre Mystère';
    default:
      return 'Gamble';
  }
}
