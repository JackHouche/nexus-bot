/**
 * NEXUS — /modpanel
 * Moderation panel (Modérateur role or Admin permissions required).
 * Subcommands: warn, mute, unmute, kick, ban, warnings, clearwarnings
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type GuildMember,
  type User,
} from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { logger } from '../../logger.js';
import { warnUser, getWarnings, checkAutoAction, clearWarnings } from '../../mod/warnings.js';

// ============================================================
//  HELPERS
// ============================================================

const MOD_ROLE_NAME = '🛡️ Modérateur';

/** Check that the caller is a Modérateur OR has Admin/Mod permissions. */
function isAuthorized(interaction: ChatInputCommandInteraction): boolean {
  const member = interaction.member as GuildMember | null;
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions.has(PermissionFlagsBits.KickMembers)) return true;
  if (member.permissions.has(PermissionFlagsBits.ModerateMembers)) return true;
  return member.roles.cache.some((r) => r.name === MOD_ROLE_NAME);
}

/** Build a confirmation embed. */
function confirmEmbed(title: string, description: string, color = 0x4ECDC4): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(description)
    .setTimestamp();
}

/** Parse a duration string like "10m", "2h", "1d" → minutes. Defaults to 60 min. */
function parseDuration(input: string): number {
  const match = /^(\d+)\s*([smhd])?$/i.exec(input.trim());
  if (!match) return 60;
  const value = parseInt(match[1], 10);
  const unit = (match[2] ?? 'm').toLowerCase();
  switch (unit) {
    case 's': return Math.max(1, Math.round(value / 60));
    case 'm': return value;
    case 'h': return value * 60;
    case 'd': return value * 60 * 24;
    default: return 60;
  }
}

// ============================================================
//  COMMAND DEFINITION
// ============================================================

