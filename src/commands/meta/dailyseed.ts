import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { getDailySeedLeaderboard } from '../../meta/liveops.js';

export default {
  data: new SlashCommandBuilder()
    .setName('dailyseed')
    .setDescription('📅 Le seed du jour — même grille pour tout le serveur') as SlashCommandBuilder,

  async execute(interaction) {
    const leaderboard = await getDailySeedLeaderboard();

    const embed = new EmbedBuilder()
      .setTitle('📅 SEED DU JOUR')
      .setColor(0x06d6a0)
      .setDescription('Chaque jour, un seed unique est généré pour TOUT le serveur. Tout le monde descend la même séquence. Qui ira le plus loin ?');

    if (leaderboard.length === 0) {
      embed.addFields({ name: 'Classement', value: 'Personne n\'a encore joué le seed du jour. Sois le premier avec `/descent` !', inline: false });
    } else {
      const medals = ['🥇', '🥈', '🥉'];
      const lines = leaderboard.slice(0, 10).map((e, i) => {
        const medal = medals[i] ?? `${i + 1}.`;
        return `${medal} **${e.username}** — Étage ${e.bestFloor} (${e.className})`;
      }).join('\n');
      embed.addFields({ name: `Classement (${leaderboard.length} participants)`, value: lines, inline: false });
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const timeLeft = tomorrow.getTime() - Date.now();
    const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));

    embed.setFooter({ text: `Nouveau seed dans ${hoursLeft}h | Top 3 = 500 💎` });

    return interaction.reply({ embeds: [embed] });
  },
} as SlashCommand;
