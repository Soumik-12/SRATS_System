import { getDatabase } from '../db/connection.js';

export interface ResumeAnalysisRecord {
  id: string;
  resume_id: string;
  applicant_id: string;
  consent_given: number;
  consent_timestamp: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  model_used: string;
  prompt_version: string;
  extracted_headline: string | null;
  extracted_summary: string | null;
  skills_json: string | null;
  experience_json: string | null;
  education_json: string | null;
  certifications_json: string | null;
  confidence_score: number | null;
  is_confirmed: number;
  confirmed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export class ResumeAnalysisRepository {
  private get db() {
    return getDatabase();
  }

  async findById(id: string): Promise<ResumeAnalysisRecord | null> {
    return this.db.queryOne<ResumeAnalysisRecord>(
      'SELECT * FROM resume_analyses WHERE id = ?;',
      [id]
    );
  }

  async findByResumeId(resumeId: string): Promise<ResumeAnalysisRecord | null> {
    return this.db.queryOne<ResumeAnalysisRecord>(
      'SELECT * FROM resume_analyses WHERE resume_id = ? ORDER BY created_at DESC LIMIT 1;',
      [resumeId]
    );
  }

  async listByApplicant(applicantId: string): Promise<ResumeAnalysisRecord[]> {
    return this.db.query<ResumeAnalysisRecord>(
      'SELECT * FROM resume_analyses WHERE applicant_id = ? ORDER BY created_at DESC;',
      [applicantId]
    );
  }

  async create(record: {
    id: string;
    resume_id: string;
    applicant_id: string;
    consent_given: number;
    consent_timestamp: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    model_used: string;
    prompt_version: string;
    extracted_headline?: string | null;
    extracted_summary?: string | null;
    skills_json?: string | null;
    experience_json?: string | null;
    education_json?: string | null;
    certifications_json?: string | null;
    confidence_score?: number | null;
    error_message?: string | null;
  }): Promise<ResumeAnalysisRecord> {
    const now = new Date().toISOString();
    this.db.execute(
      `INSERT INTO resume_analyses (
        id, resume_id, applicant_id, consent_given, consent_timestamp,
        status, model_used, prompt_version, extracted_headline, extracted_summary,
        skills_json, experience_json, education_json, certifications_json,
        confidence_score, is_confirmed, confirmed_at, error_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?);`,
      [
        record.id,
        record.resume_id,
        record.applicant_id,
        record.consent_given,
        record.consent_timestamp,
        record.status,
        record.model_used,
        record.prompt_version,
        record.extracted_headline ?? null,
        record.extracted_summary ?? null,
        record.skills_json ?? null,
        record.experience_json ?? null,
        record.education_json ?? null,
        record.certifications_json ?? null,
        record.confidence_score ?? null,
        record.error_message ?? null,
        now,
        now,
      ]
    );

    const created = await this.findById(record.id);
    if (!created) {
      throw new Error(`Failed to retrieve newly created resume analysis ${record.id}`);
    }
    return created;
  }

  async updateStatus(
    id: string,
    updates: {
      status: 'PENDING' | 'COMPLETED' | 'FAILED';
      extracted_headline?: string | null;
      extracted_summary?: string | null;
      skills_json?: string | null;
      experience_json?: string | null;
      education_json?: string | null;
      certifications_json?: string | null;
      confidence_score?: number | null;
      error_message?: string | null;
    }
  ): Promise<ResumeAnalysisRecord> {
    const now = new Date().toISOString();
    this.db.execute(
      `UPDATE resume_analyses SET
        status = ?,
        extracted_headline = COALESCE(?, extracted_headline),
        extracted_summary = COALESCE(?, extracted_summary),
        skills_json = COALESCE(?, skills_json),
        experience_json = COALESCE(?, experience_json),
        education_json = COALESCE(?, education_json),
        certifications_json = COALESCE(?, certifications_json),
        confidence_score = COALESCE(?, confidence_score),
        error_message = ?,
        updated_at = ?
       WHERE id = ?;`,
      [
        updates.status,
        updates.extracted_headline ?? null,
        updates.extracted_summary ?? null,
        updates.skills_json ?? null,
        updates.experience_json ?? null,
        updates.education_json ?? null,
        updates.certifications_json ?? null,
        updates.confidence_score ?? null,
        updates.error_message ?? null,
        now,
        id,
      ]
    );

    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`Failed to retrieve updated resume analysis ${id}`);
    }
    return updated;
  }

  async markConfirmed(id: string): Promise<ResumeAnalysisRecord> {
    const now = new Date().toISOString();
    this.db.execute(
      'UPDATE resume_analyses SET is_confirmed = 1, confirmed_at = ?, updated_at = ? WHERE id = ?;',
      [now, now, id]
    );

    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`Failed to retrieve confirmed resume analysis ${id}`);
    }
    return updated;
  }
}

export const resumeAnalysisRepository = new ResumeAnalysisRepository();
