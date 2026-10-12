-- V5__interview_enhancements.sql
-- SRATS Interview Management Enhancements
-- Adds interview_type column ('ONLINE', 'IN_PERSON') to interviews table

ALTER TABLE interviews ADD COLUMN interview_type VARCHAR(20) DEFAULT 'ONLINE' NOT NULL;
