-- V4__applicant_profile_enhancements.sql
-- SRATS Applicant Profile Enhancements
-- Adds structured education and experience JSON columns for applicant profiles

ALTER TABLE applicant_profiles ADD COLUMN education_json TEXT NULL;
ALTER TABLE applicant_profiles ADD COLUMN experience_json TEXT NULL;
