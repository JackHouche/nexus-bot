import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { loadRun } from '../../roguelite/engine.js';
import { renderFloorEmbed } from '../../handlers/floorRenderer.js';

export default {
  data: new SlashCommandBuilder()
    .setName('next')
    .setDescription('🏠 Affiche l\'étage actuel de ta descente avec les boutons interactifs') as SlashCommandBuilder,

  async execute(interaction) {
    const userId = interaction.user.id;

    try {
      const state = await loadRun(userId);
      if (!state) {
        return interaction.reply({
          content: '❌ Tu n\'as pas de descente active. Tape `/descent` pour commencer !',
          ephemeral: true,
        });
      }

      const { embeds, components } = await renderFloorEmbed(state);
      return interaction.reply({ embeds, components, ephemeral: true });
    } catch (err) {
      return interaction.reply({
        content: `❌ ${(err as Error).message}`,
        ephemeral: true,
      });
    }
  },
} as SlashCommand;
