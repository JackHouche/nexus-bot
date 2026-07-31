/**
 * Command registry — auto-loads all slash commands from the commands/ directory.
 */

import { readdirSync } from 'fs';
import { pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { NexusClient } from '../client.js';
import type { SlashCommand } from '../types.js';
import { logger } from '../logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadCommands(client: NexusClient): Promise<void> {
  const commandsDir = join(__dirname, 'commands');
  let count = 0;

  const categories = readdirSync(commandsDir);
  for (const category of categories) {
    const categoryPath = join(commandsDir, category);
    try {
      const stats = await import('fs').then((fs) => fs.statSync(categoryPath));
      if (!stats.isDirectory()) continue;
    } catch {
      continue;
    }

    const files = readdirSync(categoryPath).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));
    for (const file of files) {
      const filePath = pathToFileURL(join(categoryPath, file)).href;
      const mod = await import(filePath);
      const command: SlashCommand | undefined = mod.default ?? mod.command;

      if (!command?.data || !command?.execute) {
        logger.warn({ file }, 'Command missing data/execute, skipping');
        continue;
      }

      client.commands.set(command.data.name, command);
      count++;
      logger.debug({ name: command.data.name, category }, 'Loaded command');
    }
  }

  logger.info({ count }, 'Commands loaded');
}
