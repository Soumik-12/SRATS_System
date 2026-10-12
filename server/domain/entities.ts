// SRATS Core Domain Entity Definitions

export type UserRole = 'APPLICANT' | 'RECRUITER' | 'INTERVIEWER' | 'HR_MANAGER' | 'ADMIN';
export type AccountStatus = 'ACTIVE' | 'PENDING' | 'DEACTIVATED';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  account_status: AccountStatus;
  first_name: string;
  last_name: string;
  company_id: string | null;
  is_active: number; // 0 or 1
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Company {
  id: string;
  name: string;
  domain: string;
  industry: string;
  size: string;
  location: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  company_id: string;
  name: string;
  created_at: string;
}

export interface ApplicantProfile {
  user_id: string;
  phone: string | null;
  headline: string | null;
  summary: string | null;
  location: string | null;
  website: string | null;
  education_json: string | null;
  experience_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface Resume {
  id: string;
  applicant_id: string;
  file_name: string;
  file_mime: string;
  file_size: number;
  storage_path: string;
  raw_text: string | null;
  is_primary: number;
  is_active: number;
  created_at: string;
  deleted_at: string | null;
}

export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT';

export interface ApplicantSkill {
  id: string;
  applicant_id: string;
  skill_name: string;
  level: SkillLevel;
  is_verified: number;
  created_at: string;
}

export type JobStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'REMOTE';
export type ExperienceLevel = 'ENTRY' | 'MID' | 'SENIOR' | 'LEAD' | 'EXECUTIVE';

export interface Job {
  id: string;
  company_id: string;
  department_id: string;
  created_by: string;
  title: string;
  description: string;
  requirements: string;
  location: string;
  employment_type: EmploymentType;
  experience_level: ExperienceLevel;
  salary_min: number | null;
  salary_max: number | null;
  status: JobStatus;
  deadline_utc: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type ApplicationStatus =
  | 'APPLIED'
  | 'SHORTLISTED'
  | 'INTERVIEW_SCHEDULED'
  | 'SELECTED'
  | 'HIRED'
  | 'REJECTED';

export interface Application {
  id: string;
  job_id: string;
  applicant_id: string;
  resume_id: string;
  status: ApplicationStatus;
  cover_letter: string | null;
  applied_at: string;
  updated_at: string;
}

export interface ApplicationStatusHistory {
  id: string;
  application_id: string;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  changed_by: string;
  note: string | null;
  changed_at: string;
}

export type InterviewStatus = 'SCHEDULED' | 'RESCHEDULED' | 'COMPLETED' | 'CANCELLED';
export type InterviewType = 'ONLINE' | 'IN_PERSON';

export interface Interview {
  id: string;
  application_id: string;
  interviewer_id: string;
  scheduled_by: string;
  scheduled_at_utc: string;
  duration_minutes: number;
  status: InterviewStatus;
  interview_type?: InterviewType;
  location_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type RecommendationDecision = 'STRONG_HIRE' | 'HIRE' | 'NO_HIRE' | 'STRONG_NO_HIRE';

export interface InterviewFeedback {
  id: string;
  interview_id: string;
  interviewer_id: string;
  rating: number; // 1 to 5
  notes: string;
  recommendation: RecommendationDecision;
  submitted_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: number;
  created_at: string;
  entity_type?: string | null;
  entity_id?: string | null;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata_json: string | null;
  created_at: string;
}
