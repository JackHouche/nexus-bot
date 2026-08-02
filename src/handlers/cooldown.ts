import { setCooldown, getCooldown } from '../redis.js';
import type { ChatInputCommandInteraction } from 'discord.js';

const DEFAULT_COOLDOWNS: Record<string, number> = {
  descent: 5,      // 5 seconds
  next: 3,
  quit: 5,
  status: 5,
  balance: 10,
  daily: 0,        // handled by DB
  profile: 10,
  leaderboard: 15,
  market: 5,
  raid: 10,
  setup: 60,
};

export async function checkCooldown(
  interaction: ChatInputCommandInteraction
): Promise<{ allowed: boolean; remaining?: number }> {
  const cmd = interaction.commandName;
  const seconds = DEFAULT_COOLDOWNS[cmd];
  if (!seconds || seconds === 0) return { allowed: true };

  const userId = interaction.user.id;
  const remaining = await getCooldown(userId, cmd);
  if (remaining > 0) return { allowed: false, remaining };

  await setCooldown(userId, cmd, seconds);
  return { allowed: true };
}
