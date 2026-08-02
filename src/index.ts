/**
 * NEXUS Bot — Entry point
 * A Discord roguelite bot with infinite replayability.
 */

import { Events, REST, Routes } from 'discord.js';
import { config } from './config.js';
import { NexusClient } from './client.js';
import { logger } from './logger.js';
import { loadCommands } from './handlers/commandHandler.js';
import { checkCooldown } from './handlers/cooldown.js';
import { handleNexusButton, handlePuzzleTextAnswer } from './handlers/buttonHandler.js';
import { prisma } from './database.js';
import { redis } from './redis.js';

async function main() {
  logger.info('NEXUS Bot — Starting...');

  await prisma.$connect();
  logger.info('Database connected');

  await redis.ping();
  logger.info('Redis connected');

  const client = new NexusClient();
  await loadCommands(client);

  // === GLOBAL ERROR HANDLERS (infaillibilité) ===
  // WebSocket / shard errors
  client.on(Events.ShardError, (err) => {
    logger.error({ err: err.message, stack: err.stack }, 'WebSocket shard error');
  });

  // General client errors
  client.on(Events.Error, (err) => {
    logger.error({ err: err.message, stack: err.stack }, 'Client error');
  });

  // REST rate limit warnings
  client.rest.on('rateLimited' as never, ((info: { route: string; timeToReset: number }) => {
    logger.warn({ route: info.route, timeToReset: info.timeToReset }, 'Discord REST rate limited');
  }) as never);

  // Unhandled promise rejections — log but DON'T crash
  process.on('unhandledRejection', (reason: unknown) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    logger.error({ reason: msg, stack }, 'Unhandled promise rejection — bot staying alive');
  });

  // Uncaught exceptions — log but DON'T crash (the bot stays alive)
  process.on('uncaughtException', (err: Error) => {
    logger.error({ err: err.message, stack: err.stack }, 'Uncaught exception — bot staying alive');
  });


  // Register slash commands — resilient: try guild first, fallback to global, never crash
  const rest = new REST({ version: '10' }).setToken(config.discord.token);
  const commandsData = Array.from(client.commands.values()).map((cmd) => cmd.data.toJSON());

  if (config.discord.guildId) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
        { body: commandsData }
      );
      logger.info({ guild: config.discord.guildId, count: commandsData.length }, 'Guild slash commands registered');
    } catch (err) {
      logger.warn({ err: (err as Error).message, guild: config.discord.guildId }, 'Guild command registration failed — falling back to global');
      try {
        await rest.put(
          Routes.applicationCommands(config.discord.clientId),
          { body: commandsData }
        );
        logger.info({ count: commandsData.length }, 'Global slash commands registered (fallback)');
      } catch (err2) {
        logger.error({ err: (err2 as Error).message }, 'Global command registration also failed — continuing anyway');
      }
    }
  } else {
    try {
      await rest.put(
        Routes.applicationCommands(config.discord.clientId),
        { body: commandsData }
      );
      logger.info({ count: commandsData.length }, 'Global slash commands registered');
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'Global command registration failed — continuing anyway');
    }
  }

  // === EVENT: READY ===
  client.once(Events.ClientReady, (c) => {
    logger.info({ user: c.user.tag, servers: c.guilds.cache.size }, '✅ NEXUS Bot is online!');
  });

  // === EVENT: SLASH COMMANDS ===
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      logger.warn({ command: interaction.commandName }, 'Unknown command');
      return;
    }

    try {
      // Cooldown check (Redis-backed)
      const cooldown = await checkCooldown(interaction);
      if (!cooldown.allowed) {
        return interaction.reply({
          content: `⏳ Patiente **${cooldown.remaining}s** avant de réutiliser cette commande.`,
          ephemeral: true,
        });
      }

      await command.execute(interaction);
    } catch (err) {
      logger.error({ command: interaction.commandName, err: (err as Error).message }, 'Command execution error');
      const msg = { content: '❌ Une erreur est survenue.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg).catch(() => {});
      } else {
        await interaction.reply(msg).catch(() => {});
      }
    }
  });

  // === EVENT: BUTTON INTERACTIONS ===
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId.startsWith('nexus:')) {
      await handleNexusButton(interaction);
    }
  });

  // === EVENT: MESSAGE — puzzle answers (r: answer) ===
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    // Puzzle answer format: "r: <answer>"
    if (message.content.toLowerCase().startsWith('r:')) {
      const answer = message.content.slice(2).trim();
      if (!answer) return;

      try {
        const result = await handlePuzzleTextAnswer(message.author.id, answer);
        if (result) {
          await message.reply(result.message);
        }
      } catch (err) {
        logger.error({ err: (err as Error).message }, 'Puzzle answer error');
      }
    }
  });

  // === EVENT: CLASS SELECTION BUTTONS (from /descent without class option) ===
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('descent_class_')) return;

    const classId = interaction.customId.replace('descent_class_', '') as 'warrior' | 'mage' | 'gambler' | 'rogue';

    try {
      const { startRun } = await import('./roguelite/engine.js');
      const { getOrCreateUser } = await import('./economy/user.js');

      await getOrCreateUser(interaction.user.id, interaction.user.username);
      const state = await startRun(interaction.user.id, classId);

      const { renderFloorEmbed } = await import('./handlers/floorRenderer.js');
      const { embeds, components } = await renderFloorEmbed(state);
      await interaction.update({ embeds, components });
    } catch (err) {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: `❌ ${(err as Error).message}`, ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: `❌ ${(err as Error).message}`, ephemeral: true }).catch(() => {});
      }
    }
  });

  // === GRACEFUL SHUTDOWN ===
  process.on('SIGINT', async () => {
    logger.info('SIGINT received — shutting down...');
    await client.destroy();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received — shutting down...');
    await client.destroy();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  });

  await client.login(config.discord.token);
}

main().catch((err) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'Fatal error during startup');
  process.exit(1);
});
