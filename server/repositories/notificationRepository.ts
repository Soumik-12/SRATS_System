import { getDatabase } from '../db/connection.js';
import type { Notification, AuditLog } from '../domain/entities.js';

export class NotificationRepository {
  private get db() {
    return getDatabase();
  }

  async findById(id: string): Promise<Notification | null> {
    return this.db.queryOne<Notification>('SELECT * FROM notifications WHERE id = ?;', [id]);
  }

  async create(
    notification: Omit<Notification, 'is_read' | 'created_at'>,
    txDb?: { execute: (sql: string, params?: unknown[]) => any }
  ): Promise<Notification> {
    const now = new Date().toISOString();
    const database = txDb || this.db;
    database.execute(
      `INSERT INTO notifications (id, user_id, type, title, message, is_read, entity_type, entity_id, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?);`,
      [
        notification.id,
        notification.user_id,
        notification.type,
        notification.title,
        notification.message,
        notification.entity_type || null,
        notification.entity_id || null,
        now,
      ]
    );
    return (await this.db.queryOne<Notification>(
      'SELECT * FROM notifications WHERE id = ?;',
      [notification.id]
    ))!;
  }

  async listByUser(userId: string, limit = 50, offset = 0): Promise<Notification[]> {
    return this.db.query<Notification>(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?;',
      [userId, limit, offset]
    );
  }

  async findRecentDuplicate(userId: string, type: string, entityId?: string | null): Promise<Notification | null> {
    if (!entityId) return null;
    return this.db.queryOne<Notification>(
      'SELECT * FROM notifications WHERE user_id = ? AND type = ? AND entity_id = ? ORDER BY created_at DESC LIMIT 1;',
      [userId, type, entityId]
    );
  }

  async getUnreadCount(userId: string): Promise<number> {
    const row = await this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0;',
      [userId]
    );
    return row?.count || 0;
  }

  async markAsRead(id: string, userId: string): Promise<boolean> {
    const result = this.db.execute(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?;',
      [id, userId]
    );
    return result.changes > 0;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = this.db.execute(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0;',
      [userId]
    );
    return result.changes;
  }
}

export class AuditLogRepository {
  private get db() {
    return getDatabase();
  }

  async log(audit: Omit<AuditLog, 'created_at'>): Promise<AuditLog> {
    const now = new Date().toISOString();
    this.db.execute(
      `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        audit.id,
        audit.actor_id || null,
        audit.action,
        audit.entity_type,
        audit.entity_id,
        audit.metadata_json || null,
        now,
      ]
    );
    return (await this.db.queryOne<AuditLog>(
      'SELECT * FROM audit_logs WHERE id = ?;',
      [audit.id]
    ))!;
  }

  async query(limit = 50, offset = 0): Promise<AuditLog[]> {
    return this.db.query<AuditLog>(
      'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?;',
      [limit, offset]
    );
  }

  async queryFiltered(filters: {
    actorId?: string;
    action?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<Array<AuditLog & { actor_email?: string | null; actor_role?: string | null }>> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.actorId) {
      conditions.push('a.actor_id = ?');
      params.push(filters.actorId);
    }

    if (filters.action) {
      conditions.push('a.action = ?');
      params.push(filters.action);
    }

    if (filters.entityType) {
      conditions.push('a.entity_type = ?');
      params.push(filters.entityType);
    }

    if (filters.startDate) {
      conditions.push('a.created_at >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push('a.created_at <= ?');
      params.push(filters.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    params.push(limit, offset);

    return this.db.query<AuditLog & { actor_email?: string | null; actor_role?: string | null }>(
      `SELECT a.id, a.actor_id, a.action, a.entity_type, a.entity_id, a.metadata_json, a.created_at,
              u.email AS actor_email,
              u.role AS actor_role
       FROM audit_logs a
       LEFT JOIN users u ON a.actor_id = u.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?;`,
      params
    );
  }

  async countFiltered(filters: {
    actorId?: string;
    action?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<number> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.actorId) {
      conditions.push('a.actor_id = ?');
      params.push(filters.actorId);
    }

    if (filters.action) {
      conditions.push('a.action = ?');
      params.push(filters.action);
    }

    if (filters.entityType) {
      conditions.push('a.entity_type = ?');
      params.push(filters.entityType);
    }

    if (filters.startDate) {
      conditions.push('a.created_at >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push('a.created_at <= ?');
      params.push(filters.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const row = this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count FROM audit_logs a ${whereClause};`,
      params
    );
    return row?.count || 0;
  }
}

export const notificationRepository = new NotificationRepository();
export const auditLogRepository = new AuditLogRepository();

