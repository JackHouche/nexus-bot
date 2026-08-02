import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type CategoryChannel,
  type TextChannel,
  ChannelType,
  PermissionFlagsBits,
  OverwriteType,
} from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { logger } from '../../logger.js';

// ============================================================
//  CHANNEL DEFINITIONS
//  Each channel: { name, topic, slowmode?, nsfw?, locked? }
//  locked = only staff can write (members read-only)
// ============================================================

interface ChannelDef {
  name: string;
  topic: string;
  slowmode?: number; // seconds
  locked?: boolean; // read-only for members
}

interface VoiceDef {
  name: string;
  userLimit?: number;
  bitrate?: number;
}

interface CategoryDef {
  name: string;
  channels?: ChannelDef[];
  voices?: VoiceDef[];
  locked?: boolean; // entire category staff-only
}

// ============================================================
//  STRUCTURE — VOLT themed, intelligent hierarchy
// ============================================================

const STRUCTURE: CategoryDef[] = [
  // ─── INFORMATION (top priority, read-only) ───
  {
    name: '⚡ ┊ Informations',
    channels: [
      {
        name: '📰・accueil',
        topic: '⚡ Bienvenue sur VOLT — La communauté qui déchire. Tape /start pour commencer ton aventure.',
        locked: true,
      },
      {
        name: '📜・règles',
        topic: '📋 Les règles du serveur — À lire absolument avant de participer.',
        locked: true,
      },
      {
        name: '📢・annonces',
        topic: '🔔 Updates, events, saisons — Active les notifs 🔔',
        locked: true,
      },
      {
        name: '🎁・giveaways',
        topic: '🎉 Giveaways et récompenses — Ne rate rien !',
        locked: true,
      },
      {
        name: '🗺️・roadmap',
        topic: '🚀 Ce qui arrive prochainement — Sois au courant',
        locked: true,
      },
    ],
  },

  // ─── NEXUS (le jeu star) ───
  {
    name: '🎮 ┊ NEXUS',
    channels: [
      {
        name: '🗡️・descente',
        topic: '🗡️ Joue à NEXUS ici — Tape /descent pour commencer ta descente.\nLes messages sont éphémères (invisible aux autres).',
        slowmode: 2,
      },
      {
        name: '🔥・feed',
        topic: '🔥 Drops rares, records, synergies — Le bot poste automatiquement les moments épiques',
        locked: true,
      },
      {
        name: '🐉・raid',
        topic: '🐉 Boss mondial quotidien — Le serveur entier doit coopérer pour le vaincre',
        locked: true,
      },
      {
        name: '⚰️・cimetière',
        topic: '⚰️ Cadavres trouvés, messages fantômes — Dark Souls style',
        locked: true,
      },
      {
        name: '🏪・marché',
        topic: '🏪 Marché entre joueurs — /market browse pour voir les annonces',
      },
      {
        name: '🤺・duels',
        topic: '🤺 Combats PvP — Défie les autres joueurs : /duel @joueur mise',
      },
    ],
  },

  // ─── COMPÉTITION ───
  {
    name: '🏆 ┊ Compétition',
    channels: [
      {
        name: '🏅・classements',
        topic: '🏆 Leaderboards — Qui est le meilleur de VOLT ?',
        locked: true,
      },
      {
        name: '📅・daily-seed',
        topic: '🎲 Le seed du jour — Même grille pour tout le serveur, qui ira le plus loin ?',
        locked: true,
      },
      {
        name: '🥇・tournois',
        topic: '🏆 Inscriptions et résultats des tournois officiels',
        locked: true,
      },
      {
        name: '🧠・stratégies',
        topic: '🧠 Builds, synergies, tips & tricks — Partage tes meilleures stratégies',
      },
    ],
  },

  // ─── COMMUNAUTÉ ───
  {
    name: '💬 ┊ Communauté',
    channels: [
      {
        name: '💬・général',
        topic: '💬 Discussion générale — Tout est permis (dans les règles)',
        slowmode: 3,
      },
      {
        name: '👋・présentations',
        topic: '👋 Présente-toi à la communauté — Âge, jeux, passions',
      },
      {
        name: '😹・memes',
        topic: '😹 Memes, blagues, copypasta — Tout ce qui est fun',
        slowmode: 2,
      },
      {
        name: '🖼️・screenshots',
        topic: '📸 Partage tes meilleurs moments de jeu, screenshots, clips',
      },
      {
        name: '💡・suggestions',
        topic: '💡 Tes idées pour améliorer VOLT et NEXUS — On lit tout',
      },
      {
        name: '🐛・bug-reports',
        topic: '🐛 Trouvé un bug ? Reporte-le ici avec le plus de détails possible',
      },
    ],
  },

  // ─── CRÉATIF ───
  {
    name: '🎨 ┊ Créatif',
    channels: [
      {
        name: '🎨・fan-art',
        topic: '🎨 Vos créations, dessins, montages, wallpapers',
      },
      {
        name: '🎬・vidéos',
        topic: '🎬 Clips, vidéos, replays, YouTube, TikTok',
      },
      {
        name: '🎵・musique',
        topic: '🎵 Partage ta musique, Spotify, SoundCloud, YouTube',
        slowmode: 5,
      },
    ],
  },

  // ─── VOCaux ───
  {
    name: '🔊 ┊ Vocaux',
    voices: [
      { name: '🔊・Général', userLimit: 0 },
      { name: '🎮・Gaming 1', userLimit: 10 },
      { name: '🎮・Gaming 2', userLimit: 10 },
      { name: '🎮・Gaming 3', userLimit: 5 },
      { name: '☕・Chill', userLimit: 15 },
      { name: '🎧・Musique', userLimit: 10 },
      { name: '💤・AFK', userLimit: 0 },
    ],
    channels: [
      {
        name: '🎵・commandes-musique',
        topic: '🎵 Utilise les commandes du bot musique ici (ne spamme pas les vocaux)',
        slowmode: 3,
      },
    ],
  },

  // ─── STAFF (locked) ───
  {
    name: '🔒 ┊ Staff',
    locked: true,
    channels: [
      {
        name: '🔐・staff-chat',
        topic: '🔒 Discussion staff — Modération et gestion du serveur',
      },
      {
        name: '📊・logs',
        topic: '📊 Logs du bot, actions de modération, alertes',
        locked: true,
      },
      {
        name: '⚠️・alertes',
        topic: '⚠️ Alertes automatiques — Bugs critiques, exploits détectés',
        locked: true,
      },
      {
        name: '🛡️・modération',
        topic: '🛡️ Actions de modération — Bans, kicks, mutes, warnings',
      },
    ],
  },
];

