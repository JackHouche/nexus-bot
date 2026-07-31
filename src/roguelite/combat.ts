/**
 * Combat Resolver — pure logic for turn-based combat in NEXUS roguelite.
 * No Discord dependencies. Fully testable.
 */

import type { PlayerStats } from './perks.js';
import { RNG } from './rng.js';

export interface EnemyState {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  isBoss: boolean;
  abilities: string[];
  stunned: boolean;
}

export type CombatAction = 'attack' | 'defend' | 'special' | 'flee';

export interface CombatResult {
  /** What happened this turn */
  log: CombatLogEntry[];
  /** Updated player HP */
  playerHp: number;
  /** Updated enemy state */
  enemy: EnemyState;
  /** Is combat over? */
  over: boolean;
  /** Did the player win? */
  victory: boolean;
  /** Did the player flee? */
  fled: boolean;
  /** Is the player dead? */
  dead: boolean;
}

export interface CombatLogEntry {
  text: string;
  emoji: string;
  type: 'player' | 'enemy' | 'system' | 'crit' | 'heal' | 'stun';
}

/**
 * Create an EnemyState from floor data.
 */
export function createEnemy(
  enemy: { enemy: { id: string; name: string; emoji: string; isBoss?: boolean; abilities?: string[] }; hp: number; atk: number; def: number }
): EnemyState {
  return {
    id: enemy.enemy.id,
    name: enemy.enemy.name,
    emoji: enemy.enemy.emoji,
    hp: enemy.hp,
    maxHp: enemy.hp,
    atk: enemy.atk,
    def: enemy.def,
    isBoss: enemy.enemy.isBoss ?? false,
    abilities: enemy.enemy.abilities ?? [],
    stunned: false,
  };
}

/**
 * Player attacks the enemy.
 */
export function playerAttack(
  stats: PlayerStats,
  enemy: EnemyState,
  rng: RNG
): { enemy: EnemyState; damage: number; isCrit: boolean; stunned: boolean; killed: boolean } {
  let damage = stats.atk;
  let isCrit = false;
  let stunned = false;

  // Crit roll
  if (rng.chance(stats.critChance)) {
    damage = Math.floor(damage * stats.critMult);
    isCrit = true;
  }

  // Double attack perk — already handled by caller calling this twice

  // Apply enemy DEF
  damage = Math.max(1, damage - enemy.def);

  // Stun roll
  if (rng.chance(stats.stunChance)) {
    stunned = true;
    enemy.stunned = true;
  }

  enemy.hp = Math.max(0, enemy.hp - damage);

  return { enemy, damage, isCrit, stunned, killed: enemy.hp <= 0 };
}

/**
 * Player defends — reduces incoming damage this turn and heals slightly.
 */
export function playerDefend(): { damageReduction: number; heal: number } {
  return { damageReduction: 0.5, heal: 5 };
}

/**
 * Player special attack — class-specific.
 */
export function playerSpecial(
  className: string,
  stats: PlayerStats,
  enemy: EnemyState,
  rng: RNG,
  energy: number
): {
  enemy: EnemyState;
  playerHpChange: number;
  energyCost: number;
  log: CombatLogEntry[];
} {
  const log: CombatLogEntry[] = [];
  let energyCost = 2;
  let playerHpChange = 0;

  switch (className) {
    case 'warrior': {
      // Frappe Puissante — x2 damage
      energyCost = 2;
      const dmg = Math.max(1, Math.floor(stats.atk * 2) - enemy.def);
      enemy.hp = Math.max(0, enemy.hp - dmg);
      log.push({ text: `💥 Frappe Puissante ! ${dmg} dégâts à ${enemy.name}`, emoji: '💥', type: 'crit' });
      break;
    }
    case 'mage': {
      // Boule de Feu — AoE damage + burn DoT
      energyCost = 2;
      const dmg = Math.max(1, Math.floor(stats.atk * 1.5) - enemy.def);
      enemy.hp = Math.max(0, enemy.hp - dmg);
      log.push({ text: `🔥 Boule de Feu ! ${dmg} dégâts + brûlure`, emoji: '🔥', type: 'crit' });
      break;
    }
    case 'gambler': {
      // Chance Activée — reroll this combat encounter
      energyCost = 3;
      const bonus = rng.int(1, 50);
      enemy.hp = Math.max(0, enemy.hp - bonus);
      log.push({ text: `🍀 Chance Activée ! Bonus de ${bonus} dégâts`, emoji: '🍀', type: 'crit' });
      break;
    }
    case 'rogue': {
      // Dagues Jumelles — strike twice with crit chance
      energyCost = 2;
      let totalDmg = 0;
      for (let i = 0; i < 2; i++) {
        let d = stats.atk;
        if (rng.chance(0.25)) {
          d = Math.floor(d * stats.critMult);
          log.push({ text: `🗡️ Critique de dague !`, emoji: '🗡️', type: 'crit' });
        }
        d = Math.max(1, d - enemy.def);
        totalDmg += d;
      }
      enemy.hp = Math.max(0, enemy.hp - totalDmg);
      log.push({ text: `🗡️ Dagues Jumelles ! ${totalDmg} dégâts totaux`, emoji: '🗡️', type: 'player' });
      break;
    }
    default: {
      const dmg = Math.max(1, stats.atk - enemy.def);
      enemy.hp = Math.max(0, enemy.hp - dmg);
      log.push({ text: `Spécial inconnu, ${dmg} dégâts`, emoji: '❓', type: 'player' });
    }
  }

  return { enemy, playerHpChange, energyCost, log };
}

