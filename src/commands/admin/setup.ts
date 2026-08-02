import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type Guild,
  type CategoryChannel,
  type TextChannel,
  type VoiceChannel,
  type Role,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { logger } from '../../logger.js';

interface ChannelDef {
  name: string;
  type: 'text' | 'voice';
  topic?: string;
  nsfw?: boolean;
  userLimit?: number;
}

interface CategoryDef {
  name: string;
  emoji: string;
  channels: ChannelDef[];
}

const SERVER_STRUCTURE: CategoryDef[] = [
  {
    name: '⚡ VOLT',
    emoji: '⚡',
    channels: [
      { name: 'accueil', type: 'text', topic: '⚡ Bienvenue sur VOLT — La communauté qui déchire' },
      { name: 'règles', type: 'text', topic: '📋 Les règles du serveur — À lire absolument' },
      { name: 'annonces', type: 'text', topic: '📢 Updates, events, saisons — Ne rate rien' },
      { name: 'roadmap', type: 'text', topic: '🗺️ Ce qui arrive prochainement' },
    ],
  },
  {
    name: '💬 Communauté',
    emoji: '💬',
    channels: [
      { name: 'général', type: 'text', topic: '💬 Discussion générale — Tout est permis (dans les règles)' },
      { name: 'présentations', type: 'text', topic: '👋 Présente-toi à la communauté !' },
      { name: 'memes', type: 'text', topic: '😹 Memes, blagues, tout ce qui est fun' },
      { name: 'suggestions', type: 'text', topic: '💡 Tes idées pour améliorer VOLT' },
      { name: 'screenshots', type: 'text', topic: '📸 Partage tes meilleurs moments de jeu' },
    ],
  },
  {
    name: '🎮 Nexus',
    emoji: '🎮',
    channels: [
      { name: 'descente', type: 'text', topic: '🗡️ Joue à NEXUS ici — Tape /descent pour commencer' },
      { name: 'feed', type: 'text', topic: '🔥 Drops rares, records, synergies — Le bot poste automatiquement' },
      { name: 'raid', type: 'text', topic: '🐉 Boss mondial quotidien — Coordination du serveur' },
      { name: 'cimetière', type: 'text', topic: '⚰️ Cadavres trouvés, messages fantômes' },
      { name: 'marché', type: 'text', topic: '🏪 Marché entre joueurs — Achète et vends' },
      { name: 'duels', type: 'text', topic: '🤺 Combats PvP — Défie les autres joueurs' },
    ],
  },
  {
    name: '🏆 Compétition',
    emoji: '🏆',
    channels: [
      { name: 'classements', type: 'text', topic: '🏅 Leaderboards — Qui est le meilleur ?' },
      { name: 'daily-seed', type: 'text', topic: '📅 Le seed du jour — Même grille pour tout le serveur' },
      { name: 'tournois', type: 'text', topic: '🏆 Inscriptions et résultats des tournois' },
      { name: 'stratégies', type: 'text', topic: '🧠 Builds, synergies, tips & tricks' },
    ],
  },
  {
    name: '🎨 Créatif',
    emoji: '🎨',
    channels: [
      { name: 'fan-art', type: 'text', topic: '🎨 Vos créations, dessins, montages' },
      { name: 'vidéos', type: 'text', topic: '🎬 Clips, vidéos, replays' },
      { name: 'musique', type: 'text', topic: '🎵 Partage ta musique, Spotify, YouTube' },
    ],
  },
  {
    name: '🔊 Vocaux',
    emoji: '🔊',
    channels: [
      { name: 'Général', type: 'voice' },
      { name: 'Gaming 1', type: 'voice' },
      { name: 'Gaming 2', type: 'voice' },
      { name: 'Chill', type: 'voice' },
      { name: 'AFK', type: 'voice' },
    ],
  },
  {
    name: '🔒 Staff',
    emoji: '🔒',
    channels: [
      { name: 'staff-chat', type: 'text', topic: '🔒 Discussion staff — Modération' },
      { name: 'logs', type: 'text', topic: '📊 Logs du bot et du serveur' },
      { name: 'modération', type: 'text', topic: '🛡️ Actions de modération' },
    ],
  },
];

interface RoleDef {
  name: string;
  color: string;
  permissions: bigint;
  hoist: boolean;
  mentionable: boolean;
}

