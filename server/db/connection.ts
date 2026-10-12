import { DatabaseSync } from 'node:sqlite';
import { logger } from '../utils/logger.js';
import type { DatabaseAdapter } from '../types/index.js';

class SQLiteDatabaseAdapter implements DatabaseAdapter {
  private db: DatabaseSync;
  private readonly location: string;

  constructor(location: string) {
    this.location = location;
    this.db = new DatabaseSync(location);
    // Mandatory: Enforce foreign key constraints on every connection
    this.db.exec('PRAGMA foreign_keys = ON;');
    if (location !== ':memory:') {
      this.db.exec('PRAGMA journal_mode = WAL;');
    }
    logger.info('Database connection established', {
      type: 'sqlite',
      location: location === ':memory:' ? ':memory:' : '[file]',
    });
  }

  query<T = unknown>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.db.prepare(sql);
    const results = stmt.all(...(params as any[]));
    return results as T[];
  }

  queryOne<T = unknown>(sql: string, params: unknown[] = []): T | null {
    const results = this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  execute(sql: string, params: unknown[] = []): { changes: number; lastInsertRowid: number | bigint } {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...(params as any[]));
    return {
      changes: typeof result.changes === 'number' ? result.changes : 0,
      lastInsertRowid: result.lastInsertRowid,
    };
  }

  execScript(sql: string): void {
    this.db.exec(sql);
  }

  async ping(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = performance.now();
    try {
      const res = this.queryOne<{ ping: number }>('SELECT 1 AS ping;');
      const latencyMs = Math.round((performance.now() - start) * 100) / 100;
      return { ok: res?.ping === 1, latencyMs };
    } catch (err) {
      const latencyMs = Math.round((performance.now() - start) * 100) / 100;
      logger.error('Database ping failed', err);
      return { ok: false, latencyMs };
    }
  }

  close(): void {
    try {
      this.db.close();
      logger.info('Database connection closed');
    } catch (err) {
      logger.error('Error closing database connection', err);
    }
  }
}

let activeAdapter: DatabaseAdapter | null = null;

export function initDatabase(dbUrl: string): DatabaseAdapter {
  if (activeAdapter) {
    return activeAdapter;
  }
  activeAdapter = new SQLiteDatabaseAdapter(dbUrl);
  return activeAdapter;
}

export function getDatabase(): DatabaseAdapter {
  if (!activeAdapter) {
    throw new Error('Database has not been initialized. Call initDatabase() first.');
  }
  return activeAdapter;
}

export function closeDatabase(): void {
  if (activeAdapter) {
    activeAdapter.close();
    activeAdapter = null;
  }
}