// ============================================================
//  ROLES — with hierarchy
// ============================================================

interface RoleDef {
  name: string;
  color: string;
  emoji: string;
  permissions: bigint;
  hoist: boolean;
  mentionable: boolean;
}

const ROLES: RoleDef[] = [
  { name: '⚡ Fondateur', color: '#FFD700', emoji: '⚡', permissions: PermissionFlagsBits.Administrator, hoist: true, mentionable: false },
  { name: '🛠️ Admin', color: '#FF6B6B', emoji: '🛠️', permissions: PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageChannels | PermissionFlagsBits.ManageRoles | PermissionFlagsBits.KickMembers | PermissionFlagsBits.BanMembers | PermissionFlagsBits.ManageMessages | PermissionFlagsBits.ViewAuditLog, hoist: true, mentionable: false },
  { name: '🛡️ Modérateur', color: '#4ECDC4', emoji: '🛡️', permissions: PermissionFlagsBits.ManageMessages | PermissionFlagsBits.KickMembers | PermissionFlagsBits.MuteMembers | PermissionFlagsBits.MoveMembers | PermissionFlagsBits.ViewAuditLog, hoist: true, mentionable: true },
  { name: '🧪 Beta Testeur', color: '#E74C3C', emoji: '🧪', permissions: 0n, hoist: false, mentionable: true },
  { name: '💎 VIP', color: '#F1C40F', emoji: '💎', permissions: 0n, hoist: false, mentionable: true },
  { name: '⚡ Booster', color: '#9B59B6', emoji: '⚡', permissions: 0n, hoist: false, mentionable: false },
  { name: '🏆 Top 10', color: '#E67E22', emoji: '🏆', permissions: 0n, hoist: false, mentionable: false },
  { name: '🎮 Membre', color: '#5865F2', emoji: '🎮', permissions: 0n, hoist: false, mentionable: false },
  { name: '🤖 Bot', color: '#2D1B4E', emoji: '🤖', permissions: PermissionFlagsBits.Administrator, hoist: true, mentionable: false },
  { name: '🔇 Muet', color: '#2C2F33', emoji: '🔇', permissions: 0n, hoist: false, mentionable: false },
];

