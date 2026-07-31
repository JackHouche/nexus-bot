/**
 * Floor Renderer — shared embed+components builder for floor events.
 * Used by both the /next slash command and the button handler.
 */

import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  type EmbedBuilder as EmbedType,
} from 'discord.js';
import type { RunState } from '../roguelite/engine.js';
import { getClass } from '../roguelite/classes.js';
import { computeStats } from '../roguelite/perks.js';
import { createEnemy } from '../roguelite/combat.js';
import { getGambleName, type GambleVariant } from '../roguelite/gamble.js';
import { COLORS, hpBar, chunkButtons } from './uiHelpers.js';
import { redis } from '../redis.js';

export interface FloorRender {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
}

export async function renderFloorEmbed(state: RunState): Promise<FloorRender> {
  const event = state.currentFloorEvent;
  if (!event) {
    return {
      embeds: [new EmbedBuilder().setTitle('❌ Étage invalide').setColor(COLORS.death)],
      components: [],
    };
  }

  const classDef = getClass(state.className as 'warrior' | 'mage' | 'gambler' | 'rogue');
  const stats = computeStats(classDef.hp, classDef.atk, classDef.def, state.perks);

  switch (event.type) {
    case 'combat':
    case 'boss':
      return await renderCombat(state, event, classDef, stats);

    case 'gamble':
      return renderGamble(state, event);

    case 'puzzle':
      return renderPuzzle(state);

    case 'dilemma':
      return renderDilemma(state, event);

    case 'shop':
      return renderShop(state, event);

    default:
      return {
        embeds: [new EmbedBuilder().setTitle('❌ Type inconnu').setColor(COLORS.death)],
        components: [],
      };
  }
}

async function renderCombat(
  state: RunState,
  event: NonNullable<RunState['currentFloorEvent']>,
  classDef: ReturnType<typeof getClass>,
  stats: ReturnType<typeof computeStats>
): Promise<FloorRender> {
  if (!event.enemy) throw new Error('No enemy for combat floor');
  const enemy = createEnemy(event.enemy);

  // Init combat state in Redis
  await redis.set(
    `combat:${state.runId}`,
    JSON.stringify({ enemyHp: enemy.hp, enemyMaxHp: enemy.maxHp, playerHp: state.hp, energy: state.energy }),
    'EX',
    300
  );

  const embed = new EmbedBuilder()
    .setTitle(event.type === 'boss' ? `💀 BOSS — Étage ${state.currentFloor}` : `⚔️ COMBAT — Étage ${state.currentFloor}`)
    .setColor(event.type === 'boss' ? COLORS.boss : COLORS.combat)
    .addFields(
      { name: `${enemy.emoji} ${enemy.name}${enemy.isBoss ? ' [BOSS]' : ''}`, value: hpBar(enemy.hp, enemy.maxHp), inline: false },
      { name: '⚔️ ATK', value: `${enemy.atk}`, inline: true },
      { name: '🛡️ DEF', value: `${enemy.def}`, inline: true },
      { name: '\u200B', value: '\u200B', inline: false },
      { name: `${classDef.emoji} ${classDef.name}`, value: hpBar(state.hp, stats.maxHp), inline: false },
      { name: '⚔️ ATK', value: `${stats.atk}`, inline: true },
      { name: '⚡ Énergie', value: `${state.energy}/${state.maxEnergy}`, inline: true },
    )
    .setFooter({ text: 'Choisis ton action' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('nexus:combat:attack').setLabel('⚔️ Attaquer').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('nexus:combat:defend').setLabel('🛡️ Défendre').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('nexus:combat:special').setLabel('💥 Spécial').setStyle(ButtonStyle.Primary).setDisabled(state.energy < 2),
    new ButtonBuilder().setCustomId('nexus:combat:flee').setLabel('🏃 Fuir').setStyle(ButtonStyle.Success).setDisabled(stats.cantFlee),
  );

  return { embeds: [embed], components: [row] };
}

function renderGamble(state: RunState, event: NonNullable<RunState['currentFloorEvent']>): FloorRender {
  const variant = (event.gambleVariant ?? 'double_or_nothing') as GambleVariant;
  const name = getGambleName(variant);
  const descMap: Record<string, string> = {
    double_or_nothing: 'Pile ou face. Gagne = pacte x1.5. Perd = -25 HP.',
    dice_duel: 'Tu lances 2d6 contre le croupier. Plus haut gagne.',
    wheel_of_pain: 'Roue 8 segments. 6 bons, 2 mauvais.',
    mystery_chest: '3 coffres : 1 perk, 1 piège, 1 vide.',
  };

  const embed = new EmbedBuilder()
    .setTitle(`🎰 GAMBLE — Étage ${state.currentFloor}`)
    .setColor(COLORS.gamble)
    .setDescription(`**${name}**\n\n${descMap[variant] ?? ''}`)
    .addFields(
      { name: '📦 Pacte', value: `${state.pactAmount.toString()} ¢`, inline: true },
      { name: '❤️ HP', value: `${state.hp}/${state.maxHp}`, inline: true },
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`nexus:gamble:play:${variant}`).setLabel('🎲 Jouer').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('nexus:floor:quit').setLabel('🟢 Quitter (+pacte)').setStyle(ButtonStyle.Success),
  );

  return { embeds: [embed], components: [row] };
}

