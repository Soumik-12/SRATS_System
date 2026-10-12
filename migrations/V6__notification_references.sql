-- V6__notification_references.sql
-- Add optional entity_type and entity_id to notifications for direct traceable navigation

ALTER TABLE notifications ADD COLUMN entity_type VARCHAR(50) NULL;
ALTER TABLE notifications ADD COLUMN entity_id VARCHAR(50) NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_type, entity_id);
