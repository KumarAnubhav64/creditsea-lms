import express from 'express';
import type { Server } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { db } from './config/db';
import { logger } from './config/logger';
import authRoutes from './routes/auth';
import borrowerRoutes from './routes/borrower';
import loanRoutes from './routes/loans';
import dashboardRoutes from './routes/dashboard';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();

app.use(helmet());

// Factor IV — the CORS surface is environment config, not code.
// In production, reject requests if no origins are configured.
const corsOrigin = env.corsOrigins.length ? env.corsOrigins : (env.isProduction ? false : true);
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '1mb' }));

// Rate limiting on auth routes to prevent brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again later' },
});
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Rate limit exceeded, please slow down' },
});

// Factor XI — request logging as a structured stdout stream.
app.use(
  pinoHttp({
    logger,
    redact: { paths: ['req.headers.authorization', 'res.headers["set-cookie"]'], censor: '[REDACTED]' },
    autoLogging: { ignore: (req) => req.url === '/health' },
  })
);

app.get('/health', (_req, res) => {
  res.json({ status: db.isHealthy() ? 'ok' : 'degraded', uptime: process.uptime() });
});

app.use('/uploads', express.static(env.uploadDir));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/borrower', globalLimiter, borrowerRoutes);
app.use('/api/loans', globalLimiter, loanRoutes);
app.use('/api/dashboard', globalLimiter, dashboardRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

let server: Server;

async function main(): Promise<void> {
  if (!fs.existsSync(env.uploadDir)) {
    fs.mkdirSync(env.uploadDir, { recursive: true });
  }

  await db.connect();
  server = app.listen(env.port, () => {
    logger.info(`[api] CreditSea LMS listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

/** Factor IX — disposability: drain HTTP, then close the pool, then exit. */
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, '[api] shutting down gracefully');
  const forceExit = setTimeout(() => {
    logger.error('[api] graceful shutdown timed out after 10s - forcing exit');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  if (server) {
    server.close(async () => {
      await db.disconnect();
      process.exit(0);
    });
  } else {
    await db.disconnect();
    process.exit(0);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

// Crash loudly and observably rather than limping on in an undefined state.
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, '[api] unhandled promise rejection - initiating shutdown');
  void shutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, '[api] uncaught exception - exiting');
  // stdout writes to pipes/files are synchronous on POSIX, so the record
  // reaches the log stream before exit.
  process.exit(1);
});

main().catch((err) => {
  logger.fatal({ err }, 'Fatal startup error');
  process.exit(1);
});

export default app;
