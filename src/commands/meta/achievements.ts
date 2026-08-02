import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { prisma } from '../../database.js';
import { ACHIEVEMENTS, type AchievementCategory } from '../../meta/achievements.js';

const CATEGORY_NAMES: Record<AchievementCategory, string> = {
  combat: '⚔️ Combat',
  exploration: '🧭 Exploration',
  perks: '⚡ Perks & Synergies',
  gamble: '🎲 Gamble',
  economy: '💰 Économie',
  social: '🤝 Social',
  prestige: '🌟 Prestige',
  collection: '🗃️ Collection',
};

export default {
  data: new SlashCommandBuilder()
    .setName('achievements')
    .setDescription('🏆 Affiche tes achievements ou ceux d\'un autre joueur')
    .addUserOption((opt) => opt.setName('joueur').setDescription('Voir les achievements d\'un autre joueur').setRequired(false))
    .addStringOption((opt) =>
      opt.setName('catégorie').setDescription('Filtrer par catégorie').setRequired(false)
        .addChoices(
          { name: '⚔️ Combat', value: 'combat' },
          { name: '🧭 Exploration', value: 'exploration' },
          { name: '⚡ Perks', value: 'perks' },
          { name: '🎲 Gamble', value: 'gamble' },
          { name: '💰 Économie', value: 'economy' },
          { name: '🤝 Social', value: 'social' },
          { name: '🌟 Prestige', value: 'prestige' },
          { name: '🗃️ Collection', value: 'collection' },
        )
    ) as SlashCommandBuilder,

  async execute(interaction) {
    const target = interaction.options.getUser('joueur') ?? interaction.user;
    const categoryFilter = interaction.options.getString('catégorie') as AchievementCategory | null;

    // Get user achievements
    const userAchs = await prisma.userAchievement.findMany({ where: { userId: target.id } });
    const unlockedIds = new Set(userAchs.map((a: typeof userAchs[number]) => a.achievementId));

    let achievements = ACHIEVEMENTS;
    if (categoryFilter) {
      achievements = achievements.filter((a) => a.category === categoryFilter);
    }

    const total = achievements.length;
    const unlocked = achievements.filter((a: typeof achievements[number]) => unlockedIds.has(a.id)).length;
    const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;

    // Group by category
    const grouped: Record<string, typeof achievements> = {};
    for (const ach of achievements) {
      if (!grouped[ach.category]) grouped[ach.category] = [];
      grouped[ach.category].push(ach);
    }

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Achievements de ${target.username} — ${unlocked}/${total} (${pct}%)`)
      .setColor(0xffb627)
      .setThumbnail(target.displayAvatarURL())
      .setDescription(`Progression globale: ${unlocked}/${ACHIEVEMENTS.length} achievements au total`);

    for (const [cat, achs] of Object.entries(grouped)) {
      const catUnlocked = achs.filter((a) => unlockedIds.has(a.id)).length;
      const lines = achs.slice(0, 8).map((a) => {
        const done = unlockedIds.has(a.id);
        const reward = a.reward.gems ? `💎${a.reward.gems}` : a.reward.coins ? `🪙${a.reward.coins}` : '';
        return `${done ? '✅' : '🔒'} ${a.emoji} ${a.name} ${done ? `(${reward})` : ''}`;
      }).join('\n');
      const remaining = achs.length - 8;
      embed.addFields({
        name: `${CATEGORY_NAMES[cat as AchievementCategory] ?? cat} — ${catUnlocked}/${achs.length}`,
        value: lines + (remaining > 0 ? `\n*...et ${remaining} autres*` : ''),
        inline: false,
      });
    }

    embed.setFooter({ text: 'Débloque des achievements en jouant ! Certains sont cachés.' });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
} as SlashCommand;
