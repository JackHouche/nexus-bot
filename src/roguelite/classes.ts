/**
 * Class definitions for NEXUS roguelite.
 * Each class has base stats and a special ability.
 */

export type ClassId = 'warrior' | 'mage' | 'gambler' | 'rogue';

export interface ClassDef {
  id: ClassId;
  name: string;
  emoji: string;
  description: string;
  hp: number;
  atk: number;
  def: number;
  maxEnergy: number;
  special: {
    name: string;
    emoji: string;
    description: string;
    energyCost: number;
  };
}

export const CLASSES: Record<ClassId, ClassDef> = {
  warrior: {
    id: 'warrior',
    name: 'Guerrier',
    emoji: '⚔️',
    description: 'Tanky et consistant. Idéal pour débuter.',
    hp: 120,
    atk: 18,
    def: 8,
    maxEnergy: 3,
    special: {
      name: 'Frappe Puissante',
      emoji: '💥',
      description: 'Inflige x2 dégâts',
      energyCost: 2,
    },
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    emoji: '🔮',
    description: 'Glass cannon. Gros dégâts, fragile.',
    hp: 70,
    atk: 25,
    def: 3,
    maxEnergy: 4,
    special: {
      name: 'Boule de Feu',
      emoji: '🔥',
      description: 'Dégâts de zone + brûlure (DoT 3 tours)',
      energyCost: 2,
    },
  },
  gambler: {
    id: 'gambler',
    name: 'Gambler',
    emoji: '🎲',
    description: 'La chance te sourit. Haute variance.',
    hp: 90,
    atk: 15,
    def: 5,
    maxEnergy: 3,
    special: {
      name: 'Chance Activée',
      emoji: '🍀',
      description: 'Reroll le résultat de l\'action en cours',
      energyCost: 3,
    },
  },
  rogue: {
    id: 'rogue',
    name: 'Voleur',
    emoji: '🗡️',
    description: 'DPS précis avec coups critiques.',
    hp: 85,
    atk: 20,
    def: 4,
    maxEnergy: 3,
    special: {
      name: 'Dagues Jumelles',
      emoji: '🗡️',
      description: 'Frappe 2x avec 25% crit chance chacune',
      energyCost: 2,
    },
  },
};

export function getClass(id: ClassId): ClassDef {
  return CLASSES[id];
}

export function getAllClasses(): ClassDef[] {
  return Object.values(CLASSES);
}
