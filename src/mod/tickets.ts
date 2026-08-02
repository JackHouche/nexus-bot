/**
 * NEXUS — Ticket / support system
 * Private channels under a "🎫 ┊ Support" category.
 * Metadata stored in Redis: key `ticket:{userId}`, TTL 24 h.
 */

import {
  ChannelType,
  PermissionFlagsBits,
  OverwriteType,
  type Guild,
  type TextChannel,
  type CategoryChannel,
} from 'discord.js';
import { redis } from '../redis.js';
import { logger } from '../logger.js';

// ============================================================
//  CONSTANTS
// ============================================================

const SUPPORT_CATEGORY = '🎫 ┊ Support';
const CLOSED_CATEGORY = '🎫 ┊ Support Fermé';
const TICKET_TTL = 24 * 60 * 60; // 24 h

const STAFF_ROLE_NAMES = ['⚡ Fondateur', '🛠️ Admin', '🛡️ Modérateur'];

// ============================================================
//  REDIS HELPERS
// ============================================================

const ticketKey = (userId: string) => `ticket:${userId}`;

// ============================================================
//  PUBLIC API
// ============================================================

/**
 * Check whether a user already has an open ticket.
 * Returns the channel ID or null.
 */
export async function getOpenTicket(userId: string): Promise<string | null> {
  const channelId = await redis.get(ticketKey(userId));
  return channelId ?? null;
}

/**
 * Create a private ticket channel for a user.
 * @throws if the user already has an open ticket.
 */
export async function createTicket(
  guild: Guild,
  userId: string,
  subject: string,
): Promise<TextChannel> {
  // Prevent duplicate tickets
  const existing = await getOpenTicket(userId);
  if (existing) {
    const channel = guild.channels.cache.get(existing) as TextChannel | undefined;
    if (channel) {
      throw new Error('Tu as déjà un ticket ouvert.');
    }
    // Stale Redis entry — clean up
    await redis.del(ticketKey(userId));
  }

  // Find or create the support category
  let category = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === SUPPORT_CATEGORY,
  ) as CategoryChannel | undefined;

  if (!category) {
    category = await guild.channels.create({
      name: SUPPORT_CATEGORY,
      type: ChannelType.GuildCategory,
      reason: 'Création catégorie Support',
    });
  }

  // Resolve staff roles
  const staffRoles = STAFF_ROLE_NAMES
    .map((name) => guild.roles.cache.find((r) => r.name === name))
    .filter((r): r is NonNullable<typeof r> => r !== undefined);

  // Create the ticket channel
  const safeName = `🎫・${subject.replace(/[^\w\s-]/g, '').slice(0, 20).trim() || 'support'}`;
  const channel = await guild.channels.create({
    name: safeName,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `Ticket de <@${userId}> — ${subject}`,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
        type: OverwriteType.Role,
      },
      {
        id: userId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
        ],
        type: OverwriteType.Member,
      },
      ...staffRoles.map((r) => ({
        id: r.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.ManageChannels,
        ],
        type: OverwriteType.Role as const,
      })),
    ],
  });

  // Store ticket metadata
  await redis.set(ticketKey(userId), channel.id, 'EX', TICKET_TTL);

  // Send initial message
  await channel.send({
    content: `<@${userId}>`,
    embeds: [],
    allowedMentions: { users: [userId] },
  }).catch(() => {});

  logger.info(
    { guildId: guild.id, userId, channelId: channel.id, subject },
    'Ticket created',
  );
  return channel;
}

/**
 * Close a ticket — move to a "closed" category or delete if none exists.
 */
export async function closeTicket(channelId: string): Promise<void> {
  // Find the channel across all guilds via the bot's cache
  // The caller should pass the guild's channel; but we accept channelId
  // and resolve it from the first guild that has it.
  // In practice the caller already has the channel object.
  throw new Error(
    'closeTicket(channelId) requires guild context. Use closeTicketChannel(channel) instead.',
  );
}

/**
 * Close a ticket channel (preferred entry point).
 * Moves to a closed category if one exists, otherwise deletes the channel.
 */
export async function closeTicketChannel(channel: TextChannel): Promise<void> {
  const guild = channel.guild;

  // Try to find the ticket's user from Redis
  // (scan for ticket:* keys matching this channel)
  const keys = await redis.keys('ticket:*');
  for (const k of keys) {
    const val = await redis.get(k);
    if (val === channel.id) {
      await redis.del(k);
      break;
    }
  }

  // Find or create a "closed" category
  let closedCat = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === CLOSED_CATEGORY,
  ) as CategoryChannel | undefined;

  if (closedCat) {
    await channel.setParent(closedCat.id, { lockPermissions: false }).catch(() => {});
    await channel.setName(`✅・${channel.name.replace('🎫・', '')}`).catch(() => {});
    logger.info({ channelId: channel.id }, 'Ticket archived');
  } else {
    await channel.delete('Ticket fermé').catch(() => {});
    logger.info({ channelId: channel.id }, 'Ticket deleted (no closed category)');
  }
}
