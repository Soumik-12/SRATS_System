import { getDatabase } from '../db/connection.js';
import type { User, UserRole } from '../domain/entities.js';

export class UserRepository {
  private get db() {
    return getDatabase();
  }

  async findById(id: string): Promise<User | null> {
    return this.db.queryOne<User>(
      'SELECT * FROM users WHERE id = ? AND deleted_at IS NULL;',
      [id]
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.db.queryOne<User>(
      'SELECT * FROM users WHERE email = ? AND deleted_at IS NULL;',
      [email.toLowerCase().trim()]
    );
  }

  async create(
    user: Omit<User, 'is_active' | 'created_at' | 'updated_at' | 'deleted_at' | 'account_status'> & {
      account_status?: 'ACTIVE' | 'PENDING' | 'DEACTIVATED';
    }
  ): Promise<User> {
    const now = new Date().toISOString();
    const status = user.account_status || 'ACTIVE';
    this.db.execute(
      `INSERT INTO users (id, email, password_hash, role, account_status, first_name, last_name, company_id, is_active, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NULL);`,
      [
        user.id,
        user.email.toLowerCase().trim(),
        user.password_hash,
        user.role,
        status,
        user.first_name,
        user.last_name,
        user.company_id || null,
        now,
        now,
      ]
    );
    return (await this.findById(user.id))!;
  }

  async updateAccountStatus(id: string, status: 'ACTIVE' | 'PENDING' | 'DEACTIVATED'): Promise<boolean> {
    const now = new Date().toISOString();
    const res = this.db.execute(
      'UPDATE users SET account_status = ?, updated_at = ? WHERE id = ?;',
      [status, now, id]
    );
    return res.changes > 0;
  }

  async updateRole(id: string, role: UserRole): Promise<boolean> {
    const now = new Date().toISOString();
    const res = this.db.execute(
      'UPDATE users SET role = ?, updated_at = ? WHERE id = ?;',
      [role, now, id]
    );
    return res.changes > 0;
  }

  async countActiveAdmins(): Promise<number> {
    const row = this.db.queryOne<{ count: number }>(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'ADMIN' AND account_status = 'ACTIVE' AND is_active = 1 AND deleted_at IS NULL;"
    );
    return row?.count || 0;
  }

  async queryUsers(filters: {
    search?: string;
    role?: string;
    status?: string;
    companyId?: string;
    limit?: number;
    offset?: number;
  }): Promise<Array<Omit<User, 'password_hash'> & { company_name?: string | null }>> {
    const conditions: string[] = ['u.deleted_at IS NULL'];
    const params: unknown[] = [];

    if (filters.search) {
      const term = `%${filters.search.toLowerCase().trim()}%`;
      conditions.push('(LOWER(u.first_name) LIKE ? OR LOWER(u.last_name) LIKE ? OR LOWER(u.email) LIKE ?)');
      params.push(term, term, term);
    }

    if (filters.role) {
      conditions.push('u.role = ?');
      params.push(filters.role);
    }

    if (filters.status) {
      conditions.push('u.account_status = ?');
      params.push(filters.status);
    }

    if (filters.companyId) {
      conditions.push('u.company_id = ?');
      params.push(filters.companyId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    params.push(limit, offset);

    return this.db.query<Omit<User, 'password_hash'> & { company_name?: string | null }>(
      `SELECT u.id, u.email, u.role, u.account_status, u.first_name, u.last_name,
              u.company_id, u.is_active, u.created_at, u.updated_at,
              c.name AS company_name
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?;`,
      params
    );
  }

  async countUsers(filters: {
    search?: string;
    role?: string;
    status?: string;
    companyId?: string;
  }): Promise<number> {
    const conditions: string[] = ['u.deleted_at IS NULL'];
    const params: unknown[] = [];

    if (filters.search) {
      const term = `%${filters.search.toLowerCase().trim()}%`;
      conditions.push('(LOWER(u.first_name) LIKE ? OR LOWER(u.last_name) LIKE ? OR LOWER(u.email) LIKE ?)');
      params.push(term, term, term);
    }

    if (filters.role) {
      conditions.push('u.role = ?');
      params.push(filters.role);
    }

    if (filters.status) {
      conditions.push('u.account_status = ?');
      params.push(filters.status);
    }

    if (filters.companyId) {
      conditions.push('u.company_id = ?');
      params.push(filters.companyId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const row = this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count FROM users u ${whereClause};`,
      params
    );
    return row?.count || 0;
  }

  async updateCompany(id: string, companyId: string): Promise<boolean> {
    const now = new Date().toISOString();
    const res = this.db.execute(
      'UPDATE users SET company_id = ?, updated_at = ? WHERE id = ?;',
      [companyId, now, id]
    );
    return res.changes > 0;
  }

  async listByRole(role: UserRole): Promise<User[]> {
    return this.db.query<User>(
      'SELECT * FROM users WHERE role = ? AND deleted_at IS NULL ORDER BY created_at DESC;',
      [role]
    );
  }

  async listByCompany(companyId: string): Promise<User[]> {
    return this.db.query<User>(
      'SELECT * FROM users WHERE company_id = ? AND deleted_at IS NULL ORDER BY created_at DESC;',
      [companyId]
    );
  }

  async softDelete(id: string): Promise<boolean> {
    const now = new Date().toISOString();
    const result = this.db.execute(
      'UPDATE users SET is_active = 0, deleted_at = ?, updated_at = ? WHERE id = ?;',
      [now, now, id]
    );
    return result.changes > 0;
  }
}

export const userRepository = new UserRepository();
