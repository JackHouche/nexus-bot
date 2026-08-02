/**
 * Special floor events for NEXUS roguelite.
 *
 * Roughly 1-in-7 non-boss floors become a "special floor" — a curated event
 * that breaks the normal combat/gamble/shop rhythm. Each special floor has a
 * type, flavor text, a mechanical effect, and a set of player-facing options.
 *
 * Boss floors never become special floors (see `shouldTriggerSpecialFloor`).
 */

import { RNG } from './rng.js';
import { isBossFloor } from './enemies.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SpecialFloorType =
  | 'mystery'
  | 'cursed'
  | 'treasure'
  | 'flooded'
  | 'choice'
  | 'portal';

export const SPECIAL_FLOOR_TYPES: SpecialFloorType[] = [
  'mystery',
  'cursed',
  'treasure',
  'flooded',
  'choice',
  'portal',
];

export interface SpecialFloorOption {
  id: string;
  emoji: string;
  label: string;
  description: string;
}

export interface SpecialFloor {
  type: SpecialFloorType;
  description: string;
  /** Machine-readable effect tag consumed by the engine. */
  effect: string;
  options: SpecialFloorOption[];
}

// ---------------------------------------------------------------------------
// Trigger check
// ---------------------------------------------------------------------------

/**
 * Decide whether a floor should become a special floor.
 * ~1-in-7 chance, suppressed on boss floors (every 5th floor) and floors ≤ 0.
 */
