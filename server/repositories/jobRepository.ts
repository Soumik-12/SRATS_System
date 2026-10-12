import { getDatabase } from '../db/connection.js';
import { AppError } from '../middleware/errorHandler.js';
import type { Job, JobStatus, EmploymentType, ExperienceLevel } from '../domain/entities.js';

export interface JobWithDetails extends Job {
  company_name?: string;
  company_location?: string;
  department_name?: string;
}

export interface PublicJob {
  id: string;
  title: string;
  company_name: string;
  company_location?: string;
  department_name: string;
  location: string;
  employment_type: EmploymentType;
  experience_level: ExperienceLevel;
  description: string;
  requirements: string;
  salary_min: number | null;
  salary_max: number | null;
  status: 'PUBLISHED' | 'CLOSED';
  deadline_utc: string | null;
  created_at: string;
}

export interface JobSearchParams {
  query?: string;
  location?: string;
  employment_type?: string;
  experience_level?: string;
  company_id?: string;
  department_id?: string;
  sort?: string;
  page?: number;
  size?: number;
}

const ALLOWED_SORTS: Record<string, string> = {
  newest: 'ORDER BY j.created_at DESC',
  oldest: 'ORDER BY j.created_at ASC',
  deadline: 'ORDER BY j.deadline_utc ASC NULLS LAST',
  title: 'ORDER BY j.title ASC',
  title_desc: 'ORDER BY j.title DESC',
  salary_desc: 'ORDER BY j.salary_max DESC NULLS LAST',
};

export class JobRepository {
  private get db() {
    return getDatabase();
  }

  async findById(id: string): Promise<Job | null> {
    return this.db.queryOne<Job>(
      'SELECT * FROM jobs WHERE id = ? AND deleted_at IS NULL;',
      [id]
    );
  }

  async findByIdWithDetails(id: string): Promise<JobWithDetails | null> {
    return this.db.queryOne<JobWithDetails>(
      `SELECT j.*, c.name AS company_name, c.location AS company_location, d.name AS department_name
       FROM jobs j
       LEFT JOIN companies c ON j.company_id = c.id
       LEFT JOIN departments d ON j.department_id = d.id
       WHERE j.id = ? AND j.deleted_at IS NULL;`,
      [id]
    );
  }

  async create(job: Omit<Job, 'is_active' | 'created_at' | 'updated_at' | 'deleted_at'>): Promise<Job> {
    const now = new Date().toISOString();
    this.db.execute(
      `INSERT INTO jobs (
        id, company_id, department_id, created_by, title, description, requirements,
        location, employment_type, experience_level, salary_min, salary_max,
        status, deadline_utc, is_active, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NULL);`,
      [
        job.id,
        job.company_id,
        job.department_id,
        job.created_by,
        job.title.trim(),
        job.description,
        job.requirements,
        job.location,
        job.employment_type,
        job.experience_level,
        job.salary_min ?? null,
        job.salary_max ?? null,
        job.status,
        job.deadline_utc ?? null,
        now,
        now,
      ]
    );
    return (await this.findById(job.id))!;
  }

