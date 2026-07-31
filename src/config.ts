import dotenv from 'dotenv';

dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  discord: {
    token: required('DISCORD_TOKEN'),
    clientId: required('DISCORD_CLIENT_ID'),
    owners: (process.env.OWNERS ?? '').split(',').filter(Boolean),
    guildId: process.env.GUILD_ID || undefined, // dev guild for instant slash registration
  },
  database: {
    url: required('DATABASE_URL'),
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  debug: process.env.DEBUG === 'true',
  logLevel: process.env.LOG_LEVEL || 'info',
} as const;
