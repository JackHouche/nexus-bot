/**
 * NEXUS — /adminpanel
 * Admin / Fondateur panel (Administrator permission required).
 * Subcommands: event, givecoins, givegems, resetcooldown, announce, embed
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { logger } from '../../logger.js';
import { prisma } from '../../database.js';
import { redis } from '../../redis.js';
import { createEvent, EVENT_TYPES, type EventType } from '../../meta/liveops.js';

// ============================================================
//  HELPERS
// ============================================================

/** Build a confirmation embed. */
function confirmEmbed(title: string, description: string, color = 0xFF6B6B): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(description)
    .setTimestamp();
}

// ============================================================
//  COMMAND DEFINITION
// ============================================================

const data = new SlashCommandBuilder()
  .setName('adminpanel')
  .setDescription('🛠️ Panneau administrateur (Admin+)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

  // event
  .addSubcommand((sub) =>
    sub
      .setName('event')
      .setDescription('Lancer un événement serveur')
      .addStringOption((o) =>
        o
          .setName('type')
          .setDescription('Type d\'événement')
          .setRequired(true)
          .addChoices(
            ...(Object.keys(EVENT_TYPES) as EventType[]).map((t) => ({
              name: `${EVENT_TYPES[t].emoji} ${EVENT_TYPES[t].name}`,
              value: t,
            })),
          ),
      )
      .addIntegerOption((o) =>
        o.setName('durée').setDescription('Durée en heures (défaut: voir type)').setRequired(false).setMinValue(1).setMaxValue(168),
      ),
  )
  // givecoins
  .addSubcommand((sub) =>
    sub
      .setName('givecoins')
      .setDescription('Donner des coins à un utilisateur')
      .addUserOption((o) => o.setName('utilisateur').setDescription('Destinataire').setRequired(true))
      .addIntegerOption((o) => o.setName('montant').setDescription('Montant de coins').setRequired(true).setMinValue(1)),
  )
  // givegems
  .addSubcommand((sub) =>
    sub
      .setName('givegems')
      .setDescription('Donner des gems à un utilisateur')
      .addUserOption((o) => o.setName('utilisateur').setDescription('Destinataire').setRequired(true))
      .addIntegerOption((o) => o.setName('montant').setDescription('Montant de gems').setRequired(true).setMinValue(1)),
  )
  // resetcooldown
  .addSubcommand((sub) =>
    sub
      .setName('resetcooldown')
      .setDescription('Réinitialiser tous les cooldowns d\'un utilisateur')
      .addUserOption((o) => o.setName('utilisateur').setDescription('Utilisateur').setRequired(true)),
  )
  // announce
  .addSubcommand((sub) =>
    sub
      .setName('announce')
      .setDescription('Poster une annonce dans #annonces')
      .addStringOption((o) => o.setName('message').setDescription('Contenu de l\'annonce').setRequired(true)),
  )
  // embed
  .addSubcommand((sub) =>
    sub
      .setName('embed')
      .setDescription('Poster un embed riche dans le salon courant')
      .addStringOption((o) => o.setName('titre').setDescription('Titre de l\'embed').setRequired(true))
      .addStringOption((o) => o.setName('description').setDescription('Description de l\'embed').setRequired(true)),
  ) as SlashCommandBuilder;

// ============================================================
//  EXECUTE
// ============================================================

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({ content: '❌ Cette commande doit être utilisée dans un serveur.', ephemeral: true });
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: '❌ Tu dois être **Administrateur** pour utiliser cette commande.',
      ephemeral: true,
    });
    return;
  }

  const sub = interaction.options.getSubcommand();
  const guild = interaction.guild!;

  switch (sub) {
    // ─────────────────────────────────────────────
    //  EVENT
    // ─────────────────────────────────────────────
    case 'event': {
      const type = interaction.options.getString('type', true) as EventType;
      const durationHours = interaction.options.getInteger('durée') ?? undefined;

      if (!EVENT_TYPES[type]) {
        await interaction.reply({ content: '❌ Type d\'événement invalide.', ephemeral: true });
        return;
      }

      await createEvent(type, durationHours);
      const def = EVENT_TYPES[type];
      const hours = durationHours ?? def.durationHours;

      await interaction.reply({
        embeds: [
          confirmEmbed(
            `${def.emoji} Événement lancé`,
            `**${def.name}** est maintenant actif pendant **${hours}h** !\n${def.description}`,
            0x9B59B6,
          ),
        ],
      });
      logger.info({ adminId: interaction.user.id, type, hours }, 'Event started via adminpanel');
      break;
    }

    // ─────────────────────────────────────────────
    //  GIVECOINS
    // ─────────────────────────────────────────────
    case 'givecoins': {
      const target = interaction.options.getUser('utilisateur', true);
      const amount = interaction.options.getInteger('montant', true);

      await prisma.user.upsert({
        where: { id: target.id },
        update: { coins: { increment: BigInt(amount) }, username: target.username },
        create: { id: target.id, username: target.username, coins: BigInt(1000 + amount) },
      });

      await prisma.transaction.create({
        data: {
          userId: target.id,
          type: 'admin',
          amount: BigInt(amount),
          meta: { action: 'givecoins', adminId: interaction.user.id },
        },
      });

      await interaction.reply({
        embeds: [confirmEmbed('🪙 Coins distribués', `**${amount}** coins ajoutés à **${target.tag}**.`, 0xF1C40F)],
      });
      logger.info({ adminId: interaction.user.id, targetId: target.id, amount }, 'Coins given via adminpanel');
      break;
    }

    // ─────────────────────────────────────────────
    //  GIVEGEMS
    // ─────────────────────────────────────────────
    case 'givegems': {
      const target = interaction.options.getUser('utilisateur', true);
      const amount = interaction.options.getInteger('montant', true);

      await prisma.user.upsert({
        where: { id: target.id },
        update: { gems: { increment: amount }, username: target.username },
        create: { id: target.id, username: target.username, gems: amount },
      });

      await prisma.transaction.create({
        data: {
          userId: target.id,
          type: 'admin',
          amount: BigInt(0),
          meta: { action: 'givegems', amount, adminId: interaction.user.id },
        },
      });

      await interaction.reply({
        embeds: [confirmEmbed('💎 Gems distribués', `**${amount}** gems ajoutés à **${target.tag}**.`, 0x9B59B6)],
      });
      logger.info({ adminId: interaction.user.id, targetId: target.id, amount }, 'Gems given via adminpanel');
      break;
    }

    // ─────────────────────────────────────────────
    //  RESETCOOLDOWN
    // ─────────────────────────────────────────────
    case 'resetcooldown': {
      const target = interaction.options.getUser('utilisateur', true);

      // Delete all cooldown keys for this user
      const keys = await redis.keys(`cooldown:${target.id}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }

      await interaction.reply({
        embeds: [confirmEmbed('⏱️ Cooldowns réinitialisés', `Tous les cooldowns de **${target.tag}** ont été supprimés (${keys.length} clé(s)).`)],
      });
      logger.info({ adminId: interaction.user.id, targetId: target.id, cleared: keys.length }, 'Cooldowns reset via adminpanel');
      break;
    }

    // ─────────────────────────────────────────────
    //  ANNOUNCE
    // ─────────────────────────────────────────────
    case 'announce': {
      const message = interaction.options.getString('message', true);

      const announceChannel = guild.channels.cache.find(
        (c) =>
          (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
          (c.name.includes('annonces') || c.name.includes('announce')),
      );

      if (!announceChannel || !announceChannel.isTextBased()) {
        await interaction.reply({ content: '❌ Salon #annonces introuvable.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('📢 Annonce')
        .setColor(0xFFD700)
        .setDescription(message)
        .setAuthor({
          name: interaction.user.tag,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      await (announceChannel as import('discord.js').TextChannel).send({ embeds: [embed] });
      await interaction.reply({
        embeds: [confirmEmbed('✅ Annonce publiée', `L'annonce a été postée dans <#${announceChannel.id}>.`, 0x2ECC71)],
        ephemeral: true,
      });
      logger.info({ adminId: interaction.user.id }, 'Announcement posted via adminpanel');
      break;
    }

    // ─────────────────────────────────────────────
    //  EMBED
    // ─────────────────────────────────────────────
    case 'embed': {
      const title = interaction.options.getString('titre', true);
      const description = interaction.options.getString('description', true);

      const channel = interaction.channel;
      if (!channel || !channel.isTextBased()) {
        await interaction.reply({ content: '❌ Salon invalide.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(0x5865F2)
        .setDescription(description)
        .setAuthor({
          name: interaction.user.tag,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      await (channel as import('discord.js').TextChannel).send({ embeds: [embed] });
      await interaction.reply({
        embeds: [confirmEmbed('✅ Embed publié', `Embed posté dans ce salon.`, 0x2ECC71)],
        ephemeral: true,
      });
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
