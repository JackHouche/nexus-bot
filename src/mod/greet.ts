/**
 * NEXUS — Welcome / goodbye system
 * Greets new members, auto-assigns the Membre role, DMs a quick-start guide.
 */

import { EmbedBuilder, ChannelType } from 'discord.js';
import type { GuildMember, TextChannel, NewsChannel } from 'discord.js';
import { logger } from '../logger.js';

// ============================================================
//  CONSTANTS
// ============================================================

const MEMBER_ROLE_NAME = '🎮 Membre';
const SERVER_NAME = 'VOLT';
const ACCENT_GOLD = 0xFFD700;
const ACCENT_RED = 0xFF6B6B;

// ============================================================
//  HELPERS
// ============================================================

function findChannelByName(guild: GuildMember['guild'], fragment: string): TextChannel | NewsChannel | null {
  const ch = guild.channels.cache.find(
    (c) =>
      (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
      c.name.includes(fragment),
  );
  return ch as TextChannel | NewsChannel | null;
}

// ============================================================
//  MEMBER JOIN
// ============================================================

/**
 * Handle a new member joining:
 * 1. Auto-assign 🎮 Membre role
 * 2. Send a welcome embed in the system channel
 * 3. DM a quick-start guide
 */
export async function handleMemberJoin(member: GuildMember): Promise<void> {
  const { guild, user } = member;

  // ── 1. Auto-assign member role ──
  try {
    const memberRole = guild.roles.cache.find((r) => r.name === MEMBER_ROLE_NAME);
    if (memberRole) {
      await member.roles.add(memberRole, 'Auto-role: nouveau membre');
    } else {
      logger.warn({ guildId: guild.id }, `Role "${MEMBER_ROLE_NAME}" not found — skipping auto-role`);
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Failed to assign member role on join');
  }

  // ── 2. Welcome embed in system channel ──
  const systemChannel = guild.systemChannel as TextChannel | null;
  if (systemChannel) {
    try {
      const rulesChannel = findChannelByName(guild, 'règles');
      const presentationsChannel = findChannelByName(guild, 'présentations');

      const embed = new EmbedBuilder()
        .setTitle(`⚡ Bienvenue sur ${SERVER_NAME} !`)
        .setColor(ACCENT_GOLD)
        .setThumbnail(user.displayAvatarURL())
        .setDescription(
          `Hey <@${user.id}> ! Bienvenue dans la communauté **${SERVER_NAME}** ! 🎉\n\n` +
          `Prêt à descendre dans les profondeurs de **NEXUS** ? Choisis ta classe, ` +
          `ris ton pacte, et deviens une légende. ⚔️`,
        )
        .addFields(
          {
            name: '🎮 Pour commencer',
            value:
              '`/descent` — Lance ta première descente\n' +
              '`/balance` — Ton solde de monnaies\n' +
              '`/daily` — Récompense quotidienne',
            inline: false,
          },
          {
            name: '📜 Règles',
            value: rulesChannel
              ? `Va lire les règles ici : <#${rulesChannel.id}>`
              : 'Va lire les règles dans le salon #règles !',
            inline: false,
          },
          {
            name: '👋 Présente-toi',
            value: presentationsChannel
              ? `Dis bonjour à la communauté : <#${presentationsChannel.id}>`
              : 'Présente-toi dans le salon #présentations !',
            inline: false,
          },
        )
        .setFooter({ text: `⚡ ${SERVER_NAME} — Plonge. Risque tout. Deviens une légende.` })
        .setTimestamp();

      await systemChannel.send({ content: `<@${user.id}>`, embeds: [embed] });
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Failed to send welcome message');
    }
  }

  // ── 3. DM quick-start guide ──
  try {
    const dmEmbed = new EmbedBuilder()
      .setTitle(`⚡ Bienvenue sur ${SERVER_NAME}, ${user.username} !`)
      .setColor(ACCENT_GOLD)
      .setDescription(
        `Salut **${user.username}** ! 🎉\n\n` +
        `Bienvenue dans **${SERVER_NAME}**, la communauté qui déchire. ` +
        `Notre bot exclusif **NEXUS** t'attend : un roguelite infini, généré procéduralement.`,
      )
      .addFields(
        {
          name: '🚀 Commandes essentielles',
          value:
            '`/descent` — Commence ta descente\n' +
            '`/balance` — Vérifie ton solde\n' +
            '`/daily` — Récompense quotidienne\n' +
            '`/profile` — Ton profil de joueur\n' +
            '`/leaderboard` — Le classement',
          inline: false,
        },
        {
          name: '💡 Bon à savoir',
          value:
            '• Les messages du bot sont **éphémères** — seul toi les vois.\n' +
            '• Si tu meurs, tu perds tout… sauf ta gloire. 💀\n' +
            '• Plus tu descends, plus tu gagnes.',
          inline: false,
        },
        {
          name: '🎯 Objectifs',
          value: '🏆 Descends le plus profond\n🥇 Bats tout le serveur\n👑 Deviens une légende',
          inline: false,
        },
      )
      .setFooter({ text: `⚡ ${SERVER_NAME} — La communauté qui déchire` })
      .setTimestamp();

    await user.send({ embeds: [dmEmbed] });
  } catch {
    // DMs closed — silently ignore
    logger.debug({ userId: user.id }, 'Could not DM user on join (DMs closed)');
  }

  logger.info({ guildId: guild.id, userId: user.id, username: user.username }, 'Member joined');
}

// ============================================================
//  MEMBER LEAVE
// ============================================================

/**
 * Handle a member leaving — send a goodbye message in the system channel.
 */
export async function handleMemberLeave(member: GuildMember): Promise<void> {
  const { guild, user } = member;

  const systemChannel = guild.systemChannel as TextChannel | null;
  if (!systemChannel) return;

  try {
    const embed = new EmbedBuilder()
      .setTitle(`👋 ${user.username} a quitté ${SERVER_NAME}`)
      .setColor(ACCENT_RED)
      .setThumbnail(user.displayAvatarURL())
      .setDescription(
        `**${user.tag}** a quitté le serveur.\n\n` +
        `Peut-être un jour il reviendra affronter les profondeurs… 🖤`,
      )
      .setFooter({ text: `⚡ ${SERVER_NAME}` })
      .setTimestamp();

    await systemChannel.send({ embeds: [embed] });
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Failed to send goodbye message');
  }

  logger.info({ guildId: guild.id, userId: user.id }, 'Member left');
}
