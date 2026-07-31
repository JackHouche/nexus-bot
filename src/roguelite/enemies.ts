/**
 * Enemy definitions and scaling for NEXUS roguelite.
 */

export interface Enemy {
  id: string;
  name: string;
  emoji: string;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  isBoss?: boolean;
  abilities?: string[];
}

/**
 * Common enemies — scaled by floor number.
 */
const COMMON_ENEMIES: Enemy[] = [
  { id: 'rat', name: 'Rat Géant', emoji: '🐀', baseHp: 20, baseAtk: 6, baseDef: 0 },
  { id: 'slime', name: 'Slime', emoji: '🟢', baseHp: 35, baseAtk: 4, baseDef: 2 },
  { id: 'wolf', name: 'Loup Sauvage', emoji: '🐺', baseHp: 30, baseAtk: 10, baseDef: 1 },
  { id: 'skeleton', name: 'Squelette', emoji: '💀', baseHp: 40, baseAtk: 8, baseDef: 3 },
  { id: 'spider', name: 'Araignée Géante', emoji: '🕷️', baseHp: 25, baseAtk: 12, baseDef: 0, abilities: ['poison'] },
  { id: 'ghost', name: 'Fantôme', emoji: '👻', baseHp: 45, baseAtk: 7, baseDef: 5, abilities: ['curse'] },
  { id: 'zombie', name: 'Zombie', emoji: '🧟', baseHp: 60, baseAtk: 6, baseDef: 2 },
  { id: 'gargoyle', name: 'Gargouille', emoji: '🗿', baseHp: 55, baseAtk: 9, baseDef: 8 },
  { id: 'imp', name: 'Diablotin', emoji: '😈', baseHp: 35, baseAtk: 14, baseDef: 1, abilities: ['fireball'] },
  { id: 'golem', name: 'Golem de Pierre', emoji: '🪨', baseHp: 100, baseAtk: 5, baseDef: 15 },
];

/**
 * Boss enemies — appear every 5 floors.
 */
const BOSS_ENEMIES: Enemy[] = [
  { id: 'guardian', name: 'Le Gardien', emoji: '🛡️', baseHp: 150, baseAtk: 15, baseDef: 10, isBoss: true },
  { id: 'witch', name: 'La Sorcière', emoji: '🧙‍♀️', baseHp: 120, baseAtk: 22, baseDef: 5, isBoss: true, abilities: ['curse', 'summon'] },
  { id: 'player_boss', name: 'Le Joueur', emoji: '🃏', baseHp: 180, baseAtk: 18, baseDef: 8, isBoss: true, abilities: ['copy_stats'] },
  { id: 'mirror', name: 'Le Miroir', emoji: '🪞', baseHp: 200, baseAtk: 20, baseDef: 10, isBoss: true, abilities: ['copy_perks'] },
  { id: 'architect', name: 'L\'Architecte', emoji: '🏛️', baseHp: 250, baseAtk: 25, baseDef: 12, isBoss: true, abilities: ['rule_change'] },
];

/**
 * Scale an enemy's stats based on the current floor.
 *
 * HP grows at 18% per floor, ATK at 15% per floor.
 * Bosses get x2.5 HP and x1.5 ATK on top of base stats.
 */
export function scaleEnemy(enemy: Enemy, floor: number): {
  hp: number;
  atk: number;
  def: number;
} {
  const hpMult = Math.pow(1.18, floor - 1);
  const atkMult = Math.pow(1.15, floor - 1);

  let hp = enemy.baseHp * hpMult;
  let atk = enemy.baseAtk * atkMult;

  if (enemy.isBoss) {
    hp *= 2.5;
    atk *= 1.5;
  }

  return {
    hp: Math.floor(hp),
    atk: Math.floor(atk),
    def: enemy.baseDef + Math.floor(floor / 3),
  };
}

/**
 * Pick a random enemy for a given floor.
 */
export function pickEnemy(
  enemies: Enemy[],
  floor: number,
  pickFn: <T>(arr: T[]) => T
): Enemy {
  return pickFn(enemies);
}

export function getCommonEnemies(): Enemy[] {
  return COMMON_ENEMIES;
}

export function getBoss(floor: number): Enemy {
  const bossIndex = Math.floor((floor - 5) / 5) % BOSS_ENEMIES.length;
  return BOSS_ENEMIES[bossIndex];
}

export function isBossFloor(floor: number): boolean {
  return floor > 0 && floor % 5 === 0;
}
