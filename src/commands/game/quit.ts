import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { quitRun } from '../../roguelite/engine.js';

export default {
  data: new SlashCommandBuilder()
    .setName('quit')
    .setDescription('🟢 Quitte la descente et sécurise ton pacte') as SlashCommandBuilder,

  async execute(interaction) {
    try {
      const result = await quitRun(interaction.user.id);

      const embed = new EmbedBuilder()
        .setTitle('🟢 Pacte Sécurisé !')
        .setColor(0x00d9a3)
        .setDescription(
          `Tu quittes la descente à l\'**étage ${result.floor}** avec tes gains intacts.\n\n` +
          `💰 **Coins gagnés:** +${result.coinsEarned.toString()} ¢\n` +
          `⭐ **XP gagnée:** +${result.xpEarned} XP\n\n` +
          `_La prudence est mère de vertu... mais l\'étage suivant était peut-être le jackpot._`
        )
        .setFooter({ text: 'NEXUS — Reviens avec /descent pour une nouvelle run' });

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      return interaction.reply({
        content: `❌ ${(err as Error).message}`,
        ephemeral: true,
      });
    }
  },
} as SlashCommand;
