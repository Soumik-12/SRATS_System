-- V3__authentication_support.sql
-- SRATS Authentication, Refresh Token Persistence, and Account Status Support

-- 1. Add account_status column to users table with default 'ACTIVE'
ALTER TABLE users ADD COLUMN account_status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL;

-- 2. Create refresh_tokens table for secure token rotation and server-side revocation
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at_utc VARCHAR(50) NOT NULL,
  revoked_at_utc VARCHAR(50) NULL,
  created_at VARCHAR(50) NOT NULL,
  replaced_by_token_id VARCHAR(50) NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
