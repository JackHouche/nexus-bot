/**
 * NEXUS — Achievements System (100+ achievements)
 * 8 categories: Combat, Exploration, Perks, Gamble, Economy, Social, Prestige, Collection
 */

export type AchievementCategory =
  | 'combat' | 'exploration' | 'perks' | 'gamble'
  | 'economy' | 'social' | 'prestige' | 'collection';

export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface AchievementDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  hidden?: boolean;
  reward: {
    gems?: number;
    souls?: number;
    coins?: number;
    gear?: string;
    title?: string;
  };
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // === COMBAT (20) ===
  { id: 'first_blood', name: 'Premier Sang', emoji: '🩸', description: 'Complète ton premier combat', category: 'combat', rarity: 'common', reward: { gems: 5 } },
  { id: 'kill_10', name: 'Chasseur', emoji: '⚔️', description: 'Tue 10 ennemis', category: 'combat', rarity: 'common', reward: { gems: 5 } },
  { id: 'kill_100', name: 'Boucher', emoji: '🗡️', description: 'Tue 100 ennemis', category: 'combat', rarity: 'uncommon', reward: { gems: 15 } },
  { id: 'kill_1000', name: 'Exterminateur', emoji: '☠️', description: 'Tue 1 000 ennemis', category: 'combat', rarity: 'rare', reward: { gems: 50, souls: 10 } },
  { id: 'boss_1', name: 'Boss Killer', emoji: '💀', description: 'Tue ton premier boss', category: 'combat', rarity: 'common', reward: { gems: 10 } },
  { id: 'boss_10', name: 'Boss Slayer', emoji: '⚡', description: 'Tue 10 bosses', category: 'combat', rarity: 'uncommon', reward: { gems: 25 } },
  { id: 'boss_50', name: 'Boss Destroyer', emoji: '🌋', description: 'Tue 50 bosses', category: 'combat', rarity: 'epic', reward: { gems: 100 } },
  { id: 'no_damage', name: 'Intouchable', emoji: '🛡️', description: 'Termine un combat sans subir de dégâts', category: 'combat', rarity: 'uncommon', reward: { gems: 20 } },
  { id: 'no_damage_5', name: 'Mur de Fer', emoji: '🏰', description: '5 combats sans dégâts en une run', category: 'combat', rarity: 'rare', reward: { gems: 40 } },
  { id: 'crit_chain', name: 'Machine à Crit', emoji: '🎯', description: '10 critiques en un seul combat', category: 'combat', rarity: 'rare', reward: { gems: 35 } },
  { id: 'kill_1hp', name: 'Survivant', emoji: '❤️‍🩹', description: 'Tue un ennemi avec exactement 1 HP', category: 'combat', rarity: 'rare', reward: { gems: 30 } },
  { id: 'kill_boss_1hp', name: 'L\'Imbattable', emoji: '💫', description: 'Tue un boss avec moins de 5 HP', category: 'combat', rarity: 'epic', reward: { gems: 75 } },
  { id: 'boss_instakill', name: 'Foudroyant', emoji: '⚡', description: 'Tue un boss en un coup (Frappe Mortelle)', category: 'combat', rarity: 'legendary', reward: { gems: 200 } },
  { id: 'kill_mirror', name: 'Narcisse', emoji: '🪞', description: 'Vaincs Le Miroir (boss étage 20)', category: 'combat', rarity: 'epic', reward: { gems: 60 } },
  { id: 'kill_architect', name: 'Démolisseur', emoji: '🏛️', description: 'Vaincs L\'Architecte (boss étage 25)', category: 'combat', rarity: 'legendary', reward: { gems: 150 } },
  { id: 'duel_1', name: 'Duelliste', emoji: '🤺', description: 'Gagne ton premier duel PvP', category: 'combat', rarity: 'common', reward: { gems: 10 } },
  { id: 'duel_10', name: 'Combattant', emoji: '⚔️', description: 'Gagne 10 duels', category: 'combat', rarity: 'uncommon', reward: { gems: 25 } },
  { id: 'duel_50', name: 'Champion', emoji: '🏆', description: 'Gagne 50 duels', category: 'combat', rarity: 'rare', reward: { gems: 75 } },
  { id: 'comeback', name: 'Résurrection', emoji: '♾️', description: 'Gagne un duel avec moins de 10 HP', category: 'combat', rarity: 'epic', reward: { gems: 50 } },
  { id: 'stun_lock', name: 'Stun Lock', emoji: '💫', description: 'Étourdis l\'ennemi 3 tours de suite', category: 'combat', rarity: 'rare', reward: { gems: 30 } },

  // === EXPLORATION (20) ===
  { id: 'floor_5', name: 'Premier Pas', emoji: '👞', description: 'Atteins l\'étage 5', category: 'exploration', rarity: 'common', reward: { gems: 10 } },
  { id: 'floor_10', name: 'Explorateur', emoji: '🧭', description: 'Atteins l\'étage 10', category: 'exploration', rarity: 'uncommon', reward: { gems: 20 } },
  { id: 'floor_15', name: 'Aventurier', emoji: '🗺️', description: 'Atteins l\'étage 15', category: 'exploration', rarity: 'uncommon', reward: { gems: 30 } },
  { id: 'floor_20', name: 'Pionnier', emoji: '🏔️', description: 'Atteins l\'étage 20', category: 'exploration', rarity: 'rare', reward: { gems: 50 } },
  { id: 'floor_25', name: 'Légende', emoji: '🌟', description: 'Atteins l\'étage 25', category: 'exploration', rarity: 'epic', reward: { gems: 100 } },
  { id: 'floor_30', name: 'Mythe', emoji: '🌠', description: 'Atteins l\'étage 30', category: 'exploration', rarity: 'legendary', reward: { gems: 200 } },
  { id: 'floor_40', name: 'Transcendant', emoji: '🌌', description: 'Atteins l\'étage 40', category: 'exploration', rarity: 'legendary', reward: { gems: 300, title: 'Transcendant' } },
  { id: 'floor_50', name: 'L\'Impossible', emoji: '⭐', description: 'Atteins l\'étage 50', category: 'exploration', rarity: 'legendary', reward: { gems: 500, title: 'L\'Impossible' } },
  { id: 'runs_10', name: 'Habitué', emoji: '🎮', description: 'Joue 10 runs', category: 'exploration', rarity: 'common', reward: { gems: 10 } },
  { id: 'runs_50', name: 'Régulier', emoji: '🎯', description: 'Joue 50 runs', category: 'exploration', rarity: 'uncommon', reward: { gems: 25 } },
  { id: 'runs_100', name: 'Vétéran', emoji: '🎖️', description: 'Joue 100 runs', category: 'exploration', rarity: 'rare', reward: { gems: 50 } },
  { id: 'runs_500', name: 'Obsédé', emoji: '🔮', description: 'Joue 500 runs', category: 'exploration', rarity: 'epic', reward: { gems: 150 } },
  { id: 'runs_1000', name: 'Légende Vivante', emoji: '👑', description: 'Joue 1 000 runs', category: 'exploration', rarity: 'legendary', reward: { gems: 500, title: 'Légende Vivante' } },
  { id: 'no_death_streak_5', name: 'Prudent', emoji: '🧠', description: '5 runs sans mourir (quit)', category: 'exploration', rarity: 'uncommon', reward: { gems: 30 } },
  { id: 'no_death_streak_10', name: 'Calculateur', emoji: '🧮', description: '10 runs sans mourir', category: 'exploration', rarity: 'rare', reward: { gems: 60 } },
  { id: 'all_floor_types', name: 'Touche-à-tout', emoji: '🎲', description: 'Rencontre tous les types d\'étages', category: 'exploration', rarity: 'uncommon', reward: { gems: 20 } },
  { id: 'biome_all', name: 'Globe-Trotter', emoji: '🌍', description: 'Visite tous les biomes', category: 'exploration', rarity: 'rare', reward: { gems: 50 } },
  { id: 'special_floor', name: 'Curieux', emoji: '❓', description: 'Trouve ton premier étage spécial', category: 'exploration', rarity: 'common', reward: { gems: 10 } },
  { id: 'treasure_floor', name: 'Chanceux', emoji: '💎', description: 'Trouve un étage trésor', category: 'exploration', rarity: 'uncommon', reward: { gems: 25 } },
  { id: 'mystery_gamble', name: 'Joueur', emoji: '🎰', description: 'Choisis un étage mystère 10 fois', category: 'exploration', rarity: 'uncommon', reward: { gems: 30 } },

  // === PERKS & SYNERGIES (20) ===
  { id: 'first_perk', name: 'Première Sélection', emoji: '🎁', description: 'Choisis ton premier perk', category: 'perks', rarity: 'common', reward: { gems: 5 } },
  { id: 'synergy_1', name: 'Découvreur', emoji: '⚡', description: 'Découvre ta première synergie', category: 'perks', rarity: 'common', reward: { gems: 15 } },
  { id: 'synergy_5', name: 'Alchimiste', emoji: '🧪', description: 'Découvre 5 synergies', category: 'perks', rarity: 'uncommon', reward: { gems: 30 } },
  { id: 'synergy_12', name: 'Maître Synergiste', emoji: '🔮', description: 'Découvre les 12 synergies', category: 'perks', rarity: 'epic', reward: { gems: 100 } },
  { id: 'perk_variant_1', name: 'Collectionneur', emoji: '📖', description: 'Découvre ta première variante de perk', category: 'perks', rarity: 'common', reward: { gems: 10 } },
  { id: 'perk_variant_10', name: 'Chercheur', emoji: '🔍', description: 'Découvre 10 variantes', category: 'perks', rarity: 'uncommon', reward: { gems: 25 } },
  { id: 'perk_variant_50', name: 'Scolaire', emoji: '📚', description: 'Découvre 50 variantes', category: 'perks', rarity: 'rare', reward: { gems: 60 } },
  { id: 'perk_variant_100', name: 'Encyclopédiste', emoji: '📜', description: 'Découvre 100 variantes', category: 'perks', rarity: 'epic', reward: { gems: 150 } },
  { id: 'perk_variant_500', name: 'Archiviste', emoji: '🏛️', description: 'Découvre 500 variantes', category: 'perks', rarity: 'legendary', reward: { gems: 400, title: 'Archiviste' } },
  { id: 'perk_mythic', name: 'Béni des Dieux', emoji: '🔴', description: 'Trouve une variante mythique', category: 'perks', rarity: 'legendary', reward: { gems: 200 } },
  { id: '8_perks', name: 'Bourré', emoji: '🎒', description: 'Aie 8 perks simultanés en run', category: 'perks', rarity: 'rare', reward: { gems: 40 } },
  { id: 'full_curse', name: 'Damné', emoji: '😈', description: 'Termine une run avec uniquement des perks de malédiction', category: 'perks', rarity: 'epic', reward: { gems: 80 } },
  { id: 'no_perks_run', name: 'Puriste', emoji: '🤫', description: 'Atteins l\'étage 10 sans aucun perk', category: 'perks', rarity: 'legendary', reward: { gems: 300 } },
  { id: 'all_offensive', name: 'Attaquant Né', emoji: '⚔️', description: 'Run avec uniquement des perks offensifs', category: 'perks', rarity: 'uncommon', reward: { gems: 30 } },
  { id: 'all_defensive', name: 'Inébranlable', emoji: '🛡️', description: 'Run avec uniquement des perks défensifs', category: 'perks', rarity: 'uncommon', reward: { gems: 30 } },
  { id: 'synergy_triple', name: 'Trinité', emoji: '🔱', description: 'Aie 3 synergies actives simultanément', category: 'perks', rarity: 'epic', reward: { gems: 75 } },
  { id: 'curse_gamble', name: 'Le Parieur', emoji: '🎲', description: 'Run full gamble + curse', category: 'perks', rarity: 'epic', reward: { gems: 70 } },
  { id: 'relic_run', name: 'Chasseur de Reliques', emoji: '🏺', description: 'Équipe 3 reliques en une run', category: 'perks', rarity: 'rare', reward: { gems: 45 } },
  { id: 'primordial_find', name: 'Origine', emoji: '✨', description: 'Trouve un perk primordial', category: 'perks', rarity: 'legendary', reward: { gems: 250 } },
  { id: 'modifier_master', name: 'Modificateur', emoji: '🔧', description: 'Découvre 20 modificateurs différents', category: 'perks', rarity: 'rare', reward: { gems: 50 } },

  // === GAMBLE (15) ===
  { id: 'gamble_1', name: 'Premier Pari', emoji: '🎲', description: 'Joue ton premier gamble', category: 'gamble', rarity: 'common', reward: { gems: 5 } },
  { id: 'gamble_win_10', name: 'Chanceux', emoji: '🍀', description: 'Gagne 10 gambles', category: 'gamble', rarity: 'common', reward: { gems: 15 } },
  { id: 'gamble_streak_5', name: 'Série Chaude', emoji: '🔥', description: 'Gagne 5 gambles d\'affilée', category: 'gamble', rarity: 'uncommon', reward: { gems: 30 } },
  { id: 'gamble_streak_10', name: 'Inarrêtable', emoji: '⚡', description: 'Gagne 10 gambles d\'affilée', category: 'gamble', rarity: 'rare', reward: { gems: 60 } },
  { id: 'dice_12', name: 'Max Dice', emoji: '🎯', description: 'Lance un 12 au duel de dés', category: 'gamble', rarity: 'uncommon', reward: { gems: 25 } },
  { id: 'dice_win_2', name: 'L\'Impossible', emoji: '🎲', description: 'Gagne un duel de dés avec 2 contre 12', category: 'gamble', rarity: 'legendary', reward: { gems: 200 } },
  { id: 'chest_perk', name: 'Maître Coffre', emoji: '🎁', description: 'Récupère un perk au coffre mystère', category: 'gamble', rarity: 'uncommon', reward: { gems: 20 } },
  { id: 'wheel_safe', name: 'Chance Roue', emoji: '🎡', description: 'Survivis à la roue 10 fois', category: 'gamble', rarity: 'common', reward: { gems: 15 } },
  { id: 'gamble_broke', name: 'Le Téméraire', emoji: '💀', description: 'Perds 5 gambles d\'affilée mais continues', category: 'gamble', rarity: 'uncommon', reward: { gems: 25 } },
  { id: 'all_gamble_types', name: 'Croupier', emoji: '🃏', description: 'Joue les 4 types de gamble', category: 'gamble', rarity: 'common', reward: { gems: 15 } },
  { id: 'double_or_nothing_5x', name: 'Double ou Rien x5', emoji: '💰', description: 'Gagne 5 double-or-nothing d\'affilée', category: 'gamble', rarity: 'epic', reward: { gems: 80 } },
  { id: 'pact_big', name: 'Gros Pacte', emoji: '📦', description: 'Quitte avec plus de 10 000 ¢', category: 'gamble', rarity: 'rare', reward: { gems: 40 } },
  { id: 'pact_huge', name: 'Jackpot', emoji: '💎', description: 'Quitte avec plus de 50 000 ¢', category: 'gamble', rarity: 'epic', reward: { gems: 100 } },
  { id: 'pact_massive', name: 'Fortune', emoji: '🏦', description: 'Quitte avec plus de 100 000 ¢', category: 'gamble', rarity: 'legendary', reward: { gems: 300, title: 'Fortune' } },
  { id: 'insurance_payout', name: 'Assuré', emoji: '📋', description: 'Récupère de l\'argent via Assurance Vie', category: 'gamble', rarity: 'uncommon', reward: { gems: 20 } },

  // === ECONOMY (10) ===
  { id: 'coins_1k', name: 'Premier Bilan', emoji: '🪙', description: 'Accumule 1 000 ¢', category: 'economy', rarity: 'common', reward: { gems: 5 } },
  { id: 'coins_10k', name: 'Aisé', emoji: '💰', description: 'Accumule 10 000 ¢', category: 'economy', rarity: 'uncommon', reward: { gems: 20 } },
  { id: 'coins_50k', name: 'Riche', emoji: '🏦', description: 'Accumule 50 000 ¢', category: 'economy', rarity: 'rare', reward: { gems: 50 } },
  { id: 'coins_100k', name: 'Magnat', emoji: '👑', description: 'Accumule 100 000 ¢', category: 'economy', rarity: 'epic', reward: { gems: 100 } },
  { id: 'coins_500k', name: 'Empire', emoji: '🏛️', description: 'Accumule 500 000 ¢', category: 'economy', rarity: 'legendary', reward: { gems: 300, title: 'Magnat' } },
  { id: 'shop_spender', name: 'Client Fidèle', emoji: '🏪', description: 'Dépense 5 000 ¢ au shop', category: 'economy', rarity: 'uncommon', reward: { gems: 20 } },
  { id: 'shop_whale', name: 'Gros Client', emoji: '🐋', description: 'Dépense 50 000 ¢ au shop', category: 'economy', rarity: 'rare', reward: { gems: 50 } },
  { id: 'duel_rich', name: 'Le Roi du Duel', emoji: '🤺', description: 'Gagne un duel avec 10 000 ¢ de mise', category: 'economy', rarity: 'epic', reward: { gems: 75 } },
  { id: 'market_mogul', name: 'Marchand', emoji: '📊', description: 'Vends 10 items sur le marché', category: 'economy', rarity: 'uncommon', reward: { gems: 25 } },
  { id: 'repair_gear', name: 'Bricoleur', emoji: '🔧', description: 'Répare ton gear 10 fois', category: 'economy', rarity: 'common', reward: { gems: 10 } },

  // === SOCIAL (15) ===
  { id: 'corpse_1', name: 'Fossoyeur', emoji: '⚰️', description: 'Trouve ton premier cadavre', category: 'social', rarity: 'common', reward: { gems: 10 } },
  { id: 'corpse_10', name: 'Pillard', emoji: '💀', description: 'Trouve 10 cadavres', category: 'social', rarity: 'uncommon', reward: { gems: 25 } },
  { id: 'corpse_respect', name: 'Âme Noble', emoji: '🙏', description: 'Respecte 5 cadavres (ne prends rien)', category: 'social', rarity: 'uncommon', reward: { gems: 30 } },
  { id: 'corpse_profane', name: 'Profanateur', emoji: '😈', description: 'Profane 3 cadavres', category: 'social', rarity: 'rare', reward: { gems: 40 } },
  { id: 'corpse_self', name: 'Retour', emoji: '👻', description: 'Trouve TON propre cadavre d\'une run précédente', category: 'social', rarity: 'epic', reward: { gems: 60 } },
  { id: 'msg_leave', name: 'Scripteur', emoji: '✍️', description: 'Laisse 5 messages fantômes', category: 'social', rarity: 'common', reward: { gems: 10 } },
  { id: 'msg_upvoted', name: 'Conseiller', emoji: '👍', description: 'Un de tes messages obtient 5 upvotes', category: 'social', rarity: 'uncommon', reward: { gems: 25 } },
  { id: 'msg_troll', name: 'Troll', emoji: '😏', description: 'Un de tes messages obtient 5 downvotes', category: 'social', rarity: 'uncommon', reward: { gems: 15 } },
  { id: 'raid_join', name: 'Coopératif', emoji: '🤝', description: 'Participe à ton premier raid', category: 'social', rarity: 'common', reward: { gems: 10 } },
  { id: 'raid_top', name: 'Héros du Serveur', emoji: '🦸', description: 'Sois le top contributeur d\'un raid', category: 'social', rarity: 'epic', reward: { gems: 80 } },
  { id: 'raid_win', name: 'Vainqueur', emoji: '🐉', description: 'Sois présent quand un raid est vaincu', category: 'social', rarity: 'uncommon', reward: { gems: 30 } },
  { id: 'rivalry', name: 'Rivalité', emoji: '⚔️', description: 'Gagne 5 duels contre la même personne', category: 'social', rarity: 'rare', reward: { gems: 50 } },
  { id: 'help_newbie', name: 'Bienveillant', emoji: '🤗', description: 'Laisse un message utile upvoté par un nouveau joueur', category: 'social', rarity: 'uncommon', reward: { gems: 20 } },
  { id: 'ghost_npc', name: 'Légende', emoji: '👻', description: 'Ton fantôme est rencontré par 10 joueurs', category: 'social', rarity: 'epic', reward: { gems: 75 } },
  { id: 'market_deal', name: 'Négociateur', emoji: '🤝', description: 'Fais un bénéfice de 5 000 ¢ sur le marché', category: 'social', rarity: 'rare', reward: { gems: 40 } },

  // === PRESTIGE (5) ===
  { id: 'prestige_1', name: 'Renouveau', emoji: '🌟', description: 'Atteins le prestige 1', category: 'prestige', rarity: 'rare', reward: { gems: 100 } },
  { id: 'prestige_3', name: 'Ascension', emoji: '🌟🌟🌟', description: 'Atteins le prestige 3', category: 'prestige', rarity: 'epic', reward: { gems: 200 } },
  { id: 'prestige_5', name: 'Illumination', emoji: '✨', description: 'Atteins le prestige 5', category: 'prestige', rarity: 'legendary', reward: { gems: 500, title: 'Illuminé' } },
  { id: 'prestige_10', name: 'Transcendance', emoji: '♾️', description: 'Atteins le prestige 10', category: 'prestige', rarity: 'legendary', reward: { gems: 1000, title: 'Transcendant' } },
  { id: 'prestige_20', name: 'L\'Éternel', emoji: '🔱', description: 'Atteins le prestige 20', category: 'prestige', rarity: 'legendary', reward: { gems: 2000, title: 'L\'Éternel' } },

  // === COLLECTION (10) ===
  { id: 'class_all', name: 'Polymathe', emoji: '🎭', description: 'Débloque toutes les classes', category: 'collection', rarity: 'legendary', reward: { gems: 500 } },
  { id: 'class_mastery_max', name: 'Maître Absolu', emoji: '🏅', description: 'Maîtrise 20 sur une classe', category: 'collection', rarity: 'legendary', reward: { gems: 300 } },
  { id: 'gear_legendary', name: 'Chasseur de Légendaires', emoji: '🟡', description: 'Trouve ton premier gear légendaire', category: 'collection', rarity: 'epic', reward: { gems: 80 } },
  { id: 'gear_mythic', name: 'Détenteur du Mythe', emoji: '🔴', description: 'Trouve ton premier gear mythique', category: 'collection', rarity: 'legendary', reward: { gems: 200 } },
  { id: 'set_complete', name: 'Collectionneur', emoji: '🗃️', description: 'Complète un set de gear (4/4)', category: 'collection', rarity: 'epic', reward: { gems: 100 } },
  { id: 'all_sets', name: 'Garderobe', emoji: '👔', description: 'Complète tous les sets', category: 'collection', rarity: 'legendary', reward: { gems: 1000 } },
  { id: 'collection_25', name: 'Rang A', emoji: '🥇', description: '25% de collection complétée', category: 'collection', rarity: 'rare', reward: { gems: 50 } },
  { id: 'collection_50', name: 'Rang S', emoji: '💎', description: '50% de collection complétée', category: 'collection', rarity: 'epic', reward: { gems: 150 } },
  { id: 'collection_75', name: 'Rang S+', emoji: '👑', description: '75% de collection complétée', category: 'collection', rarity: 'legendary', reward: { gems: 400 } },
  { id: 'collection_100', name: 'PERFECTION', emoji: '⭐', description: '100% de collection', category: 'collection', rarity: 'legendary', reward: { gems: 2000, title: 'Perfection' } },
];

/**
 * Get achievement by ID
 */
export function getAchievement(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/**
 * Get all achievements in a category
 */
export function getAchievementsByCategory(category: AchievementCategory): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => a.category === category);
}

/**
 * Get total count
 */
export function getTotalAchievements(): number {
  return ACHIEVEMENTS.length;
}
