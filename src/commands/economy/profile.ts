import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { getOrCreateUser } from '../../economy/user.js';
import { getAllClasses, getClass } from '../../roguelite/classes.js';

export default {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('👤 Affiche ton profil de joueur')
    .addUserOption((opt) =>
      opt.setName('joueur').setDescription('Profil d\'un autre joueur').setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction) {
    const target = interaction.options.getUser('joueur') ?? interaction.user;
    const user = await getOrCreateUser(target.id, target.username);

    const unlocked = user.unlockedClasses as string[];
    const classesList = getAllClasses()
      .map((c) => `${unlocked.includes(c.id) ? '✅' : '🔒'} ${c.emoji} ${c.name}`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`👤 ${target.username}`)
      .setColor(0x2d1b4e)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: '📊 Niveau', value: `${user.level}`, inline: true },
        { name: '⭐ XP', value: `${user.xp}`, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '🪙 Coins', value: `${user.coins.toString()} ¢`, inline: true },
        { name: '💎 Gems', value: `${user.gems}`, inline: true },
        { name: '👻 Souls', value: `${user.souls}`, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '🏆 Record', value: `Étage ${user.deepestFloor}`, inline: true },
        { name: '🎮 Runs', value: `${user.totalRuns}`, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '⚔️ Classes', value: classesList, inline: false }
      )
      .setFooter({ text: 'NEXUS — Roguelite Discord' });

    return interaction.reply({ embeds: [embed] });
  },
} as SlashCommand;