export function shouldTriggerSpecialFloor(rng: RNG, floor: number): boolean {
  if (floor <= 0) return false;
  if (isBossFloor(floor)) return false;
  return rng.chance(1 / 7);
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * Generate a special floor event. If `type` is omitted, one is rolled at
 * random (uniform over the 6 types). Scales flavor with floor depth.
 */
export function generateSpecialFloor(
  rng: RNG,
  floor: number,
  type?: SpecialFloorType,
): SpecialFloor {
  const chosen = type ?? rng.pick(SPECIAL_FLOOR_TYPES);

  switch (chosen) {
    case 'mystery':
      return generateMystery(rng, floor);
    case 'cursed':
      return generateCursed(rng, floor);
    case 'treasure':
      return generateTreasure(rng, floor);
    case 'flooded':
      return generateFlooded(rng, floor);
    case 'choice':
      return generateChoice(rng, floor);
    case 'portal':
      return generatePortal(rng, floor);
    default: {
      // Exhaustiveness guard — should never happen.
      const _exhaustive: never = chosen;
      void _exhaustive;
      return generateMystery(rng, floor);
    }
  }
}

// ---------------------------------------------------------------------------
// Per-type generators
// ---------------------------------------------------------------------------

const MYSTERY_DESCRIPTIONS = [
  'Une pièce obscure. Au centre, un coffre scellé ronfle doucement.',
  'Des runes vacillantes dessinent un cercle au sol. Quelque chose attend.',
  'Un autel de pierre, une offrande oubliée. L\'air est lourd de possibilités.',
  'Un miroir brisé reflète une pièce qui n\'existe pas. Vous entendez votre nom.',
];

const CURSED_DESCRIPTIONS = [
  'Une aura maléfique imprègne cet étage. Vos perk frémisssent.',
  'Des chaînes spectrales pendent du plafond. Elles semblent vous attendre.',
  'Un autel sanglant palpite. Quelque chose veut un tribut.',
  'Le sol est couvert de glyphes maudits. Chaque pas est un risque.',
];

const TREASURE_DESCRIPTIONS = [
  'Une salle brillante d\'or et de gemmes. Trop beau pour être vrai ?',
  'Un coffre monumental repose sur un piédestal, scellé par un ancient mécanisme.',
  'Des piles de coins scintillent dans la pénombre. L\'odeur d\'un piège est forte.',
  'Un dragon endormi veille sur un horde. Sa respiration est lente.',
];

const FLOODED_DESCRIPTIONS = [
  'L\'eau vous monte jusqu\'aux genoux. Il faut avancer vite.',
  'Une marée montante envahit la salle. Les sorts y réagissent étrangement.',
  'Un tunnel inondé. L\'air se raréfie — choisissez bien votre chemin.',
  'Des flots tumultueux bloquent le passage. Une seule issue, peut-être.',
];

const CHOICE_DESCRIPTIONS = [
  'Une croisée de chemins. Trois portes, trois destins.',
  'Une silhouette encapuchonnée vous tend trois cartes face cachée.',
  'Un marchand fantôme propose un marché étrange, valable une seule fois.',
  'Trois crânes flottent en l\'air. L\'un d\'eux murmure votre avenir.',
];

const PORTAL_DESCRIPTIONS = [
  'Une faille lumineuse pulse au centre de la pièce.',
  'Un portail violet tourbillonne. Où mène-t-il ?',
  'Des éclats de réalité flottent. Vous pourriez sauter plus profond.',
  'Un escalier impossible descend vers nulle part et partout.',
];

function generateMystery(rng: RNG, floor: number): SpecialFloor {
  const desc = rng.pick(MYSTERY_DESCRIPTIONS);
  const rewardCoins = 100 + floor * 25;
  return {
    type: 'mystery',
    description: `${desc} (Étage ${floor})`,
    effect: 'mystery_chest',
    options: [
      {
        id: 'open', emoji: '🎁', label: 'Ouvrir',
        description: `Récompense aléatoire : coins, perk ou piège (~${rewardCoins} coins possibles).`,
      },
      {
        id: 'inspect', emoji: '🔍', label: 'Inspecter',
        description: 'Révèle partiellement le contenu (réduit le risque et le gain).',
      },
      {
        id: 'leave', emoji: '🚪', label: 'Passer',
        description: 'Ignore le coffre et avance. Aucun risque, aucun gain.',
      },
    ],
  };
}

function generateCursed(rng: RNG, floor: number): SpecialFloor {
  const desc = rng.pick(CURSED_DESCRIPTIONS);
  return {
    type: 'cursed',
    description: `${desc} (Étage ${floor})`,
    effect: 'curse_choice',
    options: [
      {
        id: 'power', emoji: '😈', label: 'Accepter la malédiction',
        description: '+1 perk epic MAIS subit une affliction permanente ce run.',
      },
      {
        id: 'cleanse', emoji: '✨', label: 'Purifier',
        description: 'Consomme 200 coins (ou 10% HP si impossible) pour annuler la malédiction.',
      },
      {
        id: 'flee', emoji: '🏃', label: 'Fuir',
        description: 'Quitte l\'étage. La malédiction vous suit au combat suivant (+50% ennemi).',
      },
    ],
  };
}

function generateTreasure(rng: RNG, floor: number): SpecialFloor {
  const desc = rng.pick(TREASURE_DESCRIPTIONS);
  const bigCoins = 300 + floor * 50;
  return {
    type: 'treasure',
    description: `${desc} (Étage ${floor})`,
    effect: 'treasure_hoard',
    options: [
      {
        id: 'grab_coins', emoji: '💰', label: 'Prendre les coins',
        description: `+${bigCoins} coins. Risque modéré de piège.`,
      },
      {
        id: 'grab_relic', emoji: '💎', label: 'Prendre la relique',
        description: 'Une relique légendaire... mais le gardien pourrait se réveiller.',
      },
      {
        id: 'careful', emoji: '🧺', label: 'Fouille prudente',
        description: 'Moins de gain, mais garanti sans danger.',
      },
    ],
  };
}

function generateFlooded(rng: RNG, floor: number): SpecialFloor {
  const desc = rng.pick(FLOODED_DESCRIPTIONS);
  return {
    type: 'flooded',
    description: `${desc} (Étage ${floor})`,
    effect: 'flood_escape',
    options: [
      {
        id: 'rush', emoji: '🏊', label: 'Nager vite',
        description: 'Atteint la sortie, -15 HP. Garde tous les perks.',
      },
      {
        id: 'salvage', emoji: '📦', label: 'Récupérer le butin',
        description: 'Prend le temps de récupérer un coffre, -30 HP, gagne ~250 coins.',
      },
      {
        id: 'magic', emoji: '🔮', label: 'Magie de l\'eau',
        description: 'Nécessite une perk/utilité. Passe sans dégâts, +1 énergie.',
      },
    ],
  };
}

function generateChoice(rng: RNG, floor: number): SpecialFloor {
  const desc = rng.pick(CHOICE_DESCRIPTIONS);
  return {
    type: 'choice',
    description: `${desc} (Étage ${floor})`,
    effect: 'three_paths',
    options: [
      {
        id: 'path_power', emoji: '⚔️', label: 'Voie de la Puissance',
        description: 'Combat difficile immédiat, récompense perk rare garantie.',
      },
      {
        id: 'path_wealth', emoji: '🪙', label: 'Voie de la Richesse',
        description: 'Évite le combat, gagne des coins, mais aucun XP/perk.',
      },
      {
        id: 'path_mystery', emoji: '🌀', label: 'Voie du Mystère',
        description: 'Effet aléatoire : bonus massif OU malus sévère.',
      },
    ],
  };
}

function generatePortal(rng: RNG, floor: number): SpecialFloor {
  const desc = rng.pick(PORTAL_DESCRIPTIONS);
  const skipTo = floor + rng.int(2, 5);
  return {
    type: 'portal',
    description: `${desc} (Étage ${floor})`,
    effect: 'portal_jump',
    options: [
      {
        id: 'jump_ahead', emoji: '⏩', label: `Sauter à l'étage ${skipTo}`,
        description: `Saute ${skipTo - floor} étages. Risque accru, récompense doublée.`,
      },
      {
        id: 'jump_back', emoji: '⏪', label: 'Reculer d\'un étage',
        description: 'Revient à l\'étage précédent pour re-tenter un choix.',
      },
      {
        id: 'close', emoji: '🚪', label: 'Fermer le portail',
        description: 'Avance normalement d\'un étage. Sans risque.',
      },
    ],
  };
}
