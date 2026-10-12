import { getDatabase } from '../db/connection.js';
import { withTransaction } from '../db/transactions.js';
import type { Interview, InterviewStatus, InterviewFeedback, InterviewType } from '../domain/entities.js';

export interface InterviewWithDetails extends Interview {
  job_id: string;
  job_title: string;
  company_id: string;
  company_name: string;
  department_name: string;
  applicant_id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_headline?: string | null;
  interviewer_name: string;
  interviewer_email: string;
  scheduled_by_name: string;
  feedback?: InterviewFeedback | null;
}

const INTERVIEW_DETAILS_SELECT = `
  SELECT 
    i.*,
    a.job_id AS job_id,
    j.title AS job_title,
    j.company_id AS company_id,
    c.name AS company_name,
    d.name AS department_name,
    a.applicant_id AS applicant_id,
    (au.first_name || ' ' || au.last_name) AS applicant_name,
    au.email AS applicant_email,
    ap.headline AS applicant_headline,
    (iu.first_name || ' ' || iu.last_name) AS interviewer_name,
    iu.email AS interviewer_email,
    (su.first_name || ' ' || su.last_name) AS scheduled_by_name
  FROM interviews i
  JOIN applications a ON i.application_id = a.id
  JOIN jobs j ON a.job_id = j.id
  JOIN companies c ON j.company_id = c.id
  JOIN departments d ON j.department_id = d.id
  JOIN users au ON a.applicant_id = au.id
  LEFT JOIN applicant_profiles ap ON a.applicant_id = ap.user_id
  JOIN users iu ON i.interviewer_id = iu.id
  JOIN users su ON i.scheduled_by = su.id
`;

export class InterviewRepository {
  private get db() {
    return getDatabase();
  }

  async findById(id: string): Promise<Interview | null> {
    return this.db.queryOne<Interview>('SELECT * FROM interviews WHERE id = ?;', [id]);
  }

  async findByIdWithDetails(id: string): Promise<InterviewWithDetails | null> {
    const row = await this.db.queryOne<InterviewWithDetails>(
      `${INTERVIEW_DETAILS_SELECT} WHERE i.id = ?;`,
      [id]
    );
    if (!row) return null;

    const feedback = await this.getFeedback(id);
    return {
      ...row,
      feedback,
    };
  }

  async create(interview: Omit<Interview, 'status' | 'created_at' | 'updated_at'> & { interview_type?: InterviewType }): Promise<Interview> {
    const now = new Date().toISOString();
    const type = interview.interview_type || 'ONLINE';
    this.db.execute(
      `INSERT INTO interviews (
        id, application_id, interviewer_id, scheduled_by, scheduled_at_utc,
        duration_minutes, status, interview_type, location_url, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'SCHEDULED', ?, ?, ?, ?, ?);`,
      [
        interview.id,
        interview.application_id,
        interview.interviewer_id,
        interview.scheduled_by,
        interview.scheduled_at_utc,
        interview.duration_minutes || 45,
        type,
        interview.location_url || null,
        interview.notes || null,
        now,
        now,
      ]
    );
    return (await this.findById(interview.id))!;
  }

  async updateStatus(id: string, newStatus: InterviewStatus, notes?: string): Promise<boolean> {
    const now = new Date().toISOString();
    const result = this.db.execute(
      'UPDATE interviews SET status = ?, notes = COALESCE(?, notes), updated_at = ? WHERE id = ?;',
      [newStatus, notes ?? null, now, id]
    );
    return result.changes > 0;
  }

  async reschedule(
    id: string,
    newScheduledAtUtc: string,
    durationMinutes?: number,
    note?: string
  ): Promise<Interview> {
    const now = new Date().toISOString();
    const current = await this.findById(id);
    if (!current) {
      throw new Error(`Interview ${id} not found.`);
    }

    const previousTime = current.scheduled_at_utc;
    const historyNote = note
      ? `[Rescheduled from ${previousTime}]: ${note}`
      : `[Rescheduled from ${previousTime}]`;
    const combinedNotes = current.notes ? `${current.notes}\n${historyNote}` : historyNote;

    this.db.execute(
      `UPDATE interviews 
       SET status = 'RESCHEDULED', 
           scheduled_at_utc = ?, 
           duration_minutes = COALESCE(?, duration_minutes),
           notes = ?, 
           updated_at = ? 
       WHERE id = ?;`,
      [newScheduledAtUtc, durationMinutes ?? null, combinedNotes, now, id]
    );

    return (await this.findById(id))!;
  }

  async cancel(id: string, note?: string): Promise<Interview> {
    const now = new Date().toISOString();
    const current = await this.findById(id);
    if (!current) {
      throw new Error(`Interview ${id} not found.`);
    }

    const cancelNote = note ? `[Cancelled]: ${note}` : `[Cancelled]`;
    const combinedNotes = current.notes ? `${current.notes}\n${cancelNote}` : cancelNote;

    this.db.execute(
      `UPDATE interviews SET status = 'CANCELLED', notes = ?, updated_at = ? WHERE id = ?;`,
      [combinedNotes, now, id]
    );

    return (await this.findById(id))!;
  }

