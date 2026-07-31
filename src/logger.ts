import pino from 'pino';

const transport = pino.transport({
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'pid,hostname',
  },
});

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
  },
  transport
);
