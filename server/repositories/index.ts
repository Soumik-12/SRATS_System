import { getDatabase } from '../db/connection.js';
import type { DatabaseAdapter } from '../types/index.js';

export interface Repository<T, ID> {
  findById(id: ID): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<T>;
  deleteById(id: ID): Promise<boolean>;
}

export interface SystemMetadataEntity {
  key: string;
  value: string;
  updated_at: string;
}

export class SystemMetadataRepository {
  private get db(): DatabaseAdapter {
    return getDatabase();
  }

  async get(key: string): Promise<string | null> {
    const row = this.db.queryOne<SystemMetadataEntity>(
      'SELECT key, value, updated_at FROM system_metadata WHERE key = ?;',
      [key]
    );
    return row ? row.value : null;
  }

  async set(key: string, value: string): Promise<void> {
    const now = new Date().toISOString();
    this.db.execute(
      `INSERT INTO system_metadata (key, value, updated_at) 
       VALUES (?, ?, ?) 
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
      [key, value, now]
    );
  }

  async listAll(): Promise<SystemMetadataEntity[]> {
    return this.db.query<SystemMetadataEntity>(
      'SELECT key, value, updated_at FROM system_metadata ORDER BY key ASC;'
    );
  }
}

export const systemMetadataRepository = new SystemMetadataRepository();
