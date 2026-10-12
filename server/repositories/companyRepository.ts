import { getDatabase } from '../db/connection.js';
import type { Company, Department } from '../domain/entities.js';

export class CompanyRepository {
  private get db() {
    return getDatabase();
  }

  async findById(id: string): Promise<Company | null> {
    return this.db.queryOne<Company>('SELECT * FROM companies WHERE id = ?;', [id]);
  }

  async findByName(name: string): Promise<Company | null> {
    return this.db.queryOne<Company>('SELECT * FROM companies WHERE name = ?;', [name.trim()]);
  }

  async create(company: Omit<Company, 'is_active' | 'created_at' | 'updated_at'>): Promise<Company> {
    const now = new Date().toISOString();
    this.db.execute(
      `INSERT INTO companies (id, name, domain, industry, size, location, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?);`,
      [
        company.id,
        company.name.trim(),
        company.domain ?? null,
        company.industry ?? null,
        company.size ?? null,
        company.location ?? null,
        now,
        now,
      ]
    );
    return (await this.findById(company.id))!;
  }

  async listAll(): Promise<Company[]> {
    return this.db.query<Company>('SELECT * FROM companies WHERE is_active = 1 ORDER BY name ASC;');
  }

  async updateStatus(id: string, isActive: number): Promise<boolean> {
    const now = new Date().toISOString();
    const res = this.db.execute(
      'UPDATE companies SET is_active = ?, updated_at = ? WHERE id = ?;',
      [isActive, now, id]
    );
    return res.changes > 0;
  }

  async listAllAdmin(): Promise<Array<Company & { user_count: number; job_count: number }>> {
    return this.db.query<Company & { user_count: number; job_count: number }>(
      `SELECT c.*,
              COUNT(DISTINCT u.id) AS user_count,
              COUNT(DISTINCT j.id) AS job_count
       FROM companies c
       LEFT JOIN users u ON c.id = u.company_id AND u.deleted_at IS NULL
       LEFT JOIN jobs j ON c.id = j.company_id AND j.deleted_at IS NULL
       GROUP BY c.id
       ORDER BY c.name ASC;`
    );
  }
}

export class DepartmentRepository {
  private get db() {
    return getDatabase();
  }

  async findById(id: string): Promise<Department | null> {
    return this.db.queryOne<Department>('SELECT * FROM departments WHERE id = ?;', [id]);
  }

  async create(department: Omit<Department, 'created_at'>): Promise<Department> {
    const now = new Date().toISOString();
    this.db.execute(
      `INSERT INTO departments (id, company_id, name, created_at)
       VALUES (?, ?, ?, ?);`,
      [department.id, department.company_id, department.name.trim(), now]
    );
    return (await this.findById(department.id))!;
  }

  async listByCompany(companyId: string): Promise<Department[]> {
    return this.db.query<Department>(
      'SELECT * FROM departments WHERE company_id = ? ORDER BY name ASC;',
      [companyId]
    );
  }
}

export const companyRepository = new CompanyRepository();
export const departmentRepository = new DepartmentRepository();
