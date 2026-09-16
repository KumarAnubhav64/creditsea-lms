import pino from 'pino';
import { env } from './env';

/**
 * Factor XI — Logs: one pino instance emitting structured JSON to STDOUT only.
 * No log files, no log rotation — a log router (Docker, journald, CloudWatch…)
 * owns what happens to the stream. Level + format are environment config.
 */
export const logger = pino({
  level: env.logLevel,
  base: { service: 'creditsea-api', env: env.nodeEnv },
  redact: { paths: ['req.headers.authorization', 'password', 'passwordHash'], censor: '[REDACTED]' },
  ...(env.isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname,service,env' },
        },
      }),
});
