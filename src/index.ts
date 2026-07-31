/**
 * NEXUS Bot — Entry point
 * A Discord roguelite bot with infinite replayability.
 */

import { Events, REST, Routes } from 'discord.js';
import { config } from './config.js';
import { NexusClient } from './client.js';
import { logger } from './logger.js';
import { loadCommands } from './handlers/commandHandler.js';
import { prisma } from './database.js';
import { redis } from './redis.js';

async function main() {
  logger.info('NEXUS Bot — Starting...');

  // Verify database connection
  await prisma.$connect();
  logger.info('Database connected');

  // Verify Redis connection
  await redis.ping();
  logger.info('Redis connected');

  // Create client
  const client = new NexusClient();

  // Load commands
  await loadCommands(client);

  // Register slash commands
  const rest = new REST({ version: '10' }).setToken(config.discord.token);
  const commandsData = Array.from(client.commands.values()).map((cmd) =>
    cmd.data.toJSON()
  );

  if (config.discord.guildId) {
    // Guild commands (instant update — dev mode)
    await rest.put(
      Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
      { body: commandsData }
    );
    logger.info({ guild: config.discord.guildId, count: commandsData.length }, 'Guild slash commands registered');
  } else {
    // Global commands (takes up to 1 hour to propagate)
    await rest.put(
      Routes.applicationCommands(config.discord.clientId),
      { body: commandsData }
    );
    logger.info({ count: commandsData.length }, 'Global slash commands registered');
  }

  // Event: ready
  client.once(Events.ClientReady, (c) => {
    logger.info({ user: c.user.tag, servers: c.guilds.cache.size }, '✅ NEXUS Bot is online!');
  });

  // Event: interaction create (slash commands)
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      logger.warn({ command: interaction.commandName }, 'Unknown command');
      return;
    }

    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error(
        { command: interaction.commandName, err: (err as Error).message },
        'Command execution error'
      );

      const errorMessage = {
        content: '❌ Une erreur est survenue lors de l\'exécution de la commande.',
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage).catch(() => {});
      } else {
        await interaction.reply(errorMessage).catch(() => {});
      }
    }
  });

  // Event: button interactions (class selection, combat actions)
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    // Handle class selection buttons
    if (interaction.customId.startsWith('descent_class_')) {
      const classId = interaction.customId.replace('descent_class_', '') as
        | 'warrior'
        | 'mage'
        | 'gambler'
        | 'rogue';

      try {
        const { startRun } = await import('./roguelite/engine.js');
        const { getOrCreateUser } = await import('./economy/user.js');

        await getOrCreateUser(interaction.user.id, interaction.user.username);
        const state = await startRun(interaction.user.id, classId);

        const { EmbedBuilder } = await import('discord.js');
        const embed = new EmbedBuilder()
          .setTitle(`🗡️ Descente Commencée — ${state.className}`)
          .setColor(0xe63946)
          .addFields(
            { name: '❤️ HP', value: `${state.hp}/${state.maxHp}`, inline: true },
            { name: '⚔️ ATK/🛡️ DEF', value: `${state.atk}/${state.def}`, inline: true },
            { name: '📦 Pacte', value: `${state.pactAmount.toString()} ¢`, inline: true },
            { name: '🎲 Seed', value: `\`${state.seed}\``, inline: true },
            {
              name: `🏠 Étage 1 — ${state.currentFloorEvent?.type?.toUpperCase() ?? '?'}`,
              value: 'Tape `/status` pour voir les détails. Bonne chance !',
              inline: false,
            }
          )
          .setFooter({ text: '/next pour descendre • /quit pour partir avec le pacte' });

        await interaction.update({ embeds: [embed], components: [] });
      } catch (err) {
        await interaction.reply({
          content: `❌ ${(err as Error).message}`,
          ephemeral: true,
        });
      }
    }
  });

  // Graceful shutdown
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

  // Login
  await client.login(config.discord.token);
}

main().catch((err) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'Fatal error during startup');
  process.exit(1);
});
