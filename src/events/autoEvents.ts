/**
 * NEXUS — Auto-Events System
 * Spontaneous events that keep the server alive and engaging.
 */

import { prisma } from '../database.js';
import { logger } from '../logger.js';
import { RNG } from '../roguelite/rng.js';
import type { TextChannel, Client, EmbedBuilder } from 'discord.js';

// ============================================================
//  FLASH DROP — coins appear in chat, first to react takes them
// ============================================================

export async function triggerFlashDrop(client: Client, channelId: string): Promise<void> {
  const channel = client.channels.cache.get(channelId) as TextChannel | undefined;
  if (!channel) return;

  const rng = new RNG(Date.now());
  const amount = rng.int(100, 500);

  const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = await import('discord.js');

  const embed = new EmbedBuilder()
    .setTitle('⚡ FLASH DROP !')
    .setColor(0xffd700)
    .setDescription(`**${amount} ¢** viennent d'apparaître !\nPremier qui clique les récupère !`)
    .setFooter({ text: 'Dépêche-toi !' })
    .setTimestamp();

  const button = new ButtonBuilder()
    .setCustomId(`nexus:flashdrop:claim`)
    .setLabel(`💰 Récupérer ${amount} ¢`)
    .setStyle(ButtonStyle.Success) as InstanceType<typeof ButtonBuilder>;

  const row = new ActionRowBuilder<typeof button>().addComponents(button);

  const message = await channel.send({ embeds: [embed], components: [row] });

  // Store the flash drop amount in Redis with the message ID
  const { redis } = await import('../redis.js');
  await redis.set(`flashdrop:${message.id}`, String(amount), 'EX', 60); // expires in 60s

  // Auto-disable after 60s
  setTimeout(async () => {
    try {
      await redis.del(`flashdrop:${message.id}`);
      await message.edit({
        embeds: [embed.setDescription('⏰ Trop tard ! Quelqu\'un a été plus rapide...').setColor(0x808080)],
        components: [],
      });
    } catch { /* message may be deleted */ }
  }, 60_000);

  logger.info({ channelId, amount }, 'Flash drop triggered');
}

// ============================================================
//  DAILY DIGEST — auto-posted recap every day at 18:00
// ============================================================

export async function postDailyDigest(client: Client, channelId: string): Promise<void> {
  const channel = client.channels.cache.get(channelId) as TextChannel | undefined;
  if (!channel) return;

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Gather stats
  const [
    totalRuns,
    totalDeaths,
    deepestRun,
    totalUsers,
    activeToday,
    raidBoss,
  ] = await Promise.all([
    prisma.run.count({ where: { startedAt: { gte: yesterday } } }),
    prisma.run.count({ where: { status: 'COMPLETED_DEAD', endedAt: { gte: yesterday } } }),
    prisma.run.findFirst({
      where: { status: 'COMPLETED_QUIT', endedAt: { gte: yesterday } },
      orderBy: { currentFloor: 'desc' },
      include: { user: true },
    }),
    prisma.user.count(),
    prisma.user.count({ where: { lastOnlineAt: { gte: yesterday } } }),
    prisma.raidBoss.findFirst({ where: { defeated: false }, orderBy: { createdAt: 'desc' } }),
  ]);

  // Top 3 runners today
  const topRunners = await prisma.user.findMany({
    where: { lastOnlineAt: { gte: yesterday } },
    orderBy: { totalRuns: 'desc' },
    take: 3,
  });

  const { EmbedBuilder } = await import('discord.js');
  const embed = new EmbedBuilder()
    .setTitle('📰 Journal de la Descente')
    .setColor(0x5865f2)
    .setDescription(`Récap des dernières 24h sur **VOLT**`)
    .addFields(
      { name: '📊 Activité', value: `${totalRuns} runs tentées\n${totalDeaths} morts\nRatio survie: ${totalRuns > 0 ? Math.round(((totalRuns - totalDeaths) / totalRuns) * 100) : 0}%`, inline: true },
      { name: '👥 Communauté', value: `${totalUsers} membres totaux\n${activeToday} actifs aujourd'hui`, inline: true },
      {
        name: '🏆 Record du jour',
        value: deepestRun
          ? `**${deepestRun.user?.username ?? 'Inconnu'}** a atteint l'**étage ${deepestRun.currentFloor}**`
          : 'Aucun record aujourd\'hui',
        inline: false,
      },
    );

  if (topRunners.length > 0) {
    const medals = ['🥇', '🥈', '🥉'];
    embed.addFields({
      name: '🔥 Les plus actifs',
      value: topRunners.map((u: typeof topRunners[number], i: number) => `${medals[i] ?? `${i+1}.`} **${u.username}** — ${u.totalRuns} runs`).join('\n'),
      inline: false,
    });
  }

  if (raidBoss) {
    const hpPct = Math.round((Number(raidBoss.hp) / Number(raidBoss.maxHp)) * 100);
    embed.addFields({
      name: `${raidBoss.emoji} Raid actif`,
      value: `**${raidBoss.name}** — ${hpPct}% HP restant`,
      inline: false,
    });
  }

  embed.setFooter({ text: '⚡ VOLT — Reviens demain pour ton dose de NEXUS' })
    .setTimestamp();

  await channel.send({ embeds: [embed] });
  logger.info('Daily digest posted');
}

