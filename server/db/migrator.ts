import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getDatabase } from './connection.js';
import { logger } from '../utils/logger.js';
import type { DatabaseAdapter } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MigrationRecord {
  version: string;
  name: string;
  applied_at: string;
  checksum: string;
}

export function runMigrations(customMigrationsDir?: string): MigrationRecord[] {
  const db = getDatabase();
  const migrationsDir = customMigrationsDir || path.resolve(__dirname, '../../migrations');

  // Ensure schema_migrations table exists
  db.execScript(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at VARCHAR(50) NOT NULL,
      checksum VARCHAR(64) NOT NULL
    );
  `);

  if (!fs.existsSync(migrationsDir)) {
    logger.warn(`Migrations directory not found at: ${migrationsDir}`);
    return [];
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => {
      const getVersion = (name: string) => {
        const match = name.match(/^V(\d+)/i);
        return match ? parseInt(match[1], 10) : 0;
      };
      return getVersion(a) - getVersion(b);
    });

  const appliedRows = db.query<MigrationRecord>('SELECT version, name, applied_at, checksum FROM schema_migrations;');
  const appliedSet = new Map<string, MigrationRecord>(appliedRows.map((r) => [r.version, r]));

  const newlyApplied: MigrationRecord[] = [];

  for (const file of files) {
    const match = file.match(/^V(\d+(?:_\d+)*)__(.+)\.sql$/i);
    if (!match) {
      logger.warn(`Ignoring non-standard migration file: ${file}`);
      continue;
    }

    const version = match[1];
    const name = match[2];
    const fullPath = path.join(migrationsDir, file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const checksum = crypto.createHash('sha256').update(content).digest('hex');

    if (appliedSet.has(version)) {
      const existing = appliedSet.get(version)!;
      if (existing.checksum !== checksum) {
        throw new Error(
          `Migration checksum mismatch for version ${version} (${file}). Database migration history has been tampered with.`
        );
      }
      continue;
    }

    logger.info(`Applying migration: ${file}`);
    db.execScript('BEGIN IMMEDIATE TRANSACTION;');
    try {
      db.execScript(content);
      const appliedAt = new Date().toISOString();
      db.execute(
        'INSERT INTO schema_migrations (version, name, applied_at, checksum) VALUES (?, ?, ?, ?);',
        [version, name, appliedAt, checksum]
      );
      db.execScript('COMMIT;');

      const record: MigrationRecord = { version, name, applied_at: appliedAt, checksum };
      newlyApplied.push(record);
      logger.info(`Successfully applied migration: ${file}`);
    } catch (err) {
      db.execScript('ROLLBACK;');
      logger.error(`Migration failed: ${file}`, err);
      throw new Error(`Migration ${file} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return newlyApplied;
}