// ============================================================
//  SETUP COMMAND
// ============================================================

export default {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('⚡ Configure VOLT : channels, rôles, message d\'accueil (Admin seulement)')
    .addStringOption((opt) =>
      opt.setName('mode').setDescription('Mode de configuration').setRequired(false)
        .addChoices(
          { name: '🆕 Créer (ignore ce qui existe)', value: 'create' },
          { name: '🧹 Nettoyer (supprime TOUT et recrée)', value: 'clean' },
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '❌ Tu dois être **Administrateur** du serveur pour lancer la configuration.',
        ephemeral: true,
      });
    }

    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({ content: '❌ Cette commande doit être utilisée dans un serveur.', ephemeral: true });
    }

    const mode = interaction.options.getString('mode') ?? 'create';
    const force = mode === 'clean';

    await interaction.deferReply({ ephemeral: true });

    const log: string[] = [];
    let channelCount = 0;
    let roleCount = 0;
    let categoryCount = 0;

    // === STEP 0: CLEAN MODE — nuke everything first ===
    if (force) {
      log.push('🧹 Nettoyage en cours...');

      // Delete ALL channels (text, voice, category)
      const allChannels = guild.channels.cache;
      for (const [, channel] of allChannels) {
        try {
          await channel.delete('VOLT Clean Setup');
        } catch { /* ignore individual errors */ }
      }
      log.push('🧹 Tous les channels supprimés');

      // Delete custom roles (keep @everyone and managed roles like Booster)
      const customRoles = guild.roles.cache.filter(
        (r) => !r.managed && r.id !== guild.roles.everyone.id
      );
      for (const [, role] of customRoles) {
        try {
          await role.delete('VOLT Clean Setup');
        } catch { /* ignore */ }
      }
      log.push('🧹 Rôles personnalisés supprimés');
    }

    // === STEP 1: ROLES ===
    for (const roleDef of ROLES) {
      try {
        const existing = guild.roles.cache.find((r) => r.name === roleDef.name);
        if (existing && !force) {
          log.push(`✅ ${roleDef.emoji} ${roleDef.name} (existe)`);
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
        roleCount++;
        log.push(`🆕 ${roleDef.emoji} ${roleDef.name} créé`);
      } catch (err) {
        log.push(`⚠️ ${roleDef.name}: ${(err as Error).message}`);
      }
    }

    // === STEP 2: CATEGORIES + CHANNELS ===
    const everyoneRole = guild.roles.everyone;
    const memberRole = guild.roles.cache.find((r) => r.name === '🎮 Membre');
    const modRole = guild.roles.cache.find((r) => r.name === '🛡️ Modérateur');
    const adminRole = guild.roles.cache.find((r) => r.name === '🛠️ Admin');
    const founderRole = guild.roles.cache.find((r) => r.name === '⚡ Fondateur');
    const botRole = guild.roles.cache.find((r) => r.name === '🤖 Bot');

    const staffRoles = [founderRole, adminRole, modRole].filter(Boolean);

    for (const catDef of STRUCTURE) {
      try {
        let category = guild.channels.cache.find(
          (c) => c.type === ChannelType.GuildCategory && c.name === catDef.name
        ) as CategoryChannel | undefined;

        if (!category) {
          category = await guild.channels.create({
            name: catDef.name,
            type: ChannelType.GuildCategory,
            reason: 'VOLT Setup',
          });
          categoryCount++;
        }

        // Set permissions for locked categories (Staff)
        if (catDef.locked) {
          await category.permissionOverwrites.set([
            { id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel], type: OverwriteType.Role },
            ...staffRoles.map((r) => ({
              id: r!.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
              type: OverwriteType.Role as const,
            })),
            ...(botRole ? [{ id: botRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory], type: OverwriteType.Role as const }] : []),
          ]);
        }

        // Create text channels
        if (catDef.channels) {
          for (const chDef of catDef.channels) {
            const existing = guild.channels.cache.find(
              (c) => c.name === chDef.name && c.parentId === category!.id
            );
            if (existing && !force) {
              log.push(`✅ ${chDef.name}`);
              continue;
            }

            const channel = await guild.channels.create({
              name: chDef.name,
              type: ChannelType.GuildText,
              parent: category.id,
              topic: chDef.topic,
              rateLimitPerUser: chDef.slowmode ?? 0,
              reason: 'VOLT Setup',
            });
            channelCount++;

            // Locked channels = read-only for members
            if (chDef.locked && memberRole) {
              await channel.permissionOverwrites.set([
                { id: everyoneRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages], type: OverwriteType.Role },
                { id: memberRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages], type: OverwriteType.Role },
                ...staffRoles.map((r) => ({
                  id: r!.id,
                  allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
                  type: OverwriteType.Role as const,
                })),
              ]);
            }
            log.push(`🆕 📝 ${chDef.name}`);
          }
        }

        // Create voice channels
        if (catDef.voices) {
          for (const vDef of catDef.voices) {
            const existing = guild.channels.cache.find(
              (c) => c.name === vDef.name && c.parentId === category!.id
            );
            if (existing && !force) {
              log.push(`✅ ${vDef.name}`);
              continue;
            }
            await guild.channels.create({
              name: vDef.name,
              type: ChannelType.GuildVoice,
              parent: category.id,
              userLimit: vDef.userLimit ?? 0,
              bitrate: vDef.bitrate ?? 64000,
              reason: 'VOLT Setup',
            });
            channelCount++;
            log.push(`🆕 🔊 ${vDef.name}`);
          }
        }
      } catch (err) {
        log.push(`⚠️ ${catDef.name}: ${(err as Error).message}`);
      }
    }

    // === STEP 3: WELCOME MESSAGE ===
    try {
      const accueil = guild.channels.cache.find(
        (c) => c.name === '📰・accueil' && c.type === ChannelType.GuildText
      ) as TextChannel | undefined;

      // Fallback: try old name
      const accueilAlt = !accueil ? guild.channels.cache.find(
        (c) => c.name === 'accueil' && c.type === ChannelType.GuildText
      ) as TextChannel | undefined : undefined;

      const targetChannel = accueil ?? accueilAlt;

      if (targetChannel) {
        const welcome = new EmbedBuilder()
          .setTitle('⚡ VOLT')
          .setColor(0xFFD700)
          .setThumbnail(guild.iconURL() ?? null)
          .setDescription(
            '**La communauté qui déchire.**\n' +
            'Gaming, challenges, bots exclusifs et surtout : **la bonne vibe.**\n\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
            '🎮 **NEXUS — Notre bot exclusif**\n' +
            'Descends des étages générés procéduralement. Combats, gambles, énigmes.\n' +
            'Risque ton pacte pour la gloire. Découvre des synergies uniques.\n' +
            'Plus tu descends, plus tu gagnes... mais si tu meurs, tu perds tout.\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
          )
          .addFields(
            {
              name: '🚀 Pour commencer',
              value: '`/descent` — Lance ta première descente\n`/balance` — Ton argent\n`/daily` — Récompense quotidienne\n`/profile` — Ton profil de joueur\n`/leaderboard` — Le classement\n`/classes` — Guide des classes\n`/perks` — Encyclopédie des perks\n`/achievements` — Tes succès',
              inline: false,
            },
            {
              name: '⚔️ Objectifs',
              value: '🏆 Descends le plus profond\n🥇 bats tout le serveur\n👑 Deviens une légende VOLT',
              inline: false,
            },
            {
              name: '🔥 Events',
              value: '🐉 **Raid quotidien** — Boss mondial à vaincre ensemble\n📅 **Daily Seed** — Même seed pour tout le serveur\n🏆 **Tournois** — Compétitions régulières\n🎭 **Saisons** — Nouveau contenu toutes les 8 semaines',
              inline: false,
            },
            {
              name: '💡 Astuce',
              value: 'Les messages du bot sont **éphémères** — seul toi les vois. Joue tranquille, les autres ne voient pas ta run.',
              inline: false,
            },
          )
          .setFooter({ text: '⚡ VOLT — Plonge. Risque tout. Deviens une légende.' })
          .setTimestamp();

        await targetChannel.send({ embeds: [welcome] });
        log.push('✅ Message d\'accueil posté');
      }
    } catch (err) {
      log.push(`⚠️ Accueil: ${(err as Error).message}`);
    }

    // === STEP 4: RULES ===
    try {
      const rules = guild.channels.cache.find(
        (c) => c.name === '📜・règles' && c.type === ChannelType.GuildText
      ) as TextChannel | undefined;

      const rulesAlt = !rules ? guild.channels.cache.find(
        (c) => c.name === 'règles' && c.type === ChannelType.GuildText
      ) as TextChannel | undefined : undefined;

      const targetRules = rules ?? rulesAlt;

      if (targetRules) {
        const rulesEmbed = new EmbedBuilder()
          .setTitle('📜 Règles de VOLT')
          .setColor(0xFF6B6B)
          .setDescription('*Pas de chichis, juste du bon sens.*\n')
          .addFields(
            { name: '1️⃣ Respect mutuel', value: 'Zéro tolérance pour racisme, sexisme, homophobie ou haine. Sois un être humain décent.', inline: false },
            { name: '2️⃣ Pas de spam', value: 'Pas de flood, pas de pub non-sollicitée, pas de @everyone/@here abusif.', inline: false },
            { name: '3️⃣ Contenu approprié', value: 'Pas de NSFW. Ce serveur est tout public. Garde ça pour toi.', inline: false },
            { name: '4️⃣ Pas de triche', value: 'Exploiter des bugs dans NEXUS = ban. Reporte les bugs dans #🐛・bug-reports.', inline: false },
            { name: '5️⃣ Sois cool', value: 'On est là pour s\'amuser. Mauvaise vibe = sortie directe.', inline: false },
            { name: '6️⃣ Staff = respect', value: 'Les modérateurs ont le dernier mot. Problème ? DM un mod. Conteste un ban ? DM un admin.', inline: false },
          )
          .setFooter({ text: '⚡ Le non-respect des règles = ban immédiat. Sans warning.' });

        await targetRules.send({ embeds: [rulesEmbed] });
        log.push('✅ Règles postées');
      }
    } catch (err) {
      log.push(`⚠️ Règles: ${(err as Error).message}`);
    }

    // === STEP 5: SERVER SETTINGS ===
    try {
      // Set AFK channel
      const afkChannel = guild.channels.cache.find(
        (c) => c.name === '💤・AFK' && c.type === ChannelType.GuildVoice
      ) as { id: string } | undefined;
      if (afkChannel) {
        await guild.setAFKChannel(afkChannel.id, 'VOLT Setup');
        await guild.setAFKTimeout(300, 'VOLT Setup');
      }

      // Set system channel (for join/leave messages)
      const generalChannel = guild.channels.cache.find(
        (c) => c.name === '💬・général' && c.type === ChannelType.GuildText
      ) as { id: string } | undefined;
      if (generalChannel) {
        await guild.setSystemChannel(generalChannel.id);
      }

      log.push('✅ Paramètres serveur (AFK, système)');
    } catch (err) {
      log.push(`⚠️ Paramètres: ${(err as Error).message}`);
    }

    // === SUMMARY ===
    const summary = new EmbedBuilder()
      .setTitle('⚡ VOLT — Configuration terminée !')
      .setColor(0xFFD700)
      .setDescription(
        `**${categoryCount}** catégories | **${channelCount}** channels | **${roleCount}** rôles créés\n\n` +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      )
      .addFields(
        { name: '✅ Créé', value: log.filter((l) => l.startsWith('🆕')).join('\n').slice(0, 1024) || 'Rien de nouveau', inline: false },
        { name: '⏭️ Existant', value: log.filter((l) => l.startsWith('✅')).join('\n').slice(0, 1024) || '—', inline: false },
        { name: '⚠️ Erreurs', value: log.filter((l) => l.startsWith('⚠️')).join('\n').slice(0, 512) || 'Aucune 🎉', inline: false },
        {
          name: '🎯 Prochaines étapes',
          value: '1. **Déplace le rôle 🤖 Bot en haut** (pour que ses rôles priment)\n2. **Déplace ⚡ Fondateur tout en haut**\n3. **Vérifie l\'ordre des catégories** (drag & drop)\n4. **Invite tes premiers membres !**',
          inline: false,
        },
      )
      .setFooter({ text: '⚡ VOLT est prêt. Bon jeu !' })
      .setTimestamp();

    await interaction.editReply({ embeds: [summary] });
    logger.info({ guildId: guild.id, channelCount, roleCount }, 'VOLT setup completed');
  },
} as SlashCommand;