/**
 * Enemy takes its turn — attacks the player.
 */
export function enemyTurn(
  enemy: EnemyState,
  stats: PlayerStats,
  playerHp: number,
  rng: RNG,
  defendReduction: number = 0
): { playerHp: number; damage: number; log: CombatLogEntry[] } {
  const log: CombatLogEntry[] = [];

  if (enemy.stunned) {
    enemy.stunned = false;
    log.push({ text: `${enemy.emoji} ${enemy.name} est étourdi et passe son tour !`, emoji: '💫', type: 'stun' });
    return { playerHp, damage: 0, log };
  }

  let damage = enemy.atk;
  let actualDamage: number;

  // Boss abilities
  if (enemy.isBoss && rng.chance(0.25)) {
    damage = Math.floor(damage * 1.5);
    log.push({ text: `${enemy.emoji} ${enemy.name} utilise une attaque spéciale !`, emoji: '⚠️', type: 'enemy' });
  }

  // Apply defend reduction
  if (defendReduction > 0) {
    actualDamage = Math.max(1, Math.floor(damage * (1 - defendReduction)));
  } else {
    actualDamage = damage;
  }

  // Apply player DEF
  actualDamage = Math.max(1, actualDamage - stats.def);

  // Block chance
  if (rng.chance(stats.blockChance)) {
    actualDamage = 0;
    log.push({ text: `🛡️ Blocage ! Tu ne subis aucun dégât`, emoji: '🛡️', type: 'system' });
  }

  playerHp = Math.max(0, playerHp - actualDamage);

  if (actualDamage > 0) {
    log.push({
      text: `${enemy.emoji} ${enemy.name} inflige ${actualDamage} dégâts`,
      emoji: enemy.emoji,
      type: 'enemy',
    });
  }

  // Armure Épineuse — reflect damage
  if (actualDamage > 0 && stats.lifestealPct > 0) {
    // Note: lifesteal handled separately in executeCombatTurn
  }

  return { playerHp, damage: actualDamage, log };
}

/**
 * Execute a full combat turn: player action → enemy response.
 * Returns the complete result after both sides act.
 */
