import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { startRun, type RunState } from '../../roguelite/engine.js';
import { getAllClasses, type ClassId } from '../../roguelite/classes.js';
import { getOrCreateUser } from '../../economy/user.js';

// Class selection menu
function buildClassMenu() {
  const classes = getAllClasses();
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const buttons = classes.map((c) =>
    new ButtonBuilder()
      .setCustomId(`descent_class_${c.id}`)
      .setLabel(c.name)
      .setEmoji(c.emoji)
      .setStyle(ButtonStyle.Primary)
  );

  // 2 buttons per row
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 2)));
  }

  return rows;
}

export default {
  data: new SlashCommandBuilder()
    .setName('descent')
    .setDescription('🗡️ Commence une descente roguelite — risque tout pour la gloire')
    .addStringOption((opt) =>
      opt
        .setName('classe')
        .setDescription('Choisis ta classe')
        .setRequired(false)
        .addChoices(
          { name: '⚔️ Guerrier — Tanky, consistant', value: 'warrior' },
          { name: '🔮 Mage — Glass cannon', value: 'mage' },
          { name: '🎲 Gambler — Haute variance', value: 'gambler' },
          { name: '🗡️ Voleur — DPS critiques', value: 'rogue' }
        )
    ) as SlashCommandBuilder,

  async execute(interaction) {
    const userId = interaction.user.id;
    const username = interaction.user.username;
    const classChoice = interaction.options.getString('classe') as ClassId | null;

    await getOrCreateUser(userId, username);

    // If class is provided via option, start immediately
    if (classChoice) {
      try {
        const state = await startRun(userId, classChoice);
        return interaction.reply(buildStartEmbed(state));
      } catch (err) {
        return interaction.reply({
          content: `❌ ${(err as Error).message}`,
          ephemeral: true,
        });
      }
    }

    // Otherwise show class selection menu
    const embed = new EmbedBuilder()
      .setTitle('🗡️ NEXUS — La Descente')
      .setDescription(
        '**Bienvenue, aventurier.**\n\n' +
        'Tu vas descendre dans les profondeurs de NEXUS. À chaque étage, un défi unique t\'attend.\n' +
        'Plus tu descends, plus le **pacte** grimpe... mais si tu meurs, tu perds **tout**.\n\n' +
        '**Choisis ta classe :**'
      )
      .setColor(0x2d1b4e)
      .setFooter({ text: 'Quit now or risk it all.' });

    await interaction.reply({ embeds: [embed], components: buildClassMenu() });
  },
} as SlashCommand;

function buildStartEmbed(state: RunState) {
  const embed = new EmbedBuilder()
    .setTitle(`🗡️ Descente Commencée — Étage 1`)
    .setColor(0xe63946)
    .addFields(
      { name: 'Classe', value: state.className, inline: true },
      { name: '❤️ HP', value: `${state.hp}/${state.maxHp}`, inline: true },
      { name: '⚔️ ATK / 🛡️ DEF', value: `${state.atk} / ${state.def}`, inline: true },
      { name: '📦 Pacte', value: `${state.pactAmount.toString()} ¢`, inline: true },
      { name: '🎲 Seed', value: `\`${state.seed}\``, inline: true },
      { name: '\u200B', value: '\u200B', inline: true },
      {
        name: '🏠 Étage 1',
        value: `Type: **${state.currentFloorEvent?.type?.toUpperCase() ?? 'INCONNU'}**`,
        inline: false,
      }
    )
    .setFooter({ text: 'Utilise /next pour affronter l\'étage • /quit pour partir avec le pacte • /status pour voir ton état' });

  return { embeds: [embed], ephemeral: true };
}
