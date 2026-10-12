import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import {
  applicantProfileRepository,
  resumeRepository,
  applicantSkillRepository,
} from '../repositories/applicantProfileRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { auditLogRepository } from '../repositories/notificationRepository.js';
import { storageService } from './storageService.js';
import { logger } from '../utils/logger.js';
import type { SkillLevel, Resume } from '../domain/entities.js';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'];

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// Validation Schemas
export const UpdateProfileSchema = z.object({
  phone: z.string().max(30).nullable().optional(),
  headline: z.string().max(255).nullable().optional(),
  summary: z.string().max(4000).nullable().optional(),
  location: z.string().max(255).nullable().optional(),
  website: z.string().url('Invalid website URL format').max(255).nullable().optional().or(z.literal('')),
  education_json: z.string().max(10000).nullable().optional(),
  experience_json: z.string().max(10000).nullable().optional(),
});

export const AddSkillSchema = z.object({
  skill_name: z.string().min(1, 'Skill name is required').max(100),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'EXPERT']),
});

export interface SafeResumeMetadata {
  id: string;
  applicantId: string;
  fileName: string;
  fileMime: string;
  fileSize: number;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
}

export function toSafeResume(r: Resume): SafeResumeMetadata {
  return {
    id: r.id,
    applicantId: r.applicant_id,
    fileName: r.file_name,
    fileMime: r.file_mime,
    fileSize: r.file_size,
    isPrimary: r.is_primary === 1,
    isActive: r.is_active === 1,
    createdAt: r.created_at,
  };
}

export class ApplicantService {
  /**
   * Deterministic Profile Completeness Formula:
   * 1. Headline filled: 20%
   * 2. Summary filled: 20%
   * 3. Contact details (phone or location): 20%
   * 4. Skills added (at least 1): 20%
   * 5. Active Resume uploaded: 20%
   * Total = 0% to 100%.
   */
  computeCompleteness(
    profile: { headline?: string | null; summary?: string | null; phone?: string | null; location?: string | null } | null,
    skillsCount: number,
    hasResume: boolean
  ): { percentage: number; missingFields: string[] } {
    let score = 0;
    const missing: string[] = [];

    if (profile?.headline && profile.headline.trim().length > 0) {
      score += 20;
    } else {
      missing.push('Professional Headline');
    }

    if (profile?.summary && profile.summary.trim().length > 0) {
      score += 20;
    } else {
      missing.push('Professional Summary');
    }

    if ((profile?.phone && profile.phone.trim().length > 0) || (profile?.location && profile.location.trim().length > 0)) {
      score += 20;
    } else {
      missing.push('Contact / Location Information');
    }

    if (skillsCount > 0) {
      score += 20;
    } else {
      missing.push('At least one Skill');
    }

    if (hasResume) {
      score += 20;
    } else {
      missing.push('Uploaded Resume');
    }

    return { percentage: score, missingFields: missing };
  }

  async getProfile(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User record not found.');
    }

    const profile = await applicantProfileRepository.findByUserId(userId);
    const skills = await applicantSkillRepository.listByApplicant(userId);
    const primaryResume = await resumeRepository.findPrimaryByApplicant(userId);

    const completeness = this.computeCompleteness(
      profile,
      skills.length,
      Boolean(primaryResume)
    );

