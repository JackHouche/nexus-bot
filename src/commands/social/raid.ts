import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { getDailyRaid, getRaidLeaderboard } from '../../social/raids.js';

export default {
  data: new SlashCommandBuilder()
    .setName('raid')
    .setDescription('🐉 Boss mondial — coopération de tout le serveur') as SlashCommandBuilder,

  async execute(interaction) {
    const raid = await getDailyRaid();

    if (!raid) {
      return interaction.reply({
        content: '🐉 Aucun raid actif aujourd\'hui. Le boss a peut-être déjà été vaincu — revenez demain !',
        ephemeral: true,
      });
    }

    const hpPct = Math.round((Number(raid.hp) / Number(raid.maxHp)) * 100);
    const filled = Math.round(hpPct / 10);
    const hpBar = `${'█'.repeat(filled)}${'░'.repeat(10 - filled)}`;

    const timeLeftMs = raid.expiresAt.getTime() - Date.now();
    const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
    const minsLeft = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));

    const embed = new EmbedBuilder()
      .setTitle(`${raid.emoji} RAID MONDIAL — ${raid.name}`)
      .setColor(0x8b0000)
      .setDescription(`Un boss mondial menace le serveur ! Tous les joueurs peuvent contribuer.`)
      .addFields(
        { name: '❤️ HP Global', value: `${hpBar} ${raid.hp.toString()}/${raid.maxHp.toString()}`, inline: false },
        { name: '⏰ Expire dans', value: `${hoursLeft}h ${minsLeft}min`, inline: true },
        { name: '💀 Statut', value: raid.defeated ? 'Vaincu ✅' : 'En combat ⚔️', inline: true },
      );

    // Get leaderboard
    const leaderboard = await getRaidLeaderboard(raid.id, 5);
    if (leaderboard.length > 0) {
      const medals = ['🥇', '🥈', '🥉'];
      const lines = leaderboard.map((c: typeof leaderboard[number], i: number) => {
        const medal = medals[i] ?? `${i + 1}.`;
        return `${medal} **${c.username}** — ${c.damage.toString()} dégâts (${c.runs} runs)`;
      }).join('\n');
      embed.addFields({ name: '🏆 Top Contributeurs', value: lines, inline: false });
    }

    embed.addFields({
      name: '💡 Comment participer',
      value: 'Chaque combat victorieux pendant une run inflige des dégâts au boss. Plus tu descends profond, plus tes dégâts sont élevés !',
      inline: false,
    });

    embed.setFooter({ text: 'Récompense pour tous si le boss est vaincu. Top 1 = titre exclusif.' });

    return interaction.reply({ embeds: [embed] });
  },
} as SlashCommand;
