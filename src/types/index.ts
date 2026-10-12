export type UserRole = 'APPLICANT' | 'RECRUITER' | 'INTERVIEWER' | 'HR_MANAGER' | 'ADMIN';
export type AccountStatus = 'ACTIVE' | 'PENDING' | 'DEACTIVATED';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  accountStatus: AccountStatus;
  firstName: string;
  lastName: string;
  companyId: string | null;
}

export interface AuthSessionResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface HealthCheckData {
  status: 'UP' | 'DOWN';
  service: string;
  version: string;
  timestamp: string;
  database: 'UP' | 'DOWN';
  uptimeSeconds: number;
  checks: {
    database: {
      status: 'UP' | 'DOWN';
      latencyMs?: number;
      error?: string;
    };
  };
}

export interface ApiErrorPayload {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  traceId: string;
  details?: unknown;
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

export interface ProfileCompleteness {
  percentage: number;
  missingFields: string[];
}

export interface ApplicantProfileData {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  headline: string | null;
  summary: string | null;
  location: string | null;
  website: string | null;
  educationJson: string | null;
  experienceJson: string | null;
  createdAt: string;
  updatedAt: string;
  completeness: ProfileCompleteness;
}

export interface ResumeMetadata {
  id: string;
  applicantId: string;
  fileName: string;
  fileMime: string;
  fileSize: number;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
}

export type JobStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'REMOTE';
export type ExperienceLevel = 'ENTRY' | 'MID' | 'SENIOR' | 'LEAD' | 'EXECUTIVE';

export interface Company {
  id: string;
  name: string;
  domain: string;
  industry: string;
  size: string;
  location: string;
  is_active: number;
  created_at: string;
}

export interface Department {
  id: string;
  company_id: string;
  name: string;
  created_at: string;
}

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

export interface PaginatedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface CreateJobInput {
  title: string;
  department_id: string;
  location: string;
  employment_type: EmploymentType;
  experience_level: ExperienceLevel;
  salary_min?: number | null;
  salary_max?: number | null;
  deadline_utc?: string | null;
  description: string;
  requirements: string;
}

export interface UpdateJobInput {
  title?: string;
  department_id?: string;
  location?: string;
  employment_type?: EmploymentType;
  experience_level?: ExperienceLevel;
  salary_min?: number | null;
  salary_max?: number | null;
  deadline_utc?: string | null;
  description?: string;
  requirements?: string;
}

// Interview Management Types
export type InterviewStatus = 'SCHEDULED' | 'RESCHEDULED' | 'COMPLETED' | 'CANCELLED';
export type InterviewType = 'ONLINE' | 'IN_PERSON';
export type RecommendationDecision = 'STRONG_HIRE' | 'HIRE' | 'NO_HIRE' | 'STRONG_NO_HIRE';

export interface InterviewFeedback {
  id: string;
  interview_id: string;
  interviewer_id: string;
  rating: number;
  notes: string;
  recommendation: RecommendationDecision;
  submitted_at: string;
}

export interface Interview {
  id: string;
  application_id: string;
  interviewer_id: string;
  scheduled_by: string;
  scheduled_at_utc: string;
  duration_minutes: number;
  status: InterviewStatus;
  interview_type: InterviewType;
  location_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

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

export interface ScheduleInterviewInput {
  application_id: string;
  interviewer_id: string;
  scheduled_at_utc: string;
  duration_minutes: number;
  interview_type: InterviewType;
  location_url: string;
  notes?: string | null;
}

export interface RescheduleInterviewInput {
  scheduled_at_utc: string;
  duration_minutes?: number;
  reason?: string | null;
}

export interface SubmitFeedbackInput {
  rating: number;
  notes: string;
  recommendation: RecommendationDecision;
}

export interface InterviewerUser {
  id: string;
  name: string;
  email: string;
}

export interface EligibleApplication {
  id: string;
  job_id: string;
  job_title: string;
  status: string;
  applicant_name: string;
  applicant_email: string;
}

// Domain Notification Types
export interface AppNotification {
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

// Application & Pipeline Types
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
}

export interface ApplicationStatusHistoryItem {
  id: string;
  application_id: string;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  changed_by: string;
  note: string | null;
  changed_at: string;
  actor_name?: string;
  actor_role?: string;
}

export interface SubmitApplicationInput {
  job_id: string;
  resume_id: string;
  cover_letter?: string | null;
}

export interface UpdateApplicationStatusInput {
  status: ApplicationStatus;
  note?: string | null;
}

