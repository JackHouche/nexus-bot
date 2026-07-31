import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { SYNERGIES } from '../../roguelite/synergies.js';

export default {
  data: new SlashCommandBuilder()
    .setName('synergies')
    .setDescription('⚡ Liste toutes les synergies découvrables') as SlashCommandBuilder,

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle(`⚡ Synergies (${SYNERGIES.length})`)
      .setColor(0x4361ee)
      .setDescription('Les synergies se déclenchent automatiquement quand tu possèdes tous les perks requis dans un run. Bonus exclusifs !');

    for (const syn of SYNERGIES) {
      embed.addFields({
        name: `${syn.emoji} ${syn.name}`,
        value: `${syn.description}\n**Bonus:** ${syn.bonus}`,
        inline: false,
      });
    }

    embed.setFooter({ text: 'Découvre-les toutes en experimentant avec différents builds !' });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
} as SlashCommand;
