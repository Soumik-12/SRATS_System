import { z } from 'zod';
import type { ApplicationStatus, JobStatus, Job } from './entities.js';

// User Validation
export const CreateUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  password_hash: z.string().min(1),
  role: z.enum(['APPLICANT', 'RECRUITER', 'INTERVIEWER', 'HR_MANAGER', 'ADMIN']),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  company_id: z.string().nullable().optional(),
});

// Company Validation
export const CreateCompanySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255),
  domain: z.string().min(1).max(255),
  industry: z.string().min(1).max(100),
  size: z.string().min(1).max(50),
  location: z.string().min(1).max(255),
});

export const CreateDepartmentSchema = z.object({
  id: z.string().min(1),
  company_id: z.string().min(1),
  name: z.string().min(1).max(100),
});

// Applicant Profile & Skills
export const UpdateApplicantProfileSchema = z.object({
  phone: z.string().max(30).nullable().optional(),
  headline: z.string().max(255).nullable().optional(),
  summary: z.string().max(4000).nullable().optional(),
  location: z.string().max(255).nullable().optional(),
  website: z.string().url().max(255).nullable().optional(),
});

export const CreateSkillSchema = z.object({
  id: z.string().min(1),
  applicant_id: z.string().min(1),
  skill_name: z.string().min(1).max(100),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'EXPERT']),
  is_verified: z.boolean().optional(),
});

// Resume Metadata Validation
export const CreateResumeSchema = z.object({
  id: z.string().min(1),
  applicant_id: z.string().min(1),
  file_name: z.string().min(1).max(255),
  file_mime: z.enum([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]),
  file_size: z.number().int().min(1).max(5 * 1024 * 1024), // Max 5 MB
  storage_path: z.string().min(1),
  raw_text: z.string().nullable().optional(),
});

// Job Validation & Lifecycle
export const CreateJobSchema = z.object({
  id: z.string().min(1),
  company_id: z.string().min(1),
  department_id: z.string().min(1),
  created_by: z.string().min(1),
  title: z.string().min(3).max(255),
  description: z.string().min(10),
  requirements: z.string().min(10),
  location: z.string().min(1).max(255),
  employment_type: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'REMOTE']),
  experience_level: z.enum(['ENTRY', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE']),
  salary_min: z.number().int().nonnegative().nullable().optional(),
  salary_max: z.number().int().nonnegative().nullable().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']).default('DRAFT'),
  deadline_utc: z.string().datetime().nullable().optional(),
});

export const CreateJobInputSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(255),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  requirements: z.string().min(10, 'Requirements must be at least 10 characters'),
  location: z.string().min(1, 'Location is required').max(255),
  employment_type: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'REMOTE']),
  experience_level: z.enum(['ENTRY', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE']),
  department_id: z.string().min(1, 'Department is required'),
  salary_min: z.number().int().nonnegative().nullable().optional(),
  salary_max: z.number().int().nonnegative().nullable().optional(),
  deadline_utc: z.string().datetime().nullable().optional(),
});

export const UpdateJobInputSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  description: z.string().min(10).optional(),
  requirements: z.string().min(10).optional(),
  location: z.string().min(1).max(255).optional(),
  employment_type: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'REMOTE']).optional(),
  experience_level: z.enum(['ENTRY', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE']).optional(),
  department_id: z.string().min(1).optional(),
  salary_min: z.number().int().nonnegative().nullable().optional(),
  salary_max: z.number().int().nonnegative().nullable().optional(),
  deadline_utc: z.string().datetime().nullable().optional(),
});

/**
 * Server-side business rule validation before transitioning job to PUBLISHED.
 * Ensures complete, trustworthy recruitment listings.
 */
export function validateJobForPublication(job: Job): string[] {
  const errors: string[] = [];
  if (!job.title || job.title.trim().length < 5) {
    errors.push('Job title must be at least 5 characters for publication');
  }
  if (!job.description || job.description.trim().length < 20) {
    errors.push('Job description must be at least 20 characters for publication');
  }
  if (!job.requirements || job.requirements.trim().length < 10) {
    errors.push('Job requirements must be at least 10 characters for publication');
  }
  if (!job.location || job.location.trim().length < 1) {
    errors.push('Job location is required for publication');
  }
  if (!job.department_id) {
    errors.push('Job department must be specified for publication');
  }
  if (!job.company_id) {
    errors.push('Job company must be specified for publication');
  }
  if (!job.deadline_utc) {
    errors.push('Application deadline is required before publishing a job position');
  } else {
    const deadlineTime = new Date(job.deadline_utc).getTime();
    if (isNaN(deadlineTime) || deadlineTime <= Date.now()) {
      errors.push('Application deadline must be a valid future UTC timestamp');
    }
  }
  if (
    job.salary_min !== null &&
    job.salary_min !== undefined &&
    job.salary_max !== null &&
    job.salary_max !== undefined &&
    job.salary_min > job.salary_max
  ) {
    errors.push('Minimum salary cannot exceed maximum salary');
  }
  return errors;
}

/**
 * Valid Job Status Transitions:
 * DRAFT -> PUBLISHED, CLOSED
 * PUBLISHED -> CLOSED
 * CLOSED -> (Terminal: historical recruitment integrity preserved)
 */