const ROLE_STRUCTURE: RoleDef[] = [
  { name: '⚡ Fondateur', color: '#FFD700', permissions: PermissionFlagsBits.Administrator, hoist: true, mentionable: false },
  { name: '🔧 Admin', color: '#FF6B6B', permissions: PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageChannels | PermissionFlagsBits.ManageRoles | PermissionFlagsBits.KickMembers | PermissionFlagsBits.BanMembers | PermissionFlagsBits.ManageMessages, hoist: true, mentionable: false },
  { name: '🛡️ Modérateur', color: '#4ECDC4', permissions: PermissionFlagsBits.ManageMessages | PermissionFlagsBits.KickMembers | PermissionFlagsBits.MuteMembers | PermissionFlagsBits.MoveMembers, hoist: true, mentionable: true },
  { name: '⭐ Actif', color: '#9B59B6', permissions: 0n, hoist: false, mentionable: true },
  { name: '🎮 Membre', color: '#5865F2', permissions: 0n, hoist: false, mentionable: false },
  { name: '🤖 Bot', color: '#2D1B4E', permissions: PermissionFlagsBits.ManageMessages, hoist: true, mentionable: false },
  { name: '🔇 Muet', color: '#2C2F33', permissions: 0n, hoist: false, mentionable: false },
];

