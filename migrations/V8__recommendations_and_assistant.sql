-- V8__recommendations_and_assistant.sql
-- Storage for AI-assisted job recommendations, conversation threads, and tool-assisted dialogue

CREATE TABLE IF NOT EXISTS job_recommendations (
  id VARCHAR(50) PRIMARY KEY,
  applicant_id VARCHAR(50) NOT NULL,
  consent_given INTEGER DEFAULT 1 NOT NULL,
  consent_timestamp VARCHAR(50) NOT NULL,
  fingerprint VARCHAR(64) NOT NULL,
  recommended_jobs_json TEXT NOT NULL,
  model_used VARCHAR(100) NOT NULL,
  created_at VARCHAR(50) NOT NULL,
  expires_at VARCHAR(50) NOT NULL,
  FOREIGN KEY (applicant_id) REFERENCES applicant_profiles(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_job_recommendations_applicant ON job_recommendations(applicant_id);
CREATE INDEX IF NOT EXISTS idx_job_recommendations_created ON job_recommendations(created_at);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  role VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  created_at VARCHAR(50) NOT NULL,
  updated_at VARCHAR(50) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated ON ai_conversations(updated_at);

CREATE TABLE IF NOT EXISTS ai_messages (
  id VARCHAR(50) PRIMARY KEY,
  conversation_id VARCHAR(50) NOT NULL,
  sender VARCHAR(20) NOT NULL CHECK (sender IN ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL')),
  content TEXT NOT NULL,
  tool_calls_json TEXT NULL,
  tool_results_json TEXT NULL,
  created_at VARCHAR(50) NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON ai_messages(conversation_id, created_at);
