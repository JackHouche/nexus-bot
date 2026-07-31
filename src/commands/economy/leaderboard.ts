import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { prisma } from '../../database.js';

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('🏆 Affiche le classement')
    .addStringOption((opt) =>
      opt
        .setName('type')
        .setDescription('Type de classement')
        .setRequired(false)
        .addChoices(
          { name: '🏆 Profondeur max (record)', value: 'depth' },
          { name: '🪙 Coins totaux', value: 'coins' },
          { name: '🎮 Runs cette semaine', value: 'runs' },
          { name: '💀 Boss kills', value: 'bosses' }
        )
    ) as SlashCommandBuilder,

  async execute(interaction) {
    const type = interaction.options.getString('type') ?? 'depth';

    let orderBy: Record<string, 'desc'> = { deepestFloor: 'desc' };
    let title = '🏆 Classement — Profondeur Max';
    let valueLabel = 'Étage';
    let valueField = 'deepestFloor';

    switch (type) {
      case 'coins':
        orderBy = { coins: 'desc' };
        title = '🪙 Classement — Coins Totaux';
        valueLabel = 'Coins';
        valueField = 'coins';
        break;
      case 'runs':
        orderBy = { totalRuns: 'desc' };
        title = '🎮 Classement — Runs Totaux';
        valueLabel = 'Runs';
        valueField = 'totalRuns';
        break;
      case 'bosses':
        orderBy = { totalBossKills: 'desc' };
        title = '💀 Classement — Boss Kills';
        valueLabel = 'Kills';
        valueField = 'totalBossKills';
        break;
    }

    const top = await prisma.user.findMany({
      where: { totalRuns: { gt: 0 } },
      orderBy,
      take: 10,
    });

    if (top.length === 0) {
      return interaction.reply({
        content: 'Aucun joueur classé pour le moment. Sois le premier avec `/descent` !',
        ephemeral: true,
      });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = top.map((u: typeof top[number], i: number) => {
      const medal = medals[i] ?? `**${i + 1}.**`;
      const value = valueField === 'coins' ? u.coins.toString() : String(u[valueField as keyof typeof u]);
      return `${medal} **${u.username}** — ${value} ${valueLabel}`;
    });

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(0xffb627)
      .setDescription(lines.join('\n'))
      .setFooter({ text: 'NEXUS — Classement mondial' });

    return interaction.reply({ embeds: [embed] });
  },
} as SlashCommand;
