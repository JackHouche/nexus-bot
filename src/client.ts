import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import type { SlashCommand } from './types.js';

export class NexusClient extends Client {
  commands = new Collection<string, SlashCommand>();

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Message, Partials.Channel, Partials.Reaction],
    });
  }
}
