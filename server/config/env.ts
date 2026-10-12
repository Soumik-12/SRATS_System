import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import type { AppConfig, Environment } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from project root if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function parsePort(val: string | undefined, defaultPort: number): number {
  if (!val) return defaultPort;
  const parsed = parseInt(val, 10);
  if (isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid PORT configuration: "${val}". Port must be a number between 1 and 65535.`);
  }
  return parsed;
}

function parseModel(val: string | undefined): string {
  if (!val || typeof val !== 'string') return 'gemini-3.8-flash';
  const trimmed = val.trim();
  if (trimmed.startsWith('gemini-') || trimmed.startsWith('veo-') || trimmed.startsWith('lyria-')) {
    return trimmed;
  }
  return 'gemini-3.8-flash';
}

export function loadConfig(): AppConfig {
  const env: Environment = (process.env.NODE_ENV as Environment) || 'development';
  const port = parsePort(process.env.PORT, 3000);
  const host = process.env.HOST || '0.0.0.0';

  const databaseType = (process.env.DATABASE_TYPE as 'sqlite' | 'mysql' | 'postgres') || 'sqlite';
  const databaseUrl = process.env.DATABASE_URL || (env === 'test' ? ':memory:' : './srats.db');

  const geminiModel = parseModel(process.env.GEMINI_MODEL);
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);

  const corsOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : ['*'];

  const jwtSecret = process.env.JWT_SECRET || 'srats-dev-secret-key-must-be-min-32-chars-long-2026';
  const adminBootstrapEmail = process.env.SRATS_ADMIN_BOOTSTRAP_EMAIL || 'admin@srats.system';
  const adminBootstrapPassword = process.env.SRATS_ADMIN_BOOTSTRAP_PASSWORD || 'SratsAdminSecure2026!';

  const storageDir = process.env.STORAGE_DIR
    ? path.resolve(process.env.STORAGE_DIR)
    : path.resolve(__dirname, '../../storage/resumes');

  return {
    env,
    port,
    host,
    databaseUrl,
    databaseType,
    geminiModel,
    hasGeminiKey,
    corsOrigins,
    jwtSecret,
    adminBootstrapEmail,
    adminBootstrapPassword,
    storageDir,
  };
}

export const config = loadConfig();
