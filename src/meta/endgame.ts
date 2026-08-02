/**
 * NEXUS — Endgame Modes: Hardcore, Endless, Custom, Gauntlet
 */

import { prisma } from '../database.js';

export type GameMode = 'normal' | 'hardcore' | 'daily' | 'custom' | 'endless' | 'gauntlet';

export interface ModeDef {
  id: GameMode;
  name: string;
  emoji: string;
  description: string;
  unlockRequirement: string;
  rewardMultiplier: number;
  rules: string[];
}

export const GAME_MODES: Record<GameMode, ModeDef> = {
  normal: {
    id: 'normal',
    name: 'Normal',
    emoji: '🎮',
    description: 'Mode standard. Quitte quand tu veux.',
    unlockRequirement: 'Disponible dès le départ',
    rewardMultiplier: 1.0,
    rules: ['Quit autorisé', 'Pacte sécurisé', 'Death = perte du pacte'],
  },
  hardcore: {
    id: 'hardcore',
    name: 'Hardcore',
    emoji: '💀',
    description: 'Une vie. Pas de quit. Mort = perte TOTALE (y compris gear équipé).',
    unlockRequirement: 'Prestige 1',
    rewardMultiplier: 3.0,
    rules: ['Pas de quit', 'Pas de revive', 'Mort = perte du gear équipé', 'Récompenses x3'],
  },
  daily: {
    id: 'daily',
    name: 'Daily Seed',
    emoji: '📅',
    description: 'Le même seed pour tout le serveur. Leaderboard quotidien.',
    unlockRequirement: 'Prestige 5',
    rewardMultiplier: 1.5,
    rules: ['Seed imposé', 'Leaderboard séparé', '1 run à la fois', 'Récompenses x1.5'],
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    emoji: '🔧',
    description: 'Choisis 2 perks de départ. Mode expérimental.',
    unlockRequirement: 'Prestige 7',
    rewardMultiplier: 0.8,
    rules: ['2 perks de départ', 'Pas de leaderboards', 'Pour expérimenter'],
  },
  endless: {
    id: 'endless',
    name: 'Endless',
    emoji: '♾️',
    description: 'Scaling infini. Pas de plafond. Leaderboard all-time.',
    unlockRequirement: 'Prestige 10',
    rewardMultiplier: 2.0,
    rules: ['Étages illimités', 'Scaling infini', 'Leaderboard all-time', 'Récompenses x2'],
  },
  gauntlet: {
    id: 'gauntlet',
    name: 'Gauntlet',
    emoji: '⛓️',
    description: 'Suite de 7 challenges quotidiens. Récompense massive si complété.',
    unlockRequirement: 'Saison active',
    rewardMultiplier: 5.0,
    rules: ['7 défis en 7 jours', 'Pas de break', 'Récompense finale x5'],
  },
};

/**
 * Check if a user can access a game mode.
 */
export async function canAccessMode(userId: string, mode: GameMode): Promise<{ allowed: boolean; reason?: string }> {
  if (mode === 'normal') return { allowed: true };

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { prestiges: true } });
  if (!user) return { allowed: false, reason: 'Utilisateur introuvable' };

  const prestigeLevel = user.prestiges?.level ?? 0;

  switch (mode) {
    case 'hardcore':
      if (prestigeLevel < 1) return { allowed: false, reason: 'Nécessite Prestige 1' };
      break;
    case 'daily':
      if (prestigeLevel < 5) return { allowed: false, reason: 'Nécessite Prestige 5' };
      break;
    case 'custom':
      if (prestigeLevel < 7) return { allowed: false, reason: 'Nécessite Prestige 7' };
      break;
    case 'endless':
      if (prestigeLevel < 10) return { allowed: false, reason: 'Nécessite Prestige 10' };
      break;
    case 'gauntlet':
      // Needs active season
      break;
  }

  return { allowed: true };
}

/**
 * Get the reward multiplier for a mode.
 */
export function getModeMultiplier(mode: GameMode): number {
  return GAME_MODES[mode]?.rewardMultiplier ?? 1.0;
}
