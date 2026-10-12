import { getDatabase } from '../db/connection.js';
import { withTransaction } from '../db/transactions.js';
import type { ApplicantProfile, Resume, ApplicantSkill } from '../domain/entities.js';

export class ApplicantProfileRepository {
  private get db() {
    return getDatabase();
  }

  async findByUserId(userId: string): Promise<ApplicantProfile | null> {
    return this.db.queryOne<ApplicantProfile>(
      'SELECT * FROM applicant_profiles WHERE user_id = ?;',
      [userId]
    );
  }

  async upsert(profile: { user_id: string } & Partial<Omit<ApplicantProfile, 'user_id' | 'created_at' | 'updated_at'>>): Promise<ApplicantProfile> {
    const now = new Date().toISOString();
    this.db.execute(
      `INSERT INTO applicant_profiles (user_id, phone, headline, summary, location, website, education_json, experience_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         phone = excluded.phone,
         headline = excluded.headline,
         summary = excluded.summary,
         location = excluded.location,
         website = excluded.website,
         education_json = excluded.education_json,
         experience_json = excluded.experience_json,
         updated_at = excluded.updated_at;`,
      [
        profile.user_id,
        profile.phone || null,
        profile.headline || null,
        profile.summary || null,
        profile.location || null,
        profile.website || null,
        profile.education_json || null,
        profile.experience_json || null,
        now,
        now,
      ]
    );
    return (await this.findByUserId(profile.user_id))!;
  }
}

export class ResumeRepository {
  private get db() {
    return getDatabase();
  }

  async findById(id: string): Promise<Resume | null> {
    return this.db.queryOne<Resume>(
      'SELECT * FROM resumes WHERE id = ? AND deleted_at IS NULL;',
      [id]
    );
  }

  async findByApplicantAndId(applicantId: string, id: string): Promise<Resume | null> {
    return this.db.queryOne<Resume>(
      'SELECT * FROM resumes WHERE id = ? AND applicant_id = ? AND deleted_at IS NULL;',
      [id, applicantId]
    );
  }

  async findPrimaryByApplicant(applicantId: string): Promise<Resume | null> {
    return this.db.queryOne<Resume>(
      'SELECT * FROM resumes WHERE applicant_id = ? AND is_primary = 1 AND is_active = 1 AND deleted_at IS NULL LIMIT 1;',
      [applicantId]
    );
  }

  async create(resume: Omit<Resume, 'is_primary' | 'is_active' | 'created_at' | 'deleted_at' | 'raw_text'> & { raw_text?: string | null; is_primary?: number; is_active?: number }): Promise<Resume> {
    const now = new Date().toISOString();
    const isPrimary = resume.is_primary !== undefined ? resume.is_primary : 1;
    const isActive = resume.is_active !== undefined ? resume.is_active : 1;
    this.db.execute(
      `INSERT INTO resumes (id, applicant_id, file_name, file_mime, file_size, storage_path, raw_text, is_primary, is_active, created_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL);`,
      [
        resume.id,
        resume.applicant_id,
        resume.file_name,
        resume.file_mime,
        resume.file_size,
        resume.storage_path,
        resume.raw_text || null,
        isPrimary,
        isActive,
        now,
      ]
    );
    return (await this.findById(resume.id))!;
  }

  /**
   * Atomically marks existing active resumes for the applicant as inactive/archived,
   * and creates the new resume as primary active.
   * Guarantees deterministic state: exactly one current resume per applicant.
   */
  async replaceActiveResume(
    newResume: Omit<Resume, 'is_primary' | 'is_active' | 'created_at' | 'deleted_at' | 'raw_text'> & { raw_text?: string | null }
  ): Promise<Resume> {
    return withTransaction(({ db: txDb }) => {
      const now = new Date().toISOString();
      // Step 1: Mark previous active resumes as inactive
      txDb.execute(
        'UPDATE resumes SET is_primary = 0, is_active = 0 WHERE applicant_id = ? AND is_active = 1;',
        [newResume.applicant_id]
      );

      // Step 2: Insert new resume as primary active
      txDb.execute(
        `INSERT INTO resumes (id, applicant_id, file_name, file_mime, file_size, storage_path, raw_text, is_primary, is_active, created_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, NULL);`,
        [
          newResume.id,
          newResume.applicant_id,
          newResume.file_name,
          newResume.file_mime,
          newResume.file_size,
          newResume.storage_path,
          newResume.raw_text || null,
          now,
        ]
      );

      const created = txDb.queryOne<Resume>(
        'SELECT * FROM resumes WHERE id = ?;',
        [newResume.id]
      );
      if (!created) {
        throw new Error(`Failed to persist new resume record ${newResume.id}`);
      }
      return created;
    });
  }

  async listByApplicant(applicantId: string): Promise<Resume[]> {
    return this.db.query<Resume>(
      'SELECT * FROM resumes WHERE applicant_id = ? AND deleted_at IS NULL ORDER BY created_at DESC;',
      [applicantId]
    );
  }

  async softDelete(id: string, applicantId?: string): Promise<boolean> {
    const now = new Date().toISOString();
    let sql = 'UPDATE resumes SET is_active = 0, is_primary = 0, deleted_at = ? WHERE id = ?';
    const params: unknown[] = [now, id];
    if (applicantId) {
      sql += ' AND applicant_id = ?;';
      params.push(applicantId);
    } else {
      sql += ';';
    }
    const result = this.db.execute(sql, params);
    return result.changes > 0;
  }
}

export class ApplicantSkillRepository {
  private get db() {
    return getDatabase();
  }

  async listByApplicant(applicantId: string): Promise<ApplicantSkill[]> {
    return this.db.query<ApplicantSkill>(
      'SELECT * FROM applicant_skills WHERE applicant_id = ? ORDER BY created_at DESC, skill_name ASC;',
      [applicantId]
    );
  }

  async findByApplicantAndName(applicantId: string, skillName: string): Promise<ApplicantSkill | null> {
    return this.db.queryOne<ApplicantSkill>(
      'SELECT * FROM applicant_skills WHERE applicant_id = ? AND LOWER(skill_name) = LOWER(?);',
      [applicantId, skillName.trim()]
    );
  }

  async findById(id: string): Promise<ApplicantSkill | null> {
    return this.db.queryOne<ApplicantSkill>(
      'SELECT * FROM applicant_skills WHERE id = ?;',
      [id]
    );
  }

  async addSkill(skill: Omit<ApplicantSkill, 'is_verified' | 'created_at'>): Promise<ApplicantSkill> {
    const now = new Date().toISOString();
    this.db.execute(
      `INSERT INTO applicant_skills (id, applicant_id, skill_name, level, is_verified, created_at)
       VALUES (?, ?, ?, ?, 0, ?)
       ON CONFLICT(applicant_id, skill_name) DO UPDATE SET level = excluded.level;`,
      [skill.id, skill.applicant_id, skill.skill_name.trim(), skill.level, now]
    );
    return (await this.db.queryOne<ApplicantSkill>('SELECT * FROM applicant_skills WHERE id = ?;', [skill.id]))!;
  }

  async removeSkill(id: string, applicantId: string): Promise<boolean> {
    const result = this.db.execute(
      'DELETE FROM applicant_skills WHERE id = ? AND applicant_id = ?;',
      [id, applicantId]
    );
    return result.changes > 0;
  }
}

export const applicantProfileRepository = new ApplicantProfileRepository();
export const resumeRepository = new ResumeRepository();
export const applicantSkillRepository = new ApplicantSkillRepository();
