import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { canPrestige, doPrestige, getPrestige, PRESTIGE_REWARDS } from '../../meta/prestige.js';
import { prisma } from '../../database.js';

export default {
  data: new SlashCommandBuilder()
    .setName('prestige')
    .setDescription('🌟 Système de prestige — reset pour des bonus permanents')
    .addSubcommand((sub) => sub.setName('info').setDescription('Voir ton prestige actuel'))
    .addSubcommand((sub) => sub.setName('rewards').setDescription('Voir les récompenses de prestige'))
    .addSubcommand((sub) => sub.setName('ascend').setDescription('Prestiger (niveau 100 requis)')) as SlashCommandBuilder,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (sub === 'info') {
      const prestige = await getPrestige(userId);
      const user = await prisma.user.findUnique({ where: { id: userId } });

      const embed = new EmbedBuilder()
        .setTitle('🌟 Prestige')
        .setColor(0x9b59b6)
        .setDescription(
          `**Prestige actuel:** ${prestige.level}/20\n` +
          `**Niveau:** ${user?.level ?? '?'}/100\n` +
          `**Bonus XP:** +${prestige.bonusXp}%\n` +
          `**Bonus Coins:** +${prestige.bonusCoins}%\n\n` +
          (prestige.level === 0 ? '_Atteins le niveau 100 pour ton premier prestige._' : '_Utilise /prestige rewards pour voir les récompenses._')
        );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'rewards') {
      const embed = new EmbedBuilder()
        .setTitle('🌟 Récompenses de Prestige')
        .setColor(0x9b59b6)
        .setDescription('Chaque prestige augmente tes bonus permanents et débloque du contenu.');

      const lines = PRESTIGE_REWARDS.map((r) => {
        return `**P${r.prestige}** — +${r.bonusXpPct}% XP/Coins | 🔓 ${r.unlocks}${r.title ? ` | Titre: "${r.title}"` : ''}`;
      }).join('\n\n');

      embed.addFields({ name: 'Paliers', value: lines.slice(0, 1024), inline: false });
      embed.setFooter({ text: 'Le prestige ne reset JAMAIS: coins, gear, achievements, mastery' });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'ascend') {
      const check = await canPrestige(userId);
      if (!check.canPrestige) {
        return interaction.reply({ content: `❌ ${check.reason}`, ephemeral: true });
      }

      const result = await doPrestige(userId);
      const embed = new EmbedBuilder()
        .setTitle('🌟 PRESTIGE ATTEINT !')
        .setColor(0x9b59b6)
        .setDescription(
          `Tu as atteint le **Prestige ${result.newPrestige}** !\n\n` +
          `**Nouveaux bonus:**\n` +
          `⭐ +${result.bonusXp}% XP permanent\n` +
          `💰 +${result.bonusCoins}% Coins permanent\n\n` +
          `**Déblocage:** ${result.unlocked}\n\n` +
          `_Ton niveau et tes talents sont reset. Tes coins, gear et achievements sont intacts._`
        )
        .setFooter({ text: 'Nouvelle carrière, même légende.' });

      return interaction.reply({ embeds: [embed] });
    }
  },
} as SlashCommand;