  async update(
    id: string,
    updates: Partial<Omit<Job, 'id' | 'company_id' | 'created_by' | 'created_at' | 'deleted_at'>>
  ): Promise<Job> {
    const now = new Date().toISOString();
    const fields: string[] = ['updated_at = ?'];
    const values: unknown[] = [now];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title.trim());
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.requirements !== undefined) {
      fields.push('requirements = ?');
      values.push(updates.requirements);
    }
    if (updates.location !== undefined) {
      fields.push('location = ?');
      values.push(updates.location);
    }
    if (updates.employment_type !== undefined) {
      fields.push('employment_type = ?');
      values.push(updates.employment_type);
    }
    if (updates.experience_level !== undefined) {
      fields.push('experience_level = ?');
      values.push(updates.experience_level);
    }
    if (updates.department_id !== undefined) {
      fields.push('department_id = ?');
      values.push(updates.department_id);
    }
    if (updates.salary_min !== undefined) {
      fields.push('salary_min = ?');
      values.push(updates.salary_min ?? null);
    }
    if (updates.salary_max !== undefined) {
      fields.push('salary_max = ?');
      values.push(updates.salary_max ?? null);
    }
    if (updates.deadline_utc !== undefined) {
      fields.push('deadline_utc = ?');
      values.push(updates.deadline_utc ?? null);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }

    values.push(id);
    this.db.execute(
      `UPDATE jobs SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL;`,
      values
    );

    return (await this.findById(id))!;
  }

  async updateStatus(id: string, newStatus: JobStatus): Promise<boolean> {
    const now = new Date().toISOString();
    const result = this.db.execute(
      'UPDATE jobs SET status = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL;',
      [newStatus, now, id]
    );
    return result.changes > 0;
  }

  /**
   * Search published jobs only (Master Prompt Non-Negotiable Rule:
   * Draft jobs NEVER appear in public job discovery; Closed jobs reject new applications).
   */
  async searchPublished(params: JobSearchParams = {}): Promise<{ jobs: JobWithDetails[]; total: number }> {
    const page = Math.max(0, Number(params.page) || 0);
    const size = Math.min(100, Math.max(1, Number(params.size) || 20));
    const offset = page * size;

    const sortKey = (params.sort || 'newest').trim().toLowerCase();
    const sortClause = ALLOWED_SORTS[sortKey];
    if (!sortClause) {
      throw new AppError(
        400,
        'INVALID_SORT_FIELD',
        `Sort parameter "${params.sort}" is invalid. Allowed sorts: ${Object.keys(ALLOWED_SORTS).join(', ')}`
      );
    }

    let whereClause = "WHERE j.status = 'PUBLISHED' AND j.is_active = 1 AND j.deleted_at IS NULL";
    const queryParams: unknown[] = [];

    if (params.query && params.query.trim()) {
      whereClause += ' AND (j.title LIKE ? OR j.description LIKE ? OR j.requirements LIKE ? OR c.name LIKE ? OR j.location LIKE ?)';
      const term = `%${params.query.trim()}%`;
      queryParams.push(term, term, term, term, term);
    }
    if (params.location && params.location.trim()) {
      whereClause += ' AND j.location LIKE ?';
      queryParams.push(`%${params.location.trim()}%`);
    }
    if (params.employment_type && params.employment_type.trim()) {
      whereClause += ' AND j.employment_type = ?';
      queryParams.push(params.employment_type.trim());
    }
    if (params.experience_level && params.experience_level.trim()) {
      whereClause += ' AND j.experience_level = ?';
      queryParams.push(params.experience_level.trim());
    }
    if (params.company_id && params.company_id.trim()) {
      whereClause += ' AND j.company_id = ?';
      queryParams.push(params.company_id.trim());
    }
    if (params.department_id && params.department_id.trim()) {
      whereClause += ' AND j.department_id = ?';
      queryParams.push(params.department_id.trim());
    }

    const countRow = this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM jobs j
       LEFT JOIN companies c ON j.company_id = c.id
       LEFT JOIN departments d ON j.department_id = d.id
       ${whereClause};`,
      queryParams
    );
    const total = countRow ? countRow.count : 0;

    const jobs = this.db.query<JobWithDetails>(
      `SELECT j.*, c.name AS company_name, c.location AS company_location, d.name AS department_name
       FROM jobs j
       LEFT JOIN companies c ON j.company_id = c.id
       LEFT JOIN departments d ON j.department_id = d.id
       ${whereClause}
       ${sortClause}
       LIMIT ? OFFSET ?;`,
      [...queryParams, size, offset]
    );

    return { jobs, total };
  }

  async listByCompany(companyId: string, status?: string): Promise<JobWithDetails[]> {
    let whereClause = 'WHERE j.company_id = ? AND j.deleted_at IS NULL';
    const params: unknown[] = [companyId];

    if (status && status !== 'ALL') {
      whereClause += ' AND j.status = ?';
      params.push(status);
    }

    return this.db.query<JobWithDetails>(
      `SELECT j.*, c.name AS company_name, d.name AS department_name
       FROM jobs j
       LEFT JOIN companies c ON j.company_id = c.id
       LEFT JOIN departments d ON j.department_id = d.id
       ${whereClause}
       ORDER BY j.created_at DESC;`,
      params
    );
  }

  async softDelete(id: string): Promise<boolean> {
    const now = new Date().toISOString();
    const result = this.db.execute(
      'UPDATE jobs SET is_active = 0, deleted_at = ? WHERE id = ?;',
      [now, id]
    );
    return result.changes > 0;
  }
}

export const jobRepository = new JobRepository();
