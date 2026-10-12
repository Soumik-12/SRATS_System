import { getDatabase } from '../db/connection.js';
import { withTransaction } from '../db/transactions.js';
import type { Application, ApplicationStatus, ApplicationStatusHistory } from '../domain/entities.js';

export interface ApplicationWithDetails extends Application {
  job_title: string;
  company_id: string;
  company_name: string;
  department_name: string;
  job_location: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone?: string | null;
  applicant_headline?: string | null;
  applicant_location?: string | null;
  resume_file_name: string;
  resume_file_size: number;
  resume_file_mime: string;
  resume_storage_path?: string;
}

export interface ApplicationStatusHistoryWithActor extends ApplicationStatusHistory {
  actor_name?: string;
  actor_role?: string;
}

export class ApplicationRepository {
  private get db() {
    return getDatabase();
  }

  async findById(id: string): Promise<Application | null> {
    return this.db.queryOne<Application>('SELECT * FROM applications WHERE id = ?;', [id]);
  }

  async findByIdWithDetails(id: string): Promise<ApplicationWithDetails | null> {
    return this.db.queryOne<ApplicationWithDetails>(
      `SELECT 
        a.*,
        j.title AS job_title,
        j.company_id AS company_id,
        c.name AS company_name,
        d.name AS department_name,
        j.location AS job_location,
        (u.first_name || ' ' || u.last_name) AS applicant_name,
        u.email AS applicant_email,
        p.phone AS applicant_phone,
        p.headline AS applicant_headline,
        p.location AS applicant_location,
        r.file_name AS resume_file_name,
        r.file_size AS resume_file_size,
        r.file_mime AS resume_file_mime,
        r.storage_path AS resume_storage_path
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       JOIN companies c ON j.company_id = c.id
       JOIN departments d ON j.department_id = d.id
       JOIN users u ON a.applicant_id = u.id
       LEFT JOIN applicant_profiles p ON a.applicant_id = p.user_id
       JOIN resumes r ON a.resume_id = r.id
       WHERE a.id = ?;`,
      [id]
    );
  }

  async findByJobAndApplicant(jobId: string, applicantId: string): Promise<Application | null> {
    return this.db.queryOne<Application>(
      'SELECT * FROM applications WHERE job_id = ? AND applicant_id = ?;',
      [jobId, applicantId]
    );
  }

