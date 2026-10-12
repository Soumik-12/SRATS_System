import { getDatabase } from '../db/connection.js';

export interface JobRecommendationRecord {
  id: string;
  applicant_id: string;
  consent_given: number;
  consent_timestamp: string;
  fingerprint: string;
  recommended_jobs_json: string;
  model_used: string;
  created_at: string;
  expires_at: string;
}

export class JobRecommendationRepository {
  private get db() {
    return getDatabase();
  }

  async findLatestByApplicant(applicantId: string): Promise<JobRecommendationRecord | null> {
    return this.db.queryOne<JobRecommendationRecord>(
      'SELECT * FROM job_recommendations WHERE applicant_id = ? ORDER BY created_at DESC LIMIT 1;',
      [applicantId]
    );
  }

  async save(record: {
    id: string;
    applicant_id: string;
    consent_given: number;
    consent_timestamp: string;
    fingerprint: string;
    recommended_jobs_json: string;
    model_used: string;
    created_at: string;
    expires_at: string;
  }): Promise<JobRecommendationRecord> {
    this.db.execute(
      `INSERT INTO job_recommendations (
        id, applicant_id, consent_given, consent_timestamp,
        fingerprint, recommended_jobs_json, model_used, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        record.id,
        record.applicant_id,
        record.consent_given,
        record.consent_timestamp,
        record.fingerprint,
        record.recommended_jobs_json,
        record.model_used,
        record.created_at,
        record.expires_at,
      ]
    );

    const saved = await this.db.queryOne<JobRecommendationRecord>(
      'SELECT * FROM job_recommendations WHERE id = ?;',
      [record.id]
    );
    if (!saved) {
      throw new Error(`Failed to retrieve saved job recommendation ${record.id}`);
    }
    return saved;
  }

  async deleteByApplicant(applicantId: string): Promise<boolean> {
    const result = this.db.execute(
      'DELETE FROM job_recommendations WHERE applicant_id = ?;',
      [applicantId]
    );
    return result.changes > 0;
  }
}

export const jobRecommendationRepository = new JobRecommendationRepository();
