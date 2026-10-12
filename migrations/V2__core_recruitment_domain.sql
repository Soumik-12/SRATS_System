-- V2__core_recruitment_domain.sql
-- SRATS Core Recruitment Domain Relational Schema
-- Implements: Identity, Company, Department, ApplicantProfile, Resume, ApplicantSkills,
--             Job, Application, ApplicationStatusHistory, Interview, InterviewFeedback,
--             Notification, AuditLog.

-- 1. Identity & Organization
CREATE TABLE IF NOT EXISTS companies (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  domain VARCHAR(255) NOT NULL,
  industry VARCHAR(100) NOT NULL,
  size VARCHAR(50) NOT NULL,
  location VARCHAR(255) NOT NULL,
  is_active INTEGER DEFAULT 1 NOT NULL,
  created_at VARCHAR(50) NOT NULL,
  updated_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS departments (
  id VARCHAR(50) PRIMARY KEY,
  company_id VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at VARCHAR(50) NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(50) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('APPLICANT', 'RECRUITER', 'INTERVIEWER', 'HR_MANAGER', 'ADMIN')),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  company_id VARCHAR(50) NULL,
  is_active INTEGER DEFAULT 1 NOT NULL,
  created_at VARCHAR(50) NOT NULL,
  updated_at VARCHAR(50) NOT NULL,
  deleted_at VARCHAR(50) NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);

-- 2. Applicant Profile, Resumes & Skills
CREATE TABLE IF NOT EXISTS applicant_profiles (
  user_id VARCHAR(50) PRIMARY KEY,
  phone VARCHAR(30) NULL,
  headline VARCHAR(255) NULL,
  summary TEXT NULL,
  location VARCHAR(255) NULL,
  website VARCHAR(255) NULL,
  created_at VARCHAR(50) NOT NULL,
  updated_at VARCHAR(50) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS resumes (
  id VARCHAR(50) PRIMARY KEY,
  applicant_id VARCHAR(50) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_mime VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  raw_text TEXT NULL,
  is_primary INTEGER DEFAULT 1 NOT NULL,
  is_active INTEGER DEFAULT 1 NOT NULL,
  created_at VARCHAR(50) NOT NULL,
  deleted_at VARCHAR(50) NULL,
  FOREIGN KEY (applicant_id) REFERENCES applicant_profiles(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_resumes_applicant ON resumes(applicant_id);

CREATE TABLE IF NOT EXISTS applicant_skills (
  id VARCHAR(50) PRIMARY KEY,
  applicant_id VARCHAR(50) NOT NULL,
  skill_name VARCHAR(100) NOT NULL,
  level VARCHAR(50) NOT NULL CHECK (level IN ('BEGINNER', 'INTERMEDIATE', 'EXPERT')),
  is_verified INTEGER DEFAULT 0 NOT NULL,
  created_at VARCHAR(50) NOT NULL,
  FOREIGN KEY (applicant_id) REFERENCES applicant_profiles(user_id) ON DELETE CASCADE,
  UNIQUE(applicant_id, skill_name)
);

CREATE INDEX IF NOT EXISTS idx_applicant_skills_name ON applicant_skills(skill_name);

-- 3. Jobs & Lifecycle
CREATE TABLE IF NOT EXISTS jobs (
  id VARCHAR(50) PRIMARY KEY,
  company_id VARCHAR(50) NOT NULL,
  department_id VARCHAR(50) NOT NULL,
  created_by VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT NOT NULL,
  location VARCHAR(255) NOT NULL,
  employment_type VARCHAR(50) NOT NULL CHECK (employment_type IN ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'REMOTE')),
  experience_level VARCHAR(50) NOT NULL CHECK (experience_level IN ('ENTRY', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE')),
  salary_min INTEGER NULL,
  salary_max INTEGER NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED', 'CLOSED')),
  deadline_utc VARCHAR(50) NULL,
  is_active INTEGER DEFAULT 1 NOT NULL,
  created_at VARCHAR(50) NOT NULL,
  updated_at VARCHAR(50) NOT NULL,
  deleted_at VARCHAR(50) NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);

-- 4. Application Workflow & Status History
CREATE TABLE IF NOT EXISTS applications (
  id VARCHAR(50) PRIMARY KEY,
  job_id VARCHAR(50) NOT NULL,
  applicant_id VARCHAR(50) NOT NULL,
  resume_id VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL CHECK (status IN ('APPLIED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'HIRED', 'REJECTED')),
  cover_letter TEXT NULL,
  applied_at VARCHAR(50) NOT NULL,
  updated_at VARCHAR(50) NOT NULL,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE RESTRICT,
  FOREIGN KEY (applicant_id) REFERENCES applicant_profiles(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE RESTRICT,
  UNIQUE(job_id, applicant_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant ON applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

CREATE TABLE IF NOT EXISTS application_status_history (
  id VARCHAR(50) PRIMARY KEY,
  application_id VARCHAR(50) NOT NULL,
  from_status VARCHAR(30) NULL,
  to_status VARCHAR(30) NOT NULL,
  changed_by VARCHAR(50) NOT NULL,
  note TEXT NULL,
  changed_at VARCHAR(50) NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_status_history_app ON application_status_history(application_id);

-- 5. Interviews & Feedback
CREATE TABLE IF NOT EXISTS interviews (
  id VARCHAR(50) PRIMARY KEY,
  application_id VARCHAR(50) NOT NULL,
  interviewer_id VARCHAR(50) NOT NULL,
  scheduled_by VARCHAR(50) NOT NULL,
  scheduled_at_utc VARCHAR(50) NOT NULL,
  duration_minutes INTEGER DEFAULT 45 NOT NULL,
  status VARCHAR(30) NOT NULL CHECK (status IN ('SCHEDULED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED')),
  location_url VARCHAR(500) NULL,
  notes TEXT NULL,
  created_at VARCHAR(50) NOT NULL,
  updated_at VARCHAR(50) NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE RESTRICT,
  FOREIGN KEY (interviewer_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (scheduled_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_interviews_app ON interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_interviews_interviewer ON interviews(interviewer_id);
CREATE INDEX IF NOT EXISTS idx_interviews_scheduled_at ON interviews(scheduled_at_utc);

CREATE TABLE IF NOT EXISTS interview_feedback (
  id VARCHAR(50) PRIMARY KEY,
  interview_id VARCHAR(50) UNIQUE NOT NULL,
  interviewer_id VARCHAR(50) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  notes TEXT NOT NULL,
  recommendation VARCHAR(50) NOT NULL CHECK (recommendation IN ('STRONG_HIRE', 'HIRE', 'NO_HIRE', 'STRONG_NO_HIRE')),
  submitted_at VARCHAR(50) NOT NULL,
  FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE,
  FOREIGN KEY (interviewer_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- 6. System Notifications & Audit Trail
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0 NOT NULL,
  created_at VARCHAR(50) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(50) PRIMARY KEY,
  actor_id VARCHAR(50) NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(50) NOT NULL,
  metadata_json TEXT NULL,
  created_at VARCHAR(50) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
