-- V1__initial_schema.sql
-- SRATS Foundation Baseline Schema
-- Establishes migration tracking and system configuration metadata with foreign keys

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  applied_at VARCHAR(50) NOT NULL,
  checksum VARCHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS system_metadata (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at VARCHAR(50) NOT NULL
);

-- Foundation relational tables to verify foreign key enforcement, cascading, and transaction atomicity
CREATE TABLE IF NOT EXISTS system_modules (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  version VARCHAR(20) NOT NULL,
  created_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS system_module_configs (
  id VARCHAR(50) PRIMARY KEY,
  module_id VARCHAR(50) NOT NULL,
  config_key VARCHAR(100) NOT NULL,
  config_val TEXT NOT NULL,
  FOREIGN KEY (module_id) REFERENCES system_modules(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_module_configs_module_id ON system_module_configs(module_id);
