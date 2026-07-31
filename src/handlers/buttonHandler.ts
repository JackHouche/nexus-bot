/**
 * Button Interaction Handler
 * Centralizes all button-based interactions for NEXUS roguelite.
 *
 * Button ID format: nexus:{category}:{action}:{data}
 */

import {
  type ButtonInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from 'discord.js';
import { prisma } from '../database.js';
import { logger } from '../logger.js';
import { redis } from '../redis.js';
import {
  loadRun,
  nextFloor,
  quitRun,
  deathRun,
  getPerkChoices,
  pickPerk,
  type RunState,
} from '../roguelite/engine.js';
import { computeStats, getPerk, type Perk, type PlayerStats } from '../roguelite/perks.js';
import { getClass } from '../roguelite/classes.js';
import {
  createEnemy,
  executeCombatTurn,
} from '../roguelite/combat.js';
import { resolveGamble, getGambleName, type GambleVariant } from '../roguelite/gamble.js';
import { generatePuzzle, validateAnswer, getPuzzleResult } from '../roguelite/puzzles.js';
import { detectSynergies, previewSynergies } from '../roguelite/synergies.js';
import { RNG } from '../roguelite/rng.js';
import { getItem } from '../roguelite/items.js';
import { COLORS, hpBar, chunkButtons } from './uiHelpers.js';

// ============================================================
//  COMBAT
// ============================================================
async function handleCombatButton(interaction: ButtonInteraction, action: string) {
  const userId = interaction.user.id;
  const run = await prisma.run.findFirst({ where: { userId, status: 'ACTIVE' } });
  if (!run) return interaction.reply({ content: '❌ Aucune descente active.', ephemeral: true });

  const state = await loadRun(userId);
  if (!state || !state.currentFloorEvent?.enemy) {
    return interaction.reply({ content: '❌ Pas de combat en cours.', ephemeral: true });
  }

  const classDef = getClass(state.className as 'warrior' | 'mage' | 'gambler' | 'rogue');
  const stats = computeStats(classDef.hp, classDef.atk, classDef.def, state.perks);
  let enemy = createEnemy(state.currentFloorEvent.enemy);

  // Load combat state from Redis
  const combatKey = `combat:${run.id}`;
  const combatDataStr = await redis.get(combatKey);
  if (combatDataStr) {
    const cd = JSON.parse(combatDataStr);
    enemy.hp = cd.enemyHp;
    enemy.maxHp = cd.enemyMaxHp;
  }

  const rng = new RNG(run.seed + run.currentFloor * 7919);
  const { result, newEnergy } = executeCombatTurn(
    action as 'attack' | 'defend' | 'special' | 'flee',
    stats,
    enemy,
    state.hp,
    state.energy,
    state.className,
    rng
  );

  const logText = result.log.map((l) => `${l.emoji} ${l.text}`).join('\n');

  // --- COMBAT OVER ---
  if (result.over) {
    await redis.del(combatKey);

    if (result.dead) {
      await deathRun(userId);
      const embed = new EmbedBuilder()
        .setTitle('💀 TU ES MORT')
        .setColor(COLORS.death)
        .setDescription(
          `${logText}\n\n**Ton aventure s'achève à l'étage ${state.currentFloor}.**\n` +
          `Tu récupères 1 👻 Soul et ${state.currentFloor} XP.`
        )
        .setFooter({ text: 'La mort n\'est pas la fin. /descent pour recommencer.' });
      return interaction.update({ embeds: [embed], components: [] });
    }

    // Victory or fled
    await prisma.run.update({ where: { id: run.id }, data: { hp: result.playerHp, energy: newEnergy } });

    if (result.victory) {
      await prisma.user.update({ where: { id: userId }, data: { totalKills: { increment: 1 } } });
      if (enemy.isBoss) {
        await prisma.user.update({ where: { id: userId }, data: { totalBossKills: { increment: 1 } } });
      }
    }

    const intro = result.victory
      ? `${logText}\n\n⚔️ **Victoire !**`
      : `${logText}\n\n🏃 Tu as fui, mais tu peux toujours choisir un perk.`;

    const perkCount = state.perks.some((p) => p.id === 'explorer') ? 4 : 3;
    const perks = await getPerkChoices(userId, perkCount);
    return showPerkSelection(interaction, state, result.playerHp, perks, intro);
  }

  // --- COMBAT CONTINUES ---
  await redis.set(combatKey, JSON.stringify({
    enemyHp: result.enemy.hp, enemyMaxHp: enemy.maxHp, playerHp: result.playerHp, energy: newEnergy
  }), 'EX', 300);

  await prisma.run.update({ where: { id: run.id }, data: { hp: result.playerHp, energy: newEnergy } });

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ COMBAT — Étage ${state.currentFloor}`)
    .setColor(enemy.isBoss ? COLORS.boss : COLORS.combat)
    .addFields(
      { name: `${result.enemy.emoji} ${result.enemy.name}`, value: hpBar(result.enemy.hp, result.enemy.maxHp), inline: false },
      { name: 'ATK', value: `${result.enemy.atk}`, inline: true },
      { name: 'DEF', value: `${result.enemy.def}`, inline: true },
      { name: '\u200B', value: '\u200B', inline: false },
      { name: `${classDef.emoji} ${classDef.name}`, value: hpBar(result.playerHp, stats.maxHp), inline: false },
      { name: '⚔️ ATK', value: `${stats.atk}`, inline: true },
      { name: '⚡ Énergie', value: `${newEnergy}/${state.maxEnergy}`, inline: true },
      { name: '📝 Log', value: logText.slice(-1024), inline: false },
    )
    .setFooter({ text: 'Choisis ton action' });

  const buttons = buildCombatButtons(newEnergy, stats.cantFlee);
  return interaction.update({ embeds: [embed], components: buttons });
}

function buildCombatButtons(energy: number, cantFlee: boolean): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('nexus:combat:attack').setLabel('⚔️ Attaquer').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('nexus:combat:defend').setLabel('🛡️ Défendre').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('nexus:combat:special').setLabel('💥 Spécial').setStyle(ButtonStyle.Primary).setDisabled(energy < 2),
    new ButtonBuilder().setCustomId('nexus:combat:flee').setLabel('🏃 Fuir').setStyle(ButtonStyle.Success).setDisabled(cantFlee),
  );
  return [row];
}

// ============================================================
//  PERK SELECTION
// ============================================================
async function showPerkSelection(
  interaction: ButtonInteraction,
  state: RunState,
  newPlayerHp: number,
  perks: Perk[],
  introText: string
) {
  const embed = new EmbedBuilder()
    .setTitle('🎁 Choisis ton perk')
    .setColor(COLORS.perk)
    .setDescription(
      `${introText}\n\n**Tu as ${perks.length} choix. Pick one.**\n` +
      '_Les synergies se déclenchent automatiquement._'
    );

  const buttons: ButtonBuilder[] = perks.map((p) => {
    const syn = previewSynergies(state.activePerkIds, p.id);
    const label = syn.length > 0 ? `${p.emoji} ${p.name} ⚡` : `${p.emoji} ${p.name}`;
    return new ButtonBuilder()
      .setCustomId(`nexus:perk:pick:${p.id}`)
      .setLabel(label.slice(0, 80))
      .setStyle(syn.length > 0 ? ButtonStyle.Success : ButtonStyle.Secondary);
  });

  for (const p of perks) {
    const syn = previewSynergies(state.activePerkIds, p.id);
    embed.addFields({
      name: `${p.emoji} ${p.name} [${p.rarity}]`,
      value: p.description + (syn.length > 0 ? `\n⚡ **SYNERGIE: ${syn[0].name}**` : ''),
      inline: false,
    });
  }

  embed.setFooter({ text: 'Clique pour choisir' });
  return interaction.update({ embeds: [embed], components: chunkButtons(buttons) });
}

async function handlePerkPick(interaction: ButtonInteraction, perkId: string) {
  const userId = interaction.user.id;

  try {
    const { state, newSynergy } = await pickPerk(userId, perkId);
    if (!state) throw new Error('Run non trouvée');

    const perk = getPerk(perkId);
    let description = `Tu as choisi **${perk?.emoji} ${perk?.name}** !\n${perk?.description}\n\n`;

    if (newSynergy) {
      const allSyns = detectSynergies(state.activePerkIds);
      description += `⚡ **SYNERGIE DÉCOUVERTE !**\n`;
      for (const s of allSyns) {
        description += `**${s.emoji} ${s.name}** — ${s.bonus}\n`;
      }
      description += '\n';
    }

    description += `Maintenant, choisis : continuer ou partir avec le pacte.`;

    const embed = new EmbedBuilder()
      .setTitle(`✅ Perk acquis — Étage ${state.currentFloor} complété`)
      .setColor(COLORS.victory)
      .setDescription(description)
      .addFields(
        { name: '📦 Pacte', value: `${state.pactAmount.toString()} ¢`, inline: true },
        { name: '❤️ HP', value: `${state.hp}/${state.maxHp}`, inline: true },
        { name: '🎮 Perks', value: `${state.perks.length}`, inline: true },
      )
      .setFooter({ text: 'Le prochain étage pourrait tout doubler... ou te tuer.' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('nexus:floor:next').setLabel('🔴 Descendre').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('nexus:floor:quit').setLabel('🟢 Quitter (+pacte)').setStyle(ButtonStyle.Success),
    );

    return interaction.update({ embeds: [embed], components: [row] });
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Perk pick error');
    return interaction.reply({ content: `❌ ${(err as Error).message}`, ephemeral: true });
  }
}

// ============================================================
//  GAMBLE
// ============================================================
async function handleGamblePlay(interaction: ButtonInteraction, variant: string) {
  const userId = interaction.user.id;
  const state = await loadRun(userId);
  if (!state) return interaction.reply({ content: '❌ Aucune descente active.', ephemeral: true });

  const classDef = getClass(state.className as 'warrior' | 'mage' | 'gambler' | 'rogue');
  const stats = computeStats(classDef.hp, classDef.atk, classDef.def, state.perks);
  const rng = new RNG(state.seed + state.currentFloor * 3571);
  const result = resolveGamble(variant as GambleVariant, rng, stats.luckBonus);

  const newHp = Math.max(0, Math.min(stats.maxHp, state.hp + result.hpChange));
  await prisma.run.update({
    where: { id: state.runId },
    data: { hp: newHp, coinsInRun: { increment: result.coinsChange } },
  });

  let description = result.description;

  if (result.perkGranted) {
    const perks = await getPerkChoices(userId, 1);
    if (perks.length > 0) {
      description += `\n\n🎁 Tu gagnes un perk bonus !`;
      return showPerkSelection(interaction, state, newHp, perks, description);
    }
  }

  if (newHp <= 0) {
    await deathRun(userId);
    const embed = new EmbedBuilder()
      .setTitle('💀 TU ES MORT')
      .setColor(COLORS.death)
      .setDescription(`${description}\n\nLe gamble t'a coûté la vie à l'étage ${state.currentFloor}.`)
      .setFooter({ text: '/descent pour recommencer' });
    return interaction.update({ embeds: [embed], components: [] });
  }

  const perkCount = state.perks.some((p) => p.id === 'explorer') ? 4 : 3;
  const perkChoices = await getPerkChoices(userId, perkCount);
  return showPerkSelection(interaction, state, newHp, perkChoices, description);
}

// ============================================================
//  SHOP
// ============================================================
async function handleShopBuy(interaction: ButtonInteraction, itemId: string) {
  const userId = interaction.user.id;
  const run = await prisma.run.findFirst({ where: { userId, status: 'ACTIVE' } });
  if (!run) return interaction.reply({ content: '❌ Aucune descente active.', ephemeral: true });

  const item = getItem(itemId);
  if (!item) return interaction.reply({ content: '❌ Item invalide.', ephemeral: true });
  if (run.coinsInRun < item.price) {
    return interaction.reply({ content: `❌ Pas assez de coins (${run.coinsInRun}/${item.price} ¢)`, ephemeral: true });
  }

  let description = `Tu achètes ${item.emoji} **${item.name}** !\n`;
  const updateData: Record<string, unknown> = { coinsInRun: { decrement: item.price } };

  switch (item.effect.type) {
    case 'heal':
      updateData.hp = Math.min(run.maxHp, run.hp + item.effect.value);
      description += `+${item.effect.value} HP restaurés.`;
      break;
    case 'atk_buff':
      updateData.atk = run.atk + item.effect.value;
      description += `+${item.effect.value} ATK permanent pour ce run.`;
      break;
    case 'def_buff':
      updateData.def = run.def + item.effect.value;
      description += `+${item.effect.value} DEF permanent pour ce run.`;
      break;
    case 'energy_restore':
      updateData.energy = run.maxEnergy;
      description += `Énergie restaurée au maximum.`;
      break;
    default:
      description += `Effet mystère.`;
  }

  await prisma.run.update({ where: { id: run.id }, data: updateData });

  const embed = new EmbedBuilder()
    .setTitle('🏪 Achat effectué')
    .setColor(COLORS.shop)
    .setDescription(description);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('nexus:floor:next').setLabel('➡️ Continuer').setStyle(ButtonStyle.Primary),
  );

  return interaction.update({ embeds: [embed], components: [row] });
}

// ============================================================
//  DILEMMA
// ============================================================
async function handleDilemmaChoose(interaction: ButtonInteraction, choiceId: string) {
  const userId = interaction.user.id;
  const state = await loadRun(userId);
  if (!state) return interaction.reply({ content: '❌ Aucune descente active.', ephemeral: true });

  const options = state.currentFloorEvent?.dilemmaOptions;
  if (!options) return interaction.reply({ content: '❌ Pas de dilemme actif.', ephemeral: true });

  const chosen = options.find((o) => o.id === choiceId);
  if (!chosen) return interaction.reply({ content: '❌ Choix invalide.', ephemeral: true });

  let hpChange = 0;
  let coinsChange = 0;
  let description = `Tu choisis : **${chosen.label}**\n${chosen.description}\n\n`;

  switch (choiceId) {
    case 'help':
      hpChange = -Math.floor(state.maxHp * 0.1);
      description += `Tu perds ${Math.abs(hpChange)} HP mais gagnes un perk !`;
      break;
    case 'ignore':
      description += `Tu passes ton chemin.`;
      break;
    case 'rob':
      coinsChange = 500;
      description += `+500 ¢ ! Mais quelque chose de sombre te suit...`;
      break;
    case 'feed':
      coinsChange = -200;
      description += `-200 ¢. Tu passes sans combat.`;
      break;
    case 'risk':
      hpChange = -20;
      await prisma.run.update({ where: { id: state.runId }, data: { pactAmount: state.pactAmount * 2n } });
      description += `-20 HP mais pacte doublé !`;
      break;
    case 'safe':
      hpChange = 15;
      await prisma.run.update({ where: { id: state.runId }, data: { pactAmount: BigInt(Math.floor(Number(state.pactAmount) * 1.1)) } });
      description += `+15 HP, pacte x1.1.`;
      break;
    case 'skip':
    case 'fight':
    case 'charm':
      description += `Tu continues ton chemin.`;
      break;
  }

  const newHp = Math.max(0, Math.min(state.maxHp, state.hp + hpChange));
  await prisma.run.update({ where: { id: state.runId }, data: { hp: newHp, coinsInRun: { increment: coinsChange } } });

  if (choiceId === 'help') {
    const perks = await getPerkChoices(userId, 1);
    if (perks.length > 0) return showPerkSelection(interaction, state, newHp, perks, description);
  }

  const perkCount = state.perks.some((p) => p.id === 'explorer') ? 4 : 3;
  const perkChoices = await getPerkChoices(userId, perkCount);
  return showPerkSelection(interaction, state, newHp, perkChoices, description);
}

// ============================================================
//  PUZZLE
// ============================================================
async function handlePuzzleGen(interaction: ButtonInteraction) {
  const userId = interaction.user.id;
  const state = await loadRun(userId);
  if (!state) return interaction.reply({ content: '❌ Aucune descente active.', ephemeral: true });

  const rng = new RNG(state.seed + state.currentFloor * 13);
  const puzzle = generatePuzzle(rng);

  await redis.set(`puzzle:${state.runId}`, JSON.stringify({
    answers: puzzle.answers, rewardHp: puzzle.rewardHp, penaltyHp: puzzle.penaltyHp,
  }), 'EX', 120);

  let description = `**${puzzle.variant.toUpperCase()}**\n\n${puzzle.prompt}\n\n`;
  if (puzzle.displayData) description += `Séquence : ${puzzle.displayData.join(' ')}\n`;
  description += `\n⏱️ **${puzzle.timeLimit}s** | ✅ +${puzzle.rewardHp} HP | ❌ ${puzzle.penaltyHp} HP`;
  if (puzzle.hint) description += `\n💡 ${puzzle.hint}`;

  const embed = new EmbedBuilder()
    .setTitle(`🧩 ÉNIGME — Étage ${state.currentFloor}`)
    .setColor(COLORS.puzzle)
    .setDescription(description)
    .setFooter({ text: 'Tape ta réponse dans le chat avec le préfixe "r:" (ex: r: 13)' });

  return interaction.update({ embeds: [embed], components: [] });
}

async function handlePuzzleSkip(interaction: ButtonInteraction) {
  const userId = interaction.user.id;
  const state = await loadRun(userId);
  if (!state) return interaction.reply({ content: '❌ Aucune descente active.', ephemeral: true });

  const newHp = Math.max(0, state.hp - 10);
  await prisma.run.update({ where: { id: state.runId }, data: { hp: newHp } });

  const perks = await getPerkChoices(userId, 3);
  return showPerkSelection(interaction, state, newHp, perks, `Tu passes l'énigme. -10 HP.`);
}

/**
 * Handle text-based puzzle answer (called from index.ts message handler).
 */
export async function handlePuzzleTextAnswer(userId: string, answer: string): Promise<{ correct: boolean; hpChange: number; message: string } | null> {
  const run = await prisma.run.findFirst({ where: { userId, status: 'ACTIVE' } });
  if (!run) return null;

  const puzzleDataStr = await redis.get(`puzzle:${run.id}`);
  if (!puzzleDataStr) return null;

  const puzzleData = JSON.parse(puzzleDataStr) as { answers: string[]; rewardHp: number; penaltyHp: number };
  const correct = puzzleData.answers.some(
    (a) => a.trim().toLowerCase().replace(/\s+/g, '') === answer.trim().toLowerCase().replace(/\s+/g, '')
  );

  await redis.del(`puzzle:${run.id}`);

  const hpChange = correct ? puzzleData.rewardHp : puzzleData.penaltyHp;
  const newHp = Math.max(0, run.hp + hpChange);
  await prisma.run.update({ where: { id: run.id }, data: { hp: newHp } });

  return {
    correct,
    hpChange,
    message: correct ? `✅ Correct ! +${puzzleData.rewardHp} HP` : `❌ Faux ! La réponse était: ${puzzleData.answers[0]}. ${puzzleData.penaltyHp} HP`,
  };
}

// ============================================================
//  FLOOR NEXT / QUIT
// ============================================================
async function handleFloorNext(interaction: ButtonInteraction) {
  try {
    const state = await nextFloor(interaction.user.id);
    // After nextFloor, show the new floor via the /next logic.
    // We reuse the same rendering as the slash command by delegating to a shared renderer.
    const { renderFloorEmbed } = await import('./floorRenderer.js');
    const { embeds, components } = await renderFloorEmbed(state);
    return interaction.update({ embeds, components });
  } catch (err) {
    return interaction.reply({ content: `❌ ${(err as Error).message}`, ephemeral: true });
  }
}

async function handleFloorQuit(interaction: ButtonInteraction) {
  try {
    const result = await quitRun(interaction.user.id);
    const embed = new EmbedBuilder()
      .setTitle('🟢 Pacte Sécurisé !')
      .setColor(COLORS.victory)
      .setDescription(
        `Tu quittes la descente à l'**étage ${result.floor}**.\n\n` +
        `💰 **+${result.coinsEarned.toString()} ¢**\n` +
        `⭐ **+${result.xpEarned} XP**`
      )
      .setFooter({ text: '/descent pour une nouvelle run' });
    return interaction.update({ embeds: [embed], components: [] });
  } catch (err) {
    return interaction.reply({ content: `❌ ${(err as Error).message}`, ephemeral: true });
  }
}

// ============================================================
//  MAIN ROUTER
// ============================================================
export async function handleNexusButton(interaction: ButtonInteraction) {
  const customId = interaction.customId;
  if (!customId.startsWith('nexus:')) return;

  const parts = customId.split(':');
  const category = parts[1] ?? '';
  const action = parts[2] ?? '';
  const data = parts.slice(3).join(':');

  try {
    switch (category) {
      case 'combat':
        return await handleCombatButton(interaction, action);
      case 'perk':
        if (action === 'pick') return await handlePerkPick(interaction, data);
        break;
      case 'gamble':
        if (action === 'play') return await handleGamblePlay(interaction, data);
        break;
      case 'shop':
        if (action === 'buy') return await handleShopBuy(interaction, data);
        break;
      case 'dilemma':
        if (action === 'choose') return await handleDilemmaChoose(interaction, data);
        break;
      case 'puzzle':
        if (action === 'gen') return await handlePuzzleGen(interaction);
        if (action === 'skip') return await handlePuzzleSkip(interaction);
        break;
      case 'floor':
        if (action === 'next') return await handleFloorNext(interaction);
        if (action === 'quit') return await handleFloorQuit(interaction);
        break;
    }

    logger.warn({ customId }, 'Unknown button interaction');
    return interaction.reply({ content: '❌ Interaction inconnue.', ephemeral: true });
  } catch (err) {
    logger.error({ customId, err: (err as Error).message }, 'Button handler error');
    if (interaction.replied || interaction.deferred) {
      return interaction.followUp({ content: `❌ ${(err as Error).message}`, ephemeral: true });
    }
    return interaction.reply({ content: `❌ ${(err as Error).message}`, ephemeral: true });
  }
}
