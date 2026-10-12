-- V7__resume_ai_analysis.sql
-- Relational storage for AI-powered resume extractions, consent audit, and structured profile candidate imports

CREATE TABLE IF NOT EXISTS resume_analyses (
  id VARCHAR(50) PRIMARY KEY,
  resume_id VARCHAR(50) NOT NULL,
  applicant_id VARCHAR(50) NOT NULL,
  consent_given INTEGER DEFAULT 1 NOT NULL,
  consent_timestamp VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  model_used VARCHAR(100) NOT NULL,
  prompt_version VARCHAR(50) NOT NULL,
  extracted_headline VARCHAR(255) NULL,
  extracted_summary TEXT NULL,
  skills_json TEXT NULL,
  experience_json TEXT NULL,
  education_json TEXT NULL,
  certifications_json TEXT NULL,
  confidence_score REAL NULL,
  is_confirmed INTEGER DEFAULT 0 NOT NULL,
  confirmed_at VARCHAR(50) NULL,
  error_message TEXT NULL,
  created_at VARCHAR(50) NOT NULL,
  updated_at VARCHAR(50) NOT NULL,
  FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE,
  FOREIGN KEY (applicant_id) REFERENCES applicant_profiles(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_resume_analyses_resume ON resume_analyses(resume_id);
CREATE INDEX IF NOT EXISTS idx_resume_analyses_applicant ON resume_analyses(applicant_id);
CREATE INDEX IF NOT EXISTS idx_resume_analyses_status ON resume_analyses(status);
