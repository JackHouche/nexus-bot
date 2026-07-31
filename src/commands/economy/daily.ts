import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { claimDaily } from '../../economy/user.js';

export default {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('📅 Récupère ta récompense quotidienne — maintiens ta série !') as SlashCommandBuilder,

  async execute(interaction) {
    try {
      const result = await claimDaily(interaction.user.id, interaction.user.username);

      const nextRewardIndex = result.streak % 7; // next day's reward
      const nextRewards = [200, 250, 300, 400, 500, 700, 1000];
      const nextReward = nextRewards[nextRewardIndex];

      const embed = new EmbedBuilder()
        .setTitle(result.isJackpot ? '🎉 JACKPOT QUOTIDIEN !' : '📅 Récompense Quotidienne')
        .setColor(result.isJackpot ? 0xffb627 : 0x06d6a0)
        .setDescription(
          `**Série de ${result.streak} jour${result.streak > 1 ? 's' : ''} !** 🔥\n\n` +
          `🪙 **+${result.coins} ¢**\n` +
          (result.gems > 0 ? `💎 **+${result.gems} gems**\n` : '') +
          `\n_**Demain:** +${nextReward} ¢${nextRewardIndex === 6 ? ' + 5 💎 (JACKPOT!)' : ''}_\n` +
          `_Ne casse pas ta série !_`
        )
        .setFooter({ text: 'Reviens demain pour continuer ta série' });

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      return interaction.reply({
        content: `❌ ${(err as Error).message}`,
        ephemeral: true,
      });
    }
  },
} as SlashCommand;
