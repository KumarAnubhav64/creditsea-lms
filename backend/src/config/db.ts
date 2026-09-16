import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

/**
 * Pool tuning (defaults in parentheses):
 *   maxPoolSize   (100)  hard cap on concurrent sockets — each socket holds a
 *                         server connection; size for (concurrent requests ×
 *                         queries per request), with headroom for transactions
 *   minPoolSize   (0)    warm sockets kept open so bursts don't pay TCP +
 *                         auth handshake latency; set > 0 only when traffic is
 *                         steady (wastes server connections if idle)
 *   maxIdleTimeMS —      reap sockets idle longer than this; protects the
 *                         server from lingering connections behind load
 *                         balancers / after traffic dips
 *   serverSelectionTimeoutMS (30s) how long to wait for a usable server
 *                         before failing the operation; shortened so startup
 *                         fails fast when Mongo is down
 *
 * Mongoose reuses ONE connection pool per process, shared by every model —
 * repositories never open connections themselves.
 */
const POOL_OPTIONS: mongoose.ConnectOptions = {
  maxPoolSize: env.isProduction ? 100 : 20,
  minPoolSize: env.isProduction ? 5 : 1,
  maxIdleTimeMS: 30_000,
  serverSelectionTimeoutMS: 5_000,
  socketTimeoutMS: 45_000,
};

/**
 * Database lifecycle management — the single place Mongo connections are
 * opened, monitored, pooled, and closed. Everything else just uses the pool.
 */
export const db = {
  async connect(): Promise<void> {
    if (mongoose.connection.readyState === 1) return;

    mongoose.connection.on('connected', () => {
      logger.info(
        { db: mongoose.connection.name, pool: { min: POOL_OPTIONS.minPoolSize, max: POOL_OPTIONS.maxPoolSize } },
        '[db] connected'
      );
    });
    mongoose.connection.on('error', (err) => logger.error({ err }, '[db] connection error'));
    mongoose.connection.on('disconnected', () => logger.warn('[db] disconnected'));

    if (env.nodeEnv === 'development') {
      mongoose.set('debug', (coll: string, method: string) => {
        if (coll.startsWith('system.')) return;
        logger.debug({ coll, method }, '[db] query');
      });
    }

    await mongoose.connect(env.mongoUri, POOL_OPTIONS);
  },

  async disconnect(): Promise<void> {
    if (mongoose.connection.readyState === 0) return;
    await mongoose.disconnect();
    logger.info('[db] connection closed');
  },

  async dropDatabase(): Promise<void> {
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Cannot drop database - not connected');
    }
    await mongoose.connection.dropDatabase();
    logger.warn('[db] database dropped');
  },

  isHealthy(): boolean {
    return mongoose.connection.readyState === 1;
  },
};