  async checkInterviewerConflict(
    interviewerId: string,
    startTimeUtc: string,
    durationMinutes: number,
    excludeInterviewId?: string
  ): Promise<boolean> {
    const activeInterviews = await this.db.query<{ id: string; scheduled_at_utc: string; duration_minutes: number }>(
      `SELECT id, scheduled_at_utc, duration_minutes 
       FROM interviews 
       WHERE interviewer_id = ? AND status IN ('SCHEDULED', 'RESCHEDULED');`,
      [interviewerId]
    );

    const newStart = new Date(startTimeUtc).getTime();
    const newEnd = newStart + durationMinutes * 60 * 1000;

    for (const interview of activeInterviews) {
      if (excludeInterviewId && interview.id === excludeInterviewId) {
        continue;
      }
      const existingStart = new Date(interview.scheduled_at_utc).getTime();
      const existingEnd = existingStart + interview.duration_minutes * 60 * 1000;

      // Overlap condition: (StartA < EndB) and (EndA > StartB)
      if (newStart < existingEnd && newEnd > existingStart) {
        return true; // Conflict detected
      }
    }

    return false;
  }

  async submitFeedback(feedback: Omit<InterviewFeedback, 'submitted_at'>): Promise<InterviewFeedback> {
    return withTransaction(({ db: txDb }) => {
      const now = new Date().toISOString();
      txDb.execute(
        `INSERT INTO interview_feedback (id, interview_id, interviewer_id, rating, notes, recommendation, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(interview_id) DO UPDATE SET
           rating = excluded.rating,
           notes = excluded.notes,
           recommendation = excluded.recommendation,
           submitted_at = excluded.submitted_at;`,
        [
          feedback.id,
          feedback.interview_id,
          feedback.interviewer_id,
          feedback.rating,
          feedback.notes,
          feedback.recommendation,
          now,
        ]
      );

      // Auto-update interview status to COMPLETED
      txDb.execute(
        "UPDATE interviews SET status = 'COMPLETED', updated_at = ? WHERE id = ?;",
        [now, feedback.interview_id]
      );

      return (txDb.queryOne<InterviewFeedback>(
        'SELECT * FROM interview_feedback WHERE id = ?;',
        [feedback.id]
      ))!;
    });
  }

  async getFeedback(interviewId: string): Promise<InterviewFeedback | null> {
    return this.db.queryOne<InterviewFeedback>(
      'SELECT * FROM interview_feedback WHERE interview_id = ?;',
      [interviewId]
    );
  }

  async listByInterviewer(interviewerId: string): Promise<Interview[]> {
    return this.db.query<Interview>(
      'SELECT * FROM interviews WHERE interviewer_id = ? ORDER BY scheduled_at_utc ASC;',
      [interviewerId]
    );
  }

  async listByInterviewerWithDetails(interviewerId: string): Promise<InterviewWithDetails[]> {
    const rows = await this.db.query<InterviewWithDetails>(
      `${INTERVIEW_DETAILS_SELECT} WHERE i.interviewer_id = ? ORDER BY i.scheduled_at_utc ASC;`,
      [interviewerId]
    );
    for (const row of rows) {
      row.feedback = await this.getFeedback(row.id);
    }
    return rows;
  }

  async listByCompanyWithDetails(companyId: string): Promise<InterviewWithDetails[]> {
    const rows = await this.db.query<InterviewWithDetails>(
      `${INTERVIEW_DETAILS_SELECT} WHERE j.company_id = ? ORDER BY i.scheduled_at_utc DESC;`,
      [companyId]
    );
    for (const row of rows) {
      row.feedback = await this.getFeedback(row.id);
    }
    return rows;
  }

  async listByApplicantWithDetails(applicantId: string): Promise<InterviewWithDetails[]> {
    const rows = await this.db.query<InterviewWithDetails>(
      `${INTERVIEW_DETAILS_SELECT} WHERE a.applicant_id = ? ORDER BY i.scheduled_at_utc ASC;`,
      [applicantId]
    );
    return rows;
  }

  async listAllWithDetails(): Promise<InterviewWithDetails[]> {
    const rows = await this.db.query<InterviewWithDetails>(
      `${INTERVIEW_DETAILS_SELECT} ORDER BY i.scheduled_at_utc DESC;`
    );
    for (const row of rows) {
      row.feedback = await this.getFeedback(row.id);
    }
    return rows;
  }

  async listByApplication(applicationId: string): Promise<Interview[]> {
    return this.db.query<Interview>(
      'SELECT * FROM interviews WHERE application_id = ? ORDER BY scheduled_at_utc ASC;',
      [applicationId]
    );
  }
}

export const interviewRepository = new InterviewRepository();