export default {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('⚡ Configure le serveur VOLT : channels, rôles, et message d\'accueil')
    .addBooleanOption((opt) =>
      opt.setName('forcer').setDescription('Recréer les channels existants (défaut: false)').setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    // Only server admins can run setup
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '❌ Tu dois être administrateur du serveur pour lancer la configuration.',
        ephemeral: true,
      });
    }

    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({ content: '❌ Cette commande doit être utilisée dans un serveur.', ephemeral: true });
    }

    const force = interaction.options.getBoolean('forcer') ?? false;

    await interaction.reply({
      content: '⚡ **Configuration de VOLT en cours...**\nCréation des catégories, channels et rôles. Ça prend quelques secondes.',
      ephemeral: true,
    });

    const results: string[] = [];

    // === STEP 1: Create roles ===
    try {
      for (const roleDef of ROLE_STRUCTURE) {
        const existing = guild.roles.cache.find((r) => r.name === roleDef.name);
        if (existing && !force) {
          results.push(`✅ Rôle "${roleDef.name}" existe déjà`);
          continue;
        }
        await guild.roles.create({
          name: roleDef.name,
          color: roleDef.color as never,
          permissions: roleDef.permissions,
          hoist: roleDef.hoist,
          mentionable: roleDef.mentionable,
          reason: 'VOLT Setup',
        });
        results.push(`🆕 Rôle "${roleDef.name}" créé`);
      }
    } catch (err) {
      results.push(`⚠️ Erreur rôles: ${(err as Error).message}`);
    }

    // === STEP 2: Create categories + channels ===
    for (const catDef of SERVER_STRUCTURE) {
      try {
        // Find or create category
        let category = guild.channels.cache.find(
          (c) => c.type === ChannelType.GuildCategory && c.name === catDef.name
        ) as CategoryChannel | undefined;

        if (!category || (force && !category)) {
          category = await guild.channels.create({
            name: catDef.name,
            type: ChannelType.GuildCategory,
            reason: 'VOLT Setup',
          });
          results.push(`🆕 Catégorie "${catDef.name}" créée`);
        } else {
          results.push(`✅ Catégorie "${catDef.name}" existe`);
        }

        // Create channels inside category
        for (const chDef of catDef.channels) {
          const existing = guild.channels.cache.find(
            (c) => c.name === chDef.name && c.parentId === category!.id
          );

          if (existing && !force) {
            results.push(`✅ Channel "${chDef.name}" existe déjà`);
            continue;
          }

          if (chDef.type === 'text') {
            await guild.channels.create({
              name: chDef.name,
              type: ChannelType.GuildText,
              parent: category.id,
              topic: chDef.topic,
              reason: 'VOLT Setup',
            });
          } else {
            await guild.channels.create({
              name: chDef.name,
              type: ChannelType.GuildVoice,
              parent: category.id,
              userLimit: chDef.userLimit ?? 0,
              reason: 'VOLT Setup',
            });
          }
          results.push(`🆕 Channel "${chDef.name}" créé`);
        }

        // Set permissions for staff category
        if (catDef.emoji === '🔒') {
          const memberRole = guild.roles.cache.find((r) => r.name === '🎮 Membre');
          const adminRole = guild.roles.cache.find((r) => r.name === '🔧 Admin');
          const modRole = guild.roles.cache.find((r) => r.name === '🛡️ Modérateur');
          const founderRole = guild.roles.cache.find((r) => r.name === '⚡ Fondateur');

          if (memberRole) {
            await category.permissionOverwrites.edit(memberRole, {
              ViewChannel: false,
            });
          }
          if (everyoneRole(guild)) {
            await category.permissionOverwrites.edit(everyoneRole(guild)!, {
              ViewChannel: false,
            });
          }
          for (const r of [founderRole, adminRole, modRole]) {
            if (r) {
              await category.permissionOverwrites.edit(r, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
              });
            }
          }
        }
      } catch (err) {
        results.push(`⚠️ Erreur catégorie "${catDef.name}": ${(err as Error).message}`);
      }
    }

    // === STEP 3: Post welcome message in #accueil ===
    try {
      const accueil = guild.channels.cache.find(
        (c) => c.name === 'accueil' && c.type === ChannelType.GuildText
      ) as TextChannel | undefined;

      if (accueil) {
        const welcomeEmbed = new EmbedBuilder()
          .setTitle('⚡ VOLT — Bienvenue')
          .setColor(0xFFD700)
          .setDescription(
            '**VOLT** est la communauté qui déchire.\n' +
            'Gaming, challenges, bots exclusifs, et surtout : bonne vibe.\n\n' +
            '🎮 **NEXUS** — Notre bot roguelite exclusif : descends des étages générés procéduralement, ' +
            'risque ton pacte pour la gloire, découvre des synergies uniques.\n\n' +
            '⚡ **Pour commencer :**\n' +
            '`/descent` — Lance ta première descente\n' +
            '`/balance` — Vois ton argent\n' +
            '`/daily` — Récompense quotidienne\n' +
            '`/profile` — Ton profil de joueur\n' +
            '`/leaderboard` — Le classement\n\n' +
            '📋 **Va lire les règles dans #règles**\n' +
            '👋 **Présente-toi dans #présentations**'
          )
          .addFields(
            { name: '🏆 Objectifs', value: 'Descends le plus profond, bats tout le serveur, deviens une légende VOLT', inline: false },
            { name: '🔥 Events', value: 'Raids quotidiens, daily seed, tournois — quelque chose se passe chaque jour', inline: false },
            { name: '💬 Communauté', value: 'Sois respectueux, amuse-toi, et n\'oublie pas — c\'est juste un jeu', inline: false },
          )
          .setFooter({ text: '⚡ VOLT — La communauté qui déchire | Créé avec ❤️' })
          .setTimestamp();

        await accueil.send({ embeds: [welcomeEmbed] });
        results.push('✅ Message d\'accueil posté dans #accueil');
      }
    } catch (err) {
      results.push(`⚠️ Message d'accueil: ${(err as Error).message}`);
    }

    // === STEP 4: Post rules in #règles ===
    try {
      const rules = guild.channels.cache.find(
        (c) => c.name === 'règles' && c.type === ChannelType.GuildText
      ) as TextChannel | undefined;

      if (rules) {
        const rulesEmbed = new EmbedBuilder()
          .setTitle('📋 Règles de VOLT')
          .setColor(0xFF6B6B)
          .setDescription('Pas de chichis, juste du bon sens. Mais on les met quand même.\n')
          .addFields(
            { name: '1️⃣ Respect', value: 'Pas de racisme, sexisme, homophobie, ou toute forme de haine. Zéro tolérance.', inline: false },
            { name: '2️⃣ Pas de spam', value: 'Pas de flood, pas de pub non-sollicitée, pas de @everyone/@here abusif.', inline: false },
            { name: '3️⃣ Pas de NSFW', value: 'Le contenu explicite est interdit. Ce serveur est tout public.', inline: false },
            { name: '4️⃣ Pas de triche', value: 'Exploiter des bugs pour tricher à NEXUS = ban. Reporte les bugs dans #suggestions.', inline: false },
            { name: '5️⃣ Sois cool', value: 'On est là pour s\'amuser. Si tu mets la mauvaise vibe, tu vas go.', inline: false },
            { name: '6️⃣ Écoute le staff', value: 'Les modérateurs ont le dernier mot. Si tu as un problème, DM un mod.', inline: false },
          )
          .setFooter({ text: '⚡ Le non-respect des règles entraîne un ban immédiat' });

        await rules.send({ embeds: [rulesEmbed] });
        results.push('✅ Règles postées dans #règles');
      }
    } catch (err) {
      results.push(`⚠️ Règles: ${(err as Error).message}`);
    }

    // === SUMMARY ===
    const summaryEmbed = new EmbedBuilder()
      .setTitle('⚡ VOLT — Configuration terminée !')
      .setColor(0xFFD700)
      .setDescription(
        `**${results.length} actions effectuées**\n\n` +
        results.slice(-30).join('\n')
      )
      .addFields(
        { name: '📊 Résumé', value: `${SERVER_STRUCTURE.reduce((acc, c) => acc + c.channels.length, 0)} channels créés\n${ROLE_STRUCTURE.length} rôles configurés`, inline: false },
        { name: '🎯 Prochaines étapes', value: '1. Déplace-toi le rôle ⚡ Fondateur en haut\n2. Ajoute le bot NEXUS dans #descente\n3. Invite tes premiers membres !', inline: false },
      )
      .setFooter({ text: '⚡ VOLT est prêt. Bon jeu !' });

    await interaction.editReply({ content: '', embeds: [summaryEmbed] });
    logger.info({ guildId: guild.id }, 'VOLT server setup completed');
  },
} as SlashCommand;

function everyoneRole(guild: Guild) {
  return guild.roles.everyone;
}
