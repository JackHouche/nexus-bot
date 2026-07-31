import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { PERKS } from '../../roguelite/perks.js';

const CATEGORY_NAMES: Record<string, string> = {
  offensive: '⚔️ Offensif',
  defensive: '🛡️ Défensif',
  utility: '🔧 Utilitaire',
  gamble: '🎲 Gamble',
  curse: '💀 Malédiction',
  relic: '🌟 Relique',
};

const CATEGORY_EMOJIS: Record<string, string> = {
  offensive: '⚔️',
  defensive: '🛡️',
  utility: '🔧',
  gamble: '🎲',
  curse: '💀',
  relic: '🌟',
};

export default {
  data: new SlashCommandBuilder()
    .setName('perks')
    .setDescription('📖 Encyclopédie des perks')
    .addStringOption((opt) =>
      opt
        .setName('catégorie')
        .setDescription('Filtrer par catégorie')
        .setRequired(false)
        .addChoices(
          { name: '⚔️ Offensif', value: 'offensive' },
          { name: '🛡️ Défensif', value: 'defensive' },
          { name: '🔧 Utilitaire', value: 'utility' },
          { name: '🎲 Gamble', value: 'gamble' },
          { name: '💀 Malédiction', value: 'curse' },
          { name: '🌟 Relique', value: 'relic' },
        )
    ) as SlashCommandBuilder,

  async execute(interaction) {
    const category = interaction.options.getString('catégorie');
    const allPerks = Object.values(PERKS);
    const filtered = category ? allPerks.filter((p) => p.category === category) : allPerks;

    // Group by category
    const grouped: Record<string, typeof allPerks> = {};
    for (const perk of filtered) {
      if (!grouped[perk.category]) grouped[perk.category] = [];
      grouped[perk.category].push(perk);
    }

    const embed = new EmbedBuilder()
      .setTitle(`📖 Encyclopédie des Perks (${filtered.length})`)
      .setColor(0x4361ee)
      .setDescription('Chaque perk est permanent pour la durée du run. Les synergies se déclenchent automatiquement quand tu combines certains perks.');

    for (const [cat, perks] of Object.entries(grouped)) {
      const lines = perks.map((p) => `${p.emoji} **${p.name}** [${p.rarity}] — ${p.description}`).join('\n');
      embed.addFields({
        name: `${CATEGORY_NAMES[cat] ?? cat} (${perks.length})`,
        value: lines.slice(0, 1024),
        inline: false,
      });
    }

    embed.setFooter({ text: '💡 Les perks ⚡ dans les choix indiquent une synergie potentielle' });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
} as SlashCommand;
