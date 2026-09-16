import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Factor III — Config: everything that varies between deployments lives in the
 * environment, validated once at boot. Production FAILS FAST on missing vars;
 * development/test get safe local defaults (with a loud warning for secrets).
 */
const DEV_DEFAULTS = {
  PORT: '5000',
  MONGO_URI: 'mongodb://localhost:27017/creditsea',
  JWT_SECRET: 'dev-secret-change-in-production',
  JWT_EXPIRES_IN: '7d',
  CORS_ORIGIN: 'http://localhost:3000',
  LOG_LEVEL: 'info',
  MAX_FILE_SIZE_MB: '5',
};

const raw = { ...process.env } as Record<string, string | undefined>;
const isProduction = raw.NODE_ENV === 'production';

if (!isProduction) {
  for (const [key, value] of Object.entries(DEV_DEFAULTS)) {
    if (raw[key] === undefined || raw[key] === '') {
      raw[key] = value;
    }
  }
  if (raw.JWT_SECRET === DEV_DEFAULTS.JWT_SECRET) {
    console.warn('[config] JWT_SECRET is using the development default - never do this outside local dev');
  }
}

const envSchema = z.object({
  PORT: z.coerce.number().int().positive(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().min(1).default('7d'),
  CORS_ORIGIN: z.string().min(1, 'CORS_ORIGIN is required'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().max(50),
});

const parsed = envSchema.safeParse(raw);

if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`[config] Invalid environment configuration${isProduction ? ' (production mode refuses to start)' : ''}:\n${details}`);
  process.exit(1);
}

const e = parsed.data;

export const env = {
  port: e.PORT,
  nodeEnv: e.NODE_ENV,
  isProduction: e.NODE_ENV === 'production',
  mongoUri: e.MONGO_URI,
  jwtSecret: e.JWT_SECRET,
  jwtExpiresIn: e.JWT_EXPIRES_IN,
  /** Factor IV — CORS surface is config, not code. */
  corsOrigins: e.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean),
  logLevel: e.LOG_LEVEL,
  maxFileSizeMb: e.MAX_FILE_SIZE_MB,
  uploadDir: path.resolve(__dirname, '../../uploads'),
};
