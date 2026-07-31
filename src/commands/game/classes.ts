import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { getAllClasses } from '../../roguelite/classes.js';

export default {
  data: new SlashCommandBuilder()
    .setName('classes')
    .setDescription('⚔️ Liste toutes les classes jouables et leurs stats') as SlashCommandBuilder,

  async execute(interaction) {
    const classes = getAllClasses();

    const embed = new EmbedBuilder()
      .setTitle('⚔️ Classes jouables')
      .setColor(0x2d1b4e)
      .setDescription('Choisis ta classe au début de chaque descente. Chaque classe a un style unique.');

    for (const c of classes) {
      embed.addFields({
        name: `${c.emoji} ${c.name}`,
        value: `${c.description}\n❤️ ${c.hp} HP | ⚔️ ${c.atk} ATK | 🛡️ ${c.def} DEF | ⚡ ${c.maxEnergy} Énergie\n**Spécial:** ${c.special.emoji} ${c.special.name} — ${c.special.description} (${c.special.energyCost}⚡)`,
        inline: false,
      });
    }

    embed.addFields({
      name: '🔒 Classes débloquables',
      value: '🛡️ Paladin (étage 10) | 🧪 Alchimiste (50 runs) | 💀 Necromancien (100 kills) | ☠️ Berserker (20 morts) | 🌟 Étoile (étage 20) | 👑 Roi (1000 kills)',
      inline: false,
    });

    embed.setFooter({ text: '/descent pour commencer une nouvelle descente' });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
} as SlashCommand;