function renderPuzzle(state: RunState): FloorRender {
  const embed = new EmbedBuilder()
    .setTitle(`🧩 ÉNIGME — Étage ${state.currentFloor}`)
    .setColor(COLORS.puzzle)
    .setDescription('Une énigme se dresse sur ton chemin ! Résous-la pour un bonus.')
    .addFields(
      { name: '📦 Pacte', value: `${state.pactAmount.toString()} ¢`, inline: true },
      { name: '❤️ HP', value: `${state.hp}/${state.maxHp}`, inline: true },
    )
    .setFooter({ text: 'Clique pour générer ton énigme' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('nexus:puzzle:gen').setLabel('🧩 Générer l\'énigme').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('nexus:puzzle:skip').setLabel('⏭️ Passer (-10 HP)').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

function renderDilemma(state: RunState, event: NonNullable<RunState['currentFloorEvent']>): FloorRender {
  const options = event.dilemmaOptions ?? [];
  const embed = new EmbedBuilder()
    .setTitle(`🎭 DILEMME — Étage ${state.currentFloor}`)
    .setColor(COLORS.dilemma)
    .setDescription('Une situation délicate. Que fais-tu ?');

  for (const opt of options) {
    embed.addFields({ name: `${opt.emoji} ${opt.label}`, value: opt.description, inline: false });
  }

  const buttons: ButtonBuilder[] = options.map((o) =>
    new ButtonBuilder()
      .setCustomId(`nexus:dilemma:choose:${o.id}`)
      .setLabel(`${o.emoji} ${o.label}`.slice(0, 80))
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: chunkButtons(buttons) };
}

function renderShop(state: RunState, event: NonNullable<RunState['currentFloorEvent']>): FloorRender {
  const items = event.shopItems ?? [];
  const embed = new EmbedBuilder()
    .setTitle(`🏪 BOUTIQUE — Étage ${state.currentFloor}`)
    .setColor(COLORS.shop)
    .setDescription('Un marchand apparaît. Que veux-tu acheter ?')
    .addFields(
      { name: '🪙 Coins en run', value: `${state.coinsInRun} ¢`, inline: true },
      { name: '❤️ HP', value: `${state.hp}/${state.maxHp}`, inline: true },
    );

  for (const item of items) {
    embed.addFields({ name: `${item.emoji} ${item.name} — ${item.price} ¢`, value: item.description, inline: false });
  }

  const buttons: ButtonBuilder[] = items.map((item) =>
    new ButtonBuilder()
      .setCustomId(`nexus:shop:buy:${item.id}`)
      .setLabel(`${item.emoji} ${item.name} (${item.price}¢)`.slice(0, 80))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(state.coinsInRun < item.price)
  );
  buttons.push(
    new ButtonBuilder().setCustomId('nexus:floor:next').setLabel('➡️ Continuer').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: chunkButtons(buttons) };
}