  async create(app: Omit<Application, 'applied_at' | 'updated_at'>): Promise<Application> {
    return withTransaction(({ db: txDb }) => {
      const now = new Date().toISOString();
      txDb.execute(
        `INSERT INTO applications (id, job_id, applicant_id, resume_id, status, cover_letter, applied_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [app.id, app.job_id, app.applicant_id, app.resume_id, app.status, app.cover_letter || null, now, now]
      );

      // Record initial status history event atomically
      const historyId = `hist-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
      txDb.execute(
        `INSERT INTO application_status_history (id, application_id, from_status, to_status, changed_by, note, changed_at)
         VALUES (?, ?, NULL, ?, ?, ?, ?);`,
        [historyId, app.id, app.status, app.applicant_id, 'Application submitted by candidate', now]
      );

      return (txDb.queryOne<Application>('SELECT * FROM applications WHERE id = ?;', [app.id]))!;
    });
  }

  async updateStatus(
    id: string,
    toStatus: ApplicationStatus,
    changedBy: string,
    note?: string
  ): Promise<Application> {
    return withTransaction(({ db: txDb }) => {
      const current = txDb.queryOne<Application>('SELECT * FROM applications WHERE id = ?;', [id]);
      if (!current) {
        throw new Error(`Application ${id} not found.`);
      }

      const now = new Date().toISOString();
      txDb.execute('UPDATE applications SET status = ?, updated_at = ? WHERE id = ?;', [
        toStatus,
        now,
        id,
      ]);

      const historyId = `hist-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
      txDb.execute(
        `INSERT INTO application_status_history (id, application_id, from_status, to_status, changed_by, note, changed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [historyId, id, current.status, toStatus, changedBy, note || null, now]
      );

      return (txDb.queryOne<Application>('SELECT * FROM applications WHERE id = ?;', [id]))!;
    });
  }

  async listByApplicant(applicantId: string): Promise<Application[]> {
    return this.db.query<Application>(
      'SELECT * FROM applications WHERE applicant_id = ? ORDER BY applied_at DESC;',
      [applicantId]
    );
  }

  async listByApplicantWithDetails(applicantId: string): Promise<ApplicationWithDetails[]> {
    return this.db.query<ApplicationWithDetails>(
      `SELECT 
        a.*,
        j.title AS job_title,
        j.company_id AS company_id,
        c.name AS company_name,
        d.name AS department_name,
        j.location AS job_location,
        (u.first_name || ' ' || u.last_name) AS applicant_name,
        u.email AS applicant_email,
        p.phone AS applicant_phone,
        p.headline AS applicant_headline,
        p.location AS applicant_location,
        r.file_name AS resume_file_name,
        r.file_size AS resume_file_size,
        r.file_mime AS resume_file_mime
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       JOIN companies c ON j.company_id = c.id
       JOIN departments d ON j.department_id = d.id
       JOIN users u ON a.applicant_id = u.id
       LEFT JOIN applicant_profiles p ON a.applicant_id = p.user_id
       JOIN resumes r ON a.resume_id = r.id
       WHERE a.applicant_id = ?
       ORDER BY a.applied_at DESC;`,
      [applicantId]
    );
  }

  async listByCompanyWithDetails(
    companyId?: string,
    jobId?: string,
    status?: string
  ): Promise<ApplicationWithDetails[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (companyId && companyId.trim()) {
      conditions.push('j.company_id = ?');
      params.push(companyId.trim());
    }

    if (jobId && jobId.trim()) {
      conditions.push('a.job_id = ?');
      params.push(jobId.trim());
    }

    if (status && status !== 'ALL') {
      conditions.push('a.status = ?');
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return this.db.query<ApplicationWithDetails>(
      `SELECT 
        a.*,
        j.title AS job_title,
        j.company_id AS company_id,
        c.name AS company_name,
        d.name AS department_name,
        j.location AS job_location,
        (u.first_name || ' ' || u.last_name) AS applicant_name,
        u.email AS applicant_email,
        p.phone AS applicant_phone,
        p.headline AS applicant_headline,
        p.location AS applicant_location,
        r.file_name AS resume_file_name,
        r.file_size AS resume_file_size,
        r.file_mime AS resume_file_mime,
        r.storage_path AS resume_storage_path
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       JOIN companies c ON j.company_id = c.id
       JOIN departments d ON j.department_id = d.id
       JOIN users u ON a.applicant_id = u.id
       LEFT JOIN applicant_profiles p ON a.applicant_id = p.user_id
       JOIN resumes r ON a.resume_id = r.id
       ${whereClause}
       ORDER BY a.applied_at DESC;`,
      params
    );
  }

  async listByJob(jobId: string): Promise<Application[]> {
    return this.db.query<Application>(
      'SELECT * FROM applications WHERE job_id = ? ORDER BY applied_at DESC;',
      [jobId]
    );
  }

  async getStatusHistory(applicationId: string): Promise<ApplicationStatusHistory[]> {
    return this.db.query<ApplicationStatusHistory>(
      'SELECT * FROM application_status_history WHERE application_id = ? ORDER BY changed_at ASC;',
      [applicationId]
    );
  }

  async getStatusHistoryWithActors(applicationId: string): Promise<ApplicationStatusHistoryWithActor[]> {
    return this.db.query<ApplicationStatusHistoryWithActor>(
      `SELECT 
        h.*,
        (u.first_name || ' ' || u.last_name) AS actor_name,
        u.role AS actor_role
       FROM application_status_history h
       JOIN users u ON h.changed_by = u.id
       WHERE h.application_id = ?
       ORDER BY h.changed_at ASC;`,
      [applicationId]
    );
  }
}

export const applicationRepository = new ApplicationRepository();
