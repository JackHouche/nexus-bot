import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.DEBUG === 'true' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
});