const data = new SlashCommandBuilder()
  .setName('modpanel')
  .setDescription('🛡️ Panneau de modération (Modérateur+)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)

  // warn
  .addSubcommand((sub) =>
    sub
      .setName('warn')
      .setDescription('Avertir un utilisateur')
      .addUserOption((o) => o.setName('utilisateur').setDescription('Utilisateur à avertir').setRequired(true))
      .addStringOption((o) => o.setName('raison').setDescription('Raison de l\'avertissement').setRequired(true)),
  )
  // mute
  .addSubcommand((sub) =>
    sub
      .setName('mute')
      .setDescription('Mettre en timeout un utilisateur')
      .addUserOption((o) => o.setName('utilisateur').setDescription('Utilisateur à mute').setRequired(true))
      .addStringOption((o) =>
        o.setName('durée').setDescription('Durée (ex: 10m, 2h, 1d)').setRequired(true),
      ),
  )
  // unmute
  .addSubcommand((sub) =>
    sub
      .setName('unmute')
      .setDescription('Retirer le timeout d\'un utilisateur')
      .addUserOption((o) => o.setName('utilisateur').setDescription('Utilisateur à unmute').setRequired(true)),
  )
  // kick
  .addSubcommand((sub) =>
    sub
      .setName('kick')
      .setDescription('Expulser un utilisateur du serveur')
      .addUserOption((o) => o.setName('utilisateur').setDescription('Utilisateur à expulser').setRequired(true))
      .addStringOption((o) => o.setName('raison').setDescription('Raison de l\'expulsion').setRequired(false)),
  )
  // ban
  .addSubcommand((sub) =>
    sub
      .setName('ban')
      .setDescription('Bannir un utilisateur')
      .addUserOption((o) => o.setName('utilisateur').setDescription('Utilisateur à bannir').setRequired(true))
      .addStringOption((o) => o.setName('raison').setDescription('Raison du ban').setRequired(false)),
  )
  // warnings
  .addSubcommand((sub) =>
    sub
      .setName('warnings')
      .setDescription('Voir les avertissements d\'un utilisateur')
      .addUserOption((o) => o.setName('utilisateur').setDescription('Utilisateur').setRequired(true)),
  )
  // clearwarnings
  .addSubcommand((sub) =>
    sub
      .setName('clearwarnings')
      .setDescription('Effacer tous les avertissements d\'un utilisateur')
      .addUserOption((o) => o.setName('utilisateur').setDescription('Utilisateur').setRequired(true)),
  ) as SlashCommandBuilder;

// ============================================================
//  EXECUTE
// ============================================================

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({ content: '❌ Cette commande doit être utilisée dans un serveur.', ephemeral: true });
    return;
  }

  if (!isAuthorized(interaction)) {
    await interaction.reply({
      content: '❌ Tu dois être **Modérateur** ou avoir les permissions adéquates pour utiliser cette commande.',
      ephemeral: true,
    });
    return;
  }

  const sub = interaction.options.getSubcommand();
  const guild = interaction.guild!;
  const mod = interaction.member as GuildMember;
  const target = interaction.options.getUser('utilisateur', true);

  switch (sub) {
    // ─────────────────────────────────────────────
    //  WARN
    // ─────────────────────────────────────────────
    case 'warn': {
      const reason = interaction.options.getString('raison', true);
      const warnings = await warnUser(guild.id, target.id, mod.id, reason);
      const autoAction = checkAutoAction(warnings);

      let desc = `⚠️ **${target.tag}** a reçu un avertissement.\n**Raison :** ${reason}\n**Total :** ${warnings.length} avertissement(s)`;

      // Apply automatic escalation if threshold reached
      if (autoAction.action !== 'none') {
        const member = await guild.members.fetch(target.id).catch(() => null);
        if (member) {
          if (autoAction.action === 'mute' && autoAction.duration) {
            await member.timeout(autoAction.duration * 60 * 1000, `AutoMod: ${warnings.length} avertissements`);
            desc += `\n\n🔇 **Action automatique :** Mute ${autoAction.duration} min (${warnings.length} avertissements)`;
          } else if (autoAction.action === 'ban') {
            const banReason = autoAction.duration
              ? `AutoMod: ban ${autoAction.duration} min (${warnings.length} avertissements)`
              : `AutoMod: ban permanent (${warnings.length} avertissements)`;
            await guild.members.ban(target.id, { reason: banReason });
            desc += autoAction.duration
              ? `\n\n🔨 **Action automatique :** Ban ${autoAction.duration} min`
              : '\n\n🔨 **Action automatique :** Ban permanent';
          }
        }
      }

      await interaction.reply({ embeds: [confirmEmbed('⚠️ Avertissement', desc)] });
      logger.info({ modId: mod.id, targetId: target.id, reason }, 'Manual warn issued');
      break;
    }

    // ─────────────────────────────────────────────
    //  MUTE (timeout)
    // ─────────────────────────────────────────────
    case 'mute': {
      const durationStr = interaction.options.getString('durée', true);
      const minutes = parseDuration(durationStr);
      const member = await guild.members.fetch(target.id).catch(() => null);

      if (!member) {
        await interaction.reply({ content: '❌ Utilisateur introuvable dans le serveur.', ephemeral: true });
        return;
      }
      if (!member.moderatable) {
        await interaction.reply({ content: '❌ Je ne peux pas mute cet utilisateur (hiérarchie de rôles).', ephemeral: true });
        return;
      }

      await member.timeout(minutes * 60 * 1000, `Mute par ${mod.user.tag}`);
      await interaction.reply({
        embeds: [confirmEmbed('🔇 Mute', `**${target.tag}** a été réduit au silence pendant **${minutes} min**.`)],
      });
      logger.info({ modId: mod.id, targetId: target.id, minutes }, 'Manual mute issued');
      break;
    }

    // ─────────────────────────────────────────────
    //  UNMUTE
    // ─────────────────────────────────────────────
    case 'unmute': {
      const member = await guild.members.fetch(target.id).catch(() => null);
      if (!member) {
        await interaction.reply({ content: '❌ Utilisateur introuvable dans le serveur.', ephemeral: true });
        return;
      }
      await member.timeout(null, `Unmute par ${mod.user.tag}`);
      await interaction.reply({
        embeds: [confirmEmbed('🔊 Unmute', `**${target.tag}** n'est plus réduit au silence.`)],
      });
      logger.info({ modId: mod.id, targetId: target.id }, 'Manual unmute issued');
      break;
    }

    // ─────────────────────────────────────────────
    //  KICK
    // ─────────────────────────────────────────────
    case 'kick': {
      const reason = interaction.options.getString('raison') ?? 'Aucune raison fournie';
      const member = await guild.members.fetch(target.id).catch(() => null);
      if (!member) {
        await interaction.reply({ content: '❌ Utilisateur introuvable dans le serveur.', ephemeral: true });
        return;
      }
      if (!member.kickable) {
        await interaction.reply({ content: '❌ Je ne peux pas expulser cet utilisateur (hiérarchie de rôles).', ephemeral: true });
        return;
      }
      await member.kick(`Kick par ${mod.user.tag}: ${reason}`);
      await interaction.reply({
        embeds: [confirmEmbed('👢 Kick', `**${target.tag}** a été expulsé.\n**Raison :** ${reason}`, 0xE67E22)],
      });
      logger.info({ modId: mod.id, targetId: target.id, reason }, 'Manual kick issued');
      break;
    }

    // ─────────────────────────────────────────────
    //  BAN
    // ─────────────────────────────────────────────
    case 'ban': {
      const reason = interaction.options.getString('raison') ?? 'Aucune raison fournie';
      await guild.members.ban(target.id, { reason: `Ban par ${mod.user.tag}: ${reason}` });
      await interaction.reply({
        embeds: [confirmEmbed('🔨 Ban', `**${target.tag}** a été banni.\n**Raison :** ${reason}`, 0xE74C3C)],
      });
      logger.info({ modId: mod.id, targetId: target.id, reason }, 'Manual ban issued');
      break;
    }

    // ─────────────────────────────────────────────
    //  WARNINGS (view)
    // ─────────────────────────────────────────────
    case 'warnings': {
      const warnings = await getWarnings(guild.id, target.id);
      if (warnings.length === 0) {
        await interaction.reply({
          embeds: [confirmEmbed('📋 Avertissements', `**${target.tag}** n'a aucun avertissement. ✅`)],
        });
        return;
      }

      const lines = warnings.map((w, i) => {
        const date = new Date(w.timestamp).toLocaleString('fr-FR');
        return `**${i + 1}.** ${w.reason}\n   └ <@${w.moderatorId}> • ${date}`;
      });

      const autoAction = checkAutoAction(warnings);
      let footer = `${warnings.length} avertissement(s)`;
      if (autoAction.action !== 'none') {
        footer += ` | Prochaine action auto: ${autoAction.action}`;
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`📋 Avertissements de ${target.tag}`)
            .setColor(0xF1C40F)
            .setDescription(lines.join('\n\n'))
            .setFooter({ text: footer }),
        ],
        allowedMentions: { users: [] },
      });
      break;
    }

    // ─────────────────────────────────────────────
    //  CLEARWARNINGS
    // ─────────────────────────────────────────────
    case 'clearwarnings': {
      await clearWarnings(guild.id, target.id);
      await interaction.reply({
        embeds: [confirmEmbed('🧹 Avertissements effacés', `Tous les avertissements de **${target.tag}** ont été supprimés.`)],
      });
      logger.info({ modId: mod.id, targetId: target.id }, 'Warnings cleared by mod');
      break;
    }

    default:
      await interaction.reply({ content: '❌ Sous-commande inconnue.', ephemeral: true });
  }
}

// ============================================================
//  EXPORT
// ============================================================

export default { data, execute } as SlashCommand;