// ============================================================
//  LIVE DASHBOARD — auto-updating stats message
// ============================================================

const DASHBOARD_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

export async function updateDashboard(client: Client, channelId: string, messageId: string): Promise<void> {
  const channel = client.channels.cache.get(channelId) as TextChannel | undefined;
  if (!channel) return;

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) {
    logger.warn({ messageId }, 'Dashboard message not found');
    return;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    totalUsers,
    onlineToday,
    runsToday,
    totalCoins,
    raidBoss,
    activeSeason,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { lastOnlineAt: { gte: todayStart } } }),
    prisma.run.count({ where: { startedAt: { gte: todayStart } } }),
    prisma.user.aggregate({ _sum: { coins: true } }),
    prisma.raidBoss.findFirst({ where: { defeated: false }, orderBy: { createdAt: 'desc' } }),
    prisma.season.findFirst({ where: { active: true }, orderBy: { id: 'desc' } }),
  ]);

  const deepestEver = await prisma.user.findFirst({ orderBy: { deepestFloor: 'desc' } });

  const { EmbedBuilder } = await import('discord.js');
  const embed = new EmbedBuilder()
    .setTitle('📊 Tableau de Bord VOLT')
    .setColor(0x2d1b4e)
    .setDescription(`Dernière mise à jour: <t:${Math.floor(Date.now() / 1000)}:R>`)
    .addFields(
      { name: '👥 Membres', value: `${totalUsers} total\n${onlineToday} aujourd'hui`, inline: true },
      { name: '🎮 Runs', value: `${runsToday} aujourd'hui`, inline: true },
      { name: '💸 Économie', value: `${Number(totalCoins._sum.coins ?? 0).toLocaleString()} ¢ en circulation`, inline: true },
    );

  if (deepestEver) {
    embed.addFields({
      name: '🏆 Record All-Time',
      value: `**${deepestEver.username}** — Étage ${deepestEver.deepestFloor}`,
      inline: false,
    });
  }

  if (raidBoss) {
    const hpPct = Math.round((Number(raidBoss.hp) / Number(raidBoss.maxHp)) * 100);
    embed.addFields({
      name: `${raidBoss.emoji} Raid`,
      value: `${raidBoss.name} — ${hpPct}% HP`,
      inline: true,
    });
  }

  if (activeSeason) {
    const daysLeft = Math.ceil((activeSeason.endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    embed.addFields({
      name: '📅 Saison',
      value: `${activeSeason.name}\n${daysLeft}j restants`,
      inline: true,
    });
  }

  embed.setFooter({ text: '⚡ VOLT — Mise à jour automatique toutes les 5 minutes' });

  await message.edit({ embeds: [embed] }).catch(() => {});
}

/**
 * Start the dashboard auto-update loop.
 * Call this on bot startup.
 */
export function startDashboardLoop(client: Client, channelId: string, messageId: string): void {
  setInterval(async () => {
    try {
      await updateDashboard(client, channelId, messageId);
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'Dashboard update failed');
    }
  }, DASHBOARD_UPDATE_INTERVAL);
  logger.info({ channelId, messageId, interval: '5min' }, 'Dashboard loop started');
}

// ============================================================
//  SCHEDULED EVENT CHECKER
// ============================================================

const AUTO_EVENT_CHANCE = 0.15; // 15% chance per check
const AUTO_EVENT_CHECK_INTERVAL = 4 * 60 * 60 * 1000; // Every 4 hours

/**
 * Start the auto-event scheduler.
 * Randomly triggers flash drops and other events.
 */
export function startAutoEventScheduler(client: Client, channelId: string): void {
  setInterval(async () => {
    try {
      const rng = new RNG(Date.now());
      if (rng.chance(AUTO_EVENT_CHANCE)) {
        await triggerFlashDrop(client, channelId);
      }
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'Auto-event scheduler error');
    }
  }, AUTO_EVENT_CHECK_INTERVAL);
  logger.info({ channelId, interval: '4h' }, 'Auto-event scheduler started');
}

/**
 * Start the daily digest scheduler.
 * Posts at 18:00 UTC every day.
 */
export function startDailyDigestScheduler(client: Client, channelId: string): void {
  const checkInterval = 60 * 60 * 1000; // Check every hour

  let lastDigestDate: string | null = null;

  setInterval(async () => {
    try {
      const now = new Date();
      const todayDate = now.toISOString().split('T')[0];

      // Post at 18:00 UTC
      if (now.getUTCHours() === 18 && lastDigestDate !== todayDate) {
        lastDigestDate = todayDate;
        await postDailyDigest(client, channelId);
      }
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'Daily digest scheduler error');
    }
  }, checkInterval);
  logger.info({ channelId, time: '18:00 UTC' }, 'Daily digest scheduler started');
}
