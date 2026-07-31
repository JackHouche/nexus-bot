import type {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';

export interface SlashCommand {
  data: SlashCommandBuilder; // or any SlashCommandBuilder subclass with toJSON
  execute: (interaction: ChatInputCommandInteraction) => Promise<unknown>;
}