export function executeCombatTurn(
  action: CombatAction,
  stats: PlayerStats,
  enemy: EnemyState,
  playerHp: number,
  energy: number,
  className: string,
  rng: RNG
): { result: CombatResult; newEnergy: number } {
  const log: CombatLogEntry[] = [];
  let currentHp = playerHp;
  let currentEnemy = { ...enemy };
  let currentEnergy = energy;
  let fled = false;
  let defendReduction = 0;

  // --- PLAYER PHASE ---
  switch (action) {
    case 'attack': {
      const attackCount = stats.doubleAttack ? 2 : 1;
      for (let i = 0; i < attackCount && currentEnemy.hp > 0; i++) {
        const atkResult = playerAttack(stats, currentEnemy, rng);
        currentEnemy = atkResult.enemy;
        const label = atkResult.killed ? 'mortel' : '';
        if (atkResult.isCrit) {
          log.push({
            text: `⚔️ CRITIQUE ! ${atkResult.damage} dégâts ${label} sur ${currentEnemy.name}`,
            emoji: '⚔️',
            type: 'crit',
          });
        } else {
          log.push({
            text: `⚔️ Tu frappes pour ${atkResult.damage} dégâts ${label}`,
            emoji: '⚔️',
            type: 'player',
          });
        }
        if (atkResult.stunned) {
          log.push({ text: `💫 ${currentEnemy.name} est étourdi !`, emoji: '💫', type: 'stun' });
        }
      }

      // Lifesteal
      if (stats.lifestealPct > 0 && currentEnemy.hp > 0) {
        const lastDmg = stats.atk;
        const heal = Math.floor(lastDmg * stats.lifestealPct);
        currentHp = Math.min(stats.maxHp, currentHp + heal);
        log.push({ text: `🦇 Vol de vie : +${heal} HP`, emoji: '🦇', type: 'heal' });
      }

      // Berserk (low HP = more damage — already handled in stats if berserkLowHp)
      break;
    }

    case 'defend': {
      const d = playerDefend();
      defendReduction = d.damageReduction;
      currentHp = Math.min(stats.maxHp, currentHp + d.heal);
      log.push({
        text: `🛡️ Tu défends (+${d.heal} HP, -50% dégâts reçus)`,
        emoji: '🛡️',
        type: 'system',
      });
      break;
    }

    case 'special': {
      if (currentEnergy < 2) {
        log.push({ text: `❌ Pas assez d'énergie pour le spécial`, emoji: '❌', type: 'system' });
        break;
      }
      const sp = playerSpecial(className, stats, currentEnemy, rng, currentEnergy);
      currentEnemy = sp.enemy;
      currentHp = Math.min(stats.maxHp, currentHp + sp.playerHpChange);
      currentEnergy -= sp.energyCost;
      log.push(...sp.log);
      break;
    }

    case 'flee': {
      if (stats.cantFlee) {
        log.push({ text: `⛓️ Tu ne peux pas fuir (Armure Maudite)`, emoji: '⛓️', type: 'system' });
      } else {
        const fleeChance = 0.3 + (stats.luckBonus ?? 0);
        if (rng.chance(fleeChance)) {
          fled = true;
          log.push({ text: `🏃 Tu pars en courant ! Combat échappé`, emoji: '🏃', type: 'system' });
        } else {
          log.push({ text: `🏃 Fuite échouée ! L'ennemi frappe gratuitement`, emoji: '💢', type: 'system' });
        }
      }
      break;
    }
  }

  // --- CHECK VICTORY ---
  if (currentEnemy.hp <= 0) {
    log.push({ text: `☠️ ${currentEnemy.name} est vaincu !`, emoji: '☠️', type: 'system' });
    return {
      result: {
        log,
        playerHp: currentHp,
        enemy: currentEnemy,
        over: true,
        victory: true,
        fled: false,
        dead: false,
      },
      newEnergy: currentEnergy,
    };
  }

  // --- ENEMY PHASE (skip if fled or enemy dead) ---
  if (!fled) {
    const eResult = enemyTurn(currentEnemy, stats, currentHp, rng, defendReduction);
    currentHp = eResult.playerHp;
    log.push(...eResult.log);
  }

  // --- CHECK DEATH ---
  if (currentHp <= 0) {
    // Berserk check
    if (stats.berserkLowHp && currentEnemy.hp > 0) {
      log.push({ text: `🤬 BERSERK ! Tu refuses de mourir ! +1 HP de survie`, emoji: '🤬', type: 'system' });
      currentHp = 1;
    } else {
      log.push({ text: `💀 Tu es mort...`, emoji: '💀', type: 'system' });
      return {
        result: {
          log,
          playerHp: 0,
          enemy: currentEnemy,
          over: true,
          victory: false,
          fled: false,
          dead: true,
        },
        newEnergy: currentEnergy,
      };
    }
  }

  // --- REGEN ---
  if (stats.regenPerTurn && stats.regenPerTurn > 0) {
    currentHp = Math.min(stats.maxHp, currentHp + stats.regenPerTurn);
    log.push({ text: `💚 Régénération : +${stats.regenPerTurn} HP`, emoji: '💚', type: 'heal' });
  }

  return {
    result: {
      log,
      playerHp: currentHp,
      enemy: currentEnemy,
      over: false,
      victory: false,
      fled,
      dead: false,
    },
    newEnergy: currentEnergy,
  };
}
