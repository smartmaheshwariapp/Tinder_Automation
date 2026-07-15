/**
 * logger.js
 * Structured logger using pino. All modules import from here.
 * In production: JSON output. In dev: pretty-printed with pino-pretty.
 */

import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
});

/**
 * Returns a child logger scoped to a specific module + userId.
 * Usage: const log = childLogger('browser-factory', userId);
 */
export function childLogger(module, userId = null) {
  return logger.child({ module, ...(userId && { userId: userId.slice(0, 8) }) });
}

export default logger;
