import { getDatabase } from '../db/connection.js';

export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at_utc: string;
  revoked_at_utc: string | null;
  created_at: string;
  replaced_by_token_id: string | null;
}

export class RefreshTokenRepository {
  private get db() {
    return getDatabase();
  }

  async create(token: {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at_utc: string;
  }): Promise<RefreshTokenRecord> {
    const now = new Date().toISOString();
    this.db.execute(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at_utc, revoked_at_utc, created_at, replaced_by_token_id)
       VALUES (?, ?, ?, ?, NULL, ?, NULL);`,
      [token.id, token.user_id, token.token_hash, token.expires_at_utc, now]
    );

    return (await this.db.queryOne<RefreshTokenRecord>(
      'SELECT * FROM refresh_tokens WHERE id = ?;',
      [token.id]
    ))!;
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return this.db.queryOne<RefreshTokenRecord>(
      'SELECT * FROM refresh_tokens WHERE token_hash = ?;',
      [tokenHash]
    );
  }

  async revoke(id: string, replacedByTokenId?: string): Promise<boolean> {
    const now = new Date().toISOString();
    const result = this.db.execute(
      'UPDATE refresh_tokens SET revoked_at_utc = ?, replaced_by_token_id = ? WHERE id = ? AND revoked_at_utc IS NULL;',
      [now, replacedByTokenId || null, id]
    );
    return result.changes > 0;
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const now = new Date().toISOString();
    const result = this.db.execute(
      'UPDATE refresh_tokens SET revoked_at_utc = ? WHERE user_id = ? AND revoked_at_utc IS NULL;',
      [now, userId]
    );
    return result.changes;
  }
}

export const refreshTokenRepository = new RefreshTokenRepository();
