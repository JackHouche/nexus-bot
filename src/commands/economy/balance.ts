import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { getOrCreateUser } from '../../economy/user.js';

export default {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('💰 Affiche ton solde de monnaies') as SlashCommandBuilder,

  async execute(interaction) {
    const user = await getOrCreateUser(interaction.user.id, interaction.user.username);

    const embed = new EmbedBuilder()
      .setTitle(`💰 Portefeuille de ${interaction.user.username}`)
      .setColor(0xffb627)
      .addFields(
        { name: '🪙 Coins', value: `${user.coins.toString()} ¢`, inline: true },
        { name: '💎 Gems', value: `${user.gems}`, inline: true },
        { name: '👻 Souls', value: `${user.souls}`, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '📊 Niveau', value: `${user.level}`, inline: true },
        { name: '🏆 Record', value: `Étage ${user.deepestFloor}`, inline: true }
      )
      .setFooter({ text: 'Gagne des coins avec /descent, /daily et les duels' });

    return interaction.reply({ embeds: [embed] });
  },
} as SlashCommand;
