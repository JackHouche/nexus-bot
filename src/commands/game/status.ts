import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { loadRun } from '../../roguelite/engine.js';
import { detectSynergies } from '../../roguelite/synergies.js';

export default {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('📊 Affiche l\'état de ta descente active') as SlashCommandBuilder,

  async execute(interaction) {
    try {
      const state = await loadRun(interaction.user.id);
      if (!state) {
        return interaction.reply({
          content: '❌ Tu n\'as pas de descente active. Tape `/descent` pour commencer !',
          ephemeral: true,
        });
      }

      const perkList = state.perks.length > 0
        ? state.perks.map((p) => `${p.emoji} ${p.name}`).join('\n')
        : '_Aucun perk encore_';

      const synergyList = state.synergies.length > 0
        ? state.synergies.map((s) => `${s.emoji} **${s.name}**`).join('\n')
        : '_Aucune synergie découverte_';

      const floorType = state.currentFloorEvent?.type?.toUpperCase() ?? 'INCONNU';

      const embed = new EmbedBuilder()
        .setTitle(`📊 Status — Étage ${state.currentFloor}`)
        .setColor(0x2d1b4e)
        .addFields(
          { name: '🎲 Classe', value: state.className, inline: true },
          { name: '📦 Pacte', value: `${state.pactAmount.toString()} ¢`, inline: true },
          { name: '\u200B', value: '\u200B', inline: true },
          { name: '❤️ HP', value: `${state.hp}/${state.maxHp}`, inline: true },
          { name: '⚔️ ATK', value: `${state.atk}`, inline: true },
          { name: '🛡️ DEF', value: `${state.def}`, inline: true },
          { name: '⚡ Énergie', value: `${state.energy}/${state.maxEnergy}`, inline: true },
          { name: '🎲 Seed', value: `\`${state.seed}\``, inline: true },
          { name: '\u200B', value: '\u200B', inline: true },
          { name: `🏠 Étage actuel: ${floorType}`, value: '\u200B', inline: false },
          { name: `✨ Perks (${state.perks.length})`, value: perkList, inline: true },
          { name: `🔥 Synergies (${state.synergies.length})`, value: synergyList, inline: true }
        )
        .setFooter({ text: '/next pour descendre • /quit pour sécuriser le pacte' });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      return interaction.reply({
        content: `❌ ${(err as Error).message}`,
        ephemeral: true,
      });
    }
  },
} as SlashCommand;