export function isValidJobStatusTransition(from: JobStatus, to: JobStatus): boolean {
  if (from === to) return true;
  if (from === 'DRAFT' && (to === 'PUBLISHED' || to === 'CLOSED')) return true;
  if (from === 'PUBLISHED' && to === 'CLOSED') return true;
  return false;
}

// Application Validation & State Machine
export const CreateApplicationSchema = z.object({
  id: z.string().min(1),
  job_id: z.string().min(1),
  applicant_id: z.string().min(1),
  resume_id: z.string().min(1),
  cover_letter: z.string().max(4000).nullable().optional(),
});

export const CreateApplicationInputSchema = z.object({
  job_id: z.string().min(1, 'Job ID is required'),
  resume_id: z.string().min(1, 'Resume ID is required'),
  cover_letter: z.string().max(4000, 'Cover letter cannot exceed 4000 characters').nullable().optional(),
});

export const UpdateApplicationStatusSchema = z.object({
  status: z.enum(['APPLIED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'HIRED', 'REJECTED']),
  note: z.string().max(2000).nullable().optional(),
});

/**
 * Valid Application Status Transition Rules (Phase 6 Master Baseline Map):
 * APPLIED -> SHORTLISTED, REJECTED
 * SHORTLISTED -> INTERVIEW_SCHEDULED, SELECTED, REJECTED
 * INTERVIEW_SCHEDULED -> SELECTED, REJECTED
 * SELECTED -> HIRED
 * REJECTED -> Terminal (cannot transition back)
 * HIRED -> Terminal (cannot transition back)
 * No-op transitions (e.g. SHORTLISTED -> SHORTLISTED) are rejected.
 */
const VALID_APPLICATION_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  APPLIED: ['SHORTLISTED', 'REJECTED'],
  SHORTLISTED: ['INTERVIEW_SCHEDULED', 'SELECTED', 'REJECTED'],
  INTERVIEW_SCHEDULED: ['SELECTED', 'REJECTED'],
  SELECTED: ['HIRED'],
  HIRED: [],
  REJECTED: [],
};

export function isValidApplicationStatusTransition(
  from: ApplicationStatus,
  to: ApplicationStatus
): boolean {
  if (from === to) return false;
  const allowed = VALID_APPLICATION_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

// Meeting link security helper
export function isValidMeetingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Interview Validation
export const CreateInterviewSchema = z.object({
  id: z.string().min(1),
  application_id: z.string().min(1),
  interviewer_id: z.string().min(1),
  scheduled_by: z.string().min(1),
  scheduled_at_utc: z.string(),
  duration_minutes: z.number().int().min(15).max(180).default(45),
  interview_type: z.enum(['ONLINE', 'IN_PERSON']).default('ONLINE'),
  location_url: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const CreateInterviewInputSchema = z
  .object({
    application_id: z.string().min(1, 'Application ID is required'),
    interviewer_id: z.string().min(1, 'Interviewer ID is required'),
    scheduled_at_utc: z.string().refine((val) => {
      const time = new Date(val).getTime();
      return !isNaN(time) && time > Date.now();
    }, 'Scheduled time must be a valid future UTC timestamp'),
    duration_minutes: z.number().int().min(15).max(180).default(45),
    interview_type: z.enum(['ONLINE', 'IN_PERSON']).default('ONLINE'),
    location_url: z.string().min(1, 'Meeting URL or location is required').max(500),
    notes: z.string().max(2000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.interview_type === 'ONLINE') {
      if (!isValidMeetingUrl(data.location_url)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Online interview meeting link must be a valid HTTP or HTTPS URL (no unsafe protocols)',
          path: ['location_url'],
        });
      }
    } else if (data.interview_type === 'IN_PERSON') {
      if (!data.location_url || data.location_url.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'In-person interview requires a specific physical location address or room',
          path: ['location_url'],
        });
      }
    }
  });

export const RescheduleInterviewInputSchema = z.object({
  scheduled_at_utc: z.string().refine((val) => {
    const time = new Date(val).getTime();
    return !isNaN(time) && time > Date.now();
  }, 'Rescheduled time must be a valid future UTC timestamp'),
  duration_minutes: z.number().int().min(15).max(180).optional(),
  reason: z.string().max(2000).nullable().optional(),
});

export const CancelInterviewInputSchema = z.object({
  reason: z.string().max(2000).nullable().optional(),
});

export const SubmitInterviewFeedbackSchema = z.object({
  id: z.string().min(1),
  interview_id: z.string().min(1),
  interviewer_id: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  notes: z.string().min(5, 'Feedback notes must be at least 5 characters').max(4000),
  recommendation: z.enum(['STRONG_HIRE', 'HIRE', 'NO_HIRE', 'STRONG_NO_HIRE']),
});

export const SubmitInterviewFeedbackInputSchema = z.object({
  rating: z.number().int().min(1, 'Rating must be between 1 and 5').max(5, 'Rating must be between 1 and 5'),
  notes: z.string().min(5, 'Feedback notes must be at least 5 characters').max(4000),
  recommendation: z.enum(['STRONG_HIRE', 'HIRE', 'NO_HIRE', 'STRONG_NO_HIRE']),
});