    return {
      userId: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: profile?.phone ?? null,
      headline: profile?.headline ?? null,
      summary: profile?.summary ?? null,
      location: profile?.location ?? null,
      website: profile?.website ?? null,
      educationJson: profile?.education_json ?? null,
      experienceJson: profile?.experience_json ?? null,
      createdAt: profile?.created_at ?? user.created_at,
      updatedAt: profile?.updated_at ?? user.updated_at,
      completeness,
    };
  }

  async updateProfile(userId: string, data: unknown) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User record not found.');
    }

    const validated = UpdateProfileSchema.parse(data);

    const saved = await applicantProfileRepository.upsert({
      user_id: userId,
      phone: validated.phone || null,
      headline: validated.headline || null,
      summary: validated.summary || null,
      location: validated.location || null,
      website: validated.website || null,
      education_json: validated.education_json || null,
      experience_json: validated.experience_json || null,
    });

    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`,
      actor_id: userId,
      action: 'APPLICANT_PROFILE_UPDATED',
      entity_type: 'APPLICANT_PROFILE',
      entity_id: userId,
      metadata_json: JSON.stringify({
        hasHeadline: Boolean(saved.headline),
        hasSummary: Boolean(saved.summary),
      }),
    });

    return await this.getProfile(userId);
  }

  async getSkills(applicantId: string) {
    return await applicantSkillRepository.listByApplicant(applicantId);
  }

  async addSkill(applicantId: string, data: unknown) {
    const validated = AddSkillSchema.parse(data);
    const trimmedName = validated.skill_name.trim();

    // Check duplicate skill for this applicant
    const existing = await applicantSkillRepository.findByApplicantAndName(applicantId, trimmedName);
    if (existing) {
      throw new AppError(409, 'SKILL_ALREADY_EXISTS', `Skill "${trimmedName}" has already been added.`);
    }

    const skillId = `skl-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
    const newSkill = await applicantSkillRepository.addSkill({
      id: skillId,
      applicant_id: applicantId,
      skill_name: trimmedName,
      level: validated.level as SkillLevel,
    });

    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`,
      actor_id: applicantId,
      action: 'APPLICANT_SKILL_ADDED',
      entity_type: 'APPLICANT_SKILL',
      entity_id: newSkill.id,
      metadata_json: JSON.stringify({ skillName: newSkill.skill_name, level: newSkill.level }),
    });

    return newSkill;
  }

  async removeSkill(applicantId: string, skillId: string) {
    const skill = await applicantSkillRepository.findById(skillId);
    if (!skill || skill.applicant_id !== applicantId) {
      throw new AppError(404, 'SKILL_NOT_FOUND', 'Skill not found or does not belong to the applicant.');
    }

    await applicantSkillRepository.removeSkill(skillId, applicantId);

    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`,
      actor_id: applicantId,
      action: 'APPLICANT_SKILL_REMOVED',
      entity_type: 'APPLICANT_SKILL',
      entity_id: skillId,
      metadata_json: JSON.stringify({ skillName: skill.skill_name }),
    });

    return { success: true, message: 'Skill successfully removed.' };
  }

  async listResumes(applicantId: string): Promise<SafeResumeMetadata[]> {
    const records = await resumeRepository.listByApplicant(applicantId);
    return records.map(toSafeResume);
  }

  /**
   * Secure Resume Upload Workflow:
   * 1. Validate file presence, size, extension, MIME type, and binary magic numbers.
   * 2. Generate isolated storage key (no user filename path traversal).
   * 3. Write file via StorageService.
   * 4. Perform atomic transactional replacement in SQLite:
   *    - Archive/deactivate previous active resumes.
   *    - Persist new resume row as primary and active.
   * 5. If DB persistence fails: compensating cleanup deletes stored physical file.
   * 6. Log audit event.
   * 7. Return safe metadata (NEVER expose filesystem paths).
   */
  async uploadResume(
    applicantId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer }
  ): Promise<SafeResumeMetadata> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new AppError(400, 'EMPTY_FILE', 'The uploaded resume file is empty or corrupted.');
    }

    if (file.size > MAX_FILE_SIZE_BYTES || file.buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new AppError(413, 'FILE_TOO_LARGE', 'Resume file exceeds maximum allowed size of 5 MB.');
    }

    // Sanitize and validate filename extension
    const originalName = path.basename(file.originalname).replace(/[\0\r\n]/g, '').trim();
    const ext = path.extname(originalName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new AppError(
        400,
        'UNSUPPORTED_FILE_TYPE',
        `Unsupported file extension "${ext}". Allowed types: PDF, DOC, DOCX.`
      );
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new AppError(
        400,
        'UNSUPPORTED_MIME_TYPE',
        `Unsupported MIME type "${file.mimetype}". Allowed types: PDF, DOC, DOCX.`
      );
    }

    // Magic Numbers Content Inspection (Defends against file extension spoofing)
    const buf = file.buffer;
    if (ext === '.pdf') {
      const isPdfHeader = buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-';
      if (!isPdfHeader) {
        throw new AppError(400, 'CORRUPTED_OR_SPOOFED_FILE', 'File does not have a valid PDF header signature.');
      }
    } else if (ext === '.docx') {
      // DOCX is a ZIP container: starts with PK\x03\x04
      const isZipHeader =
        buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
      if (!isZipHeader) {
        throw new AppError(400, 'CORRUPTED_OR_SPOOFED_FILE', 'File does not have a valid DOCX container signature.');
      }
    } else if (ext === '.doc') {
      // Legacy DOC (OLE Compound File): starts with 0xD0, 0xCF, 0x11, 0xE0
      const isOleHeader =
        buf.length >= 4 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0;
      if (!isOleHeader) {
        throw new AppError(400, 'CORRUPTED_OR_SPOOFED_FILE', 'File does not have a valid DOC binary signature.');
      }
    }

    // Generate safe internal storage identifier (strictly internal, isolated)
    const resumeId = `res-${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}`;
    const storageKey = `${applicantId}/${resumeId}${ext}`;

    // Step 1: Write file to storage
    await storageService.save(storageKey, file.buffer, file.mimetype);

    let savedResume: Resume;
    try {
      // Step 2: Atomic database replacement
      savedResume = await resumeRepository.replaceActiveResume({
        id: resumeId,
        applicant_id: applicantId,
        file_name: originalName,
        file_mime: file.mimetype,
        file_size: file.size,
        storage_path: storageKey,
        raw_text: null,
      });
    } catch (dbError) {
      // Compensating Storage Cleanup: Remove orphaned storage file if database write fails
      logger.error('Database write failed during resume upload. Executing compensating storage cleanup.', dbError);
      await storageService.delete(storageKey);
      throw new AppError(500, 'RESUME_PERSISTENCE_FAILED', 'Failed to record resume in database.');
    }

    // Step 3: Audit logging
    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`,
      actor_id: applicantId,
      action: 'RESUME_UPLOADED',
      entity_type: 'RESUME',
      entity_id: savedResume.id,
      metadata_json: JSON.stringify({
        fileName: originalName,
        fileSize: file.size,
        isPrimary: true,
      }),
    });

    return toSafeResume(savedResume);
  }

  async downloadResumeFile(applicantId: string, resumeId: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    const resume = await resumeRepository.findById(resumeId);
    if (!resume || resume.applicant_id !== applicantId) {
      throw new AppError(404, 'RESUME_NOT_FOUND', 'Requested resume not found or unauthorized.');
    }

    const buffer = await storageService.read(resume.storage_path);
    return {
      buffer,
      mimeType: resume.file_mime,
      fileName: resume.file_name,
    };
  }

  async getResumeContent(resumeId: string, applicantId: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    return this.downloadResumeFile(applicantId, resumeId);
  }

  async deleteResume(applicantId: string, resumeId: string): Promise<{ success: boolean; message: string }> {
    const resume = await resumeRepository.findById(resumeId);
    if (!resume || resume.applicant_id !== applicantId) {
      throw new AppError(404, 'RESUME_NOT_FOUND', 'Requested resume not found or unauthorized.');
    }

    await resumeRepository.softDelete(resumeId, applicantId);

    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`,
      actor_id: applicantId,
      action: 'RESUME_ARCHIVED',
      entity_type: 'RESUME',
      entity_id: resumeId,
      metadata_json: JSON.stringify({ fileName: resume.file_name }),
    });

    return { success: true, message: 'Resume successfully archived.' };
  }
}

export const applicantService = new ApplicantService();
