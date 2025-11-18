-- ==============================================
-- MIGRATION 102: Sync Current Database Schema
-- ==============================================
-- This migration ensures all tables and columns match the current database state
-- Created to fix direct database modifications
-- Date: 2025-10-30

-- ==============================================
-- CANDIDATE ONBOARDING TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS tbl_candidate_onboarding (
    id BIGSERIAL PRIMARY KEY,
    candidate_name VARCHAR(255),
    candidate_email VARCHAR(255),
    candidate_phone VARCHAR(255),
    client_id BIGINT REFERENCES tbl_clients(id) ON DELETE SET NULL,
    recruiter_id BIGINT REFERENCES tbl_users(id) ON DELETE SET NULL,
    cv_path TEXT,
    interview_schedules JSONB,
    generated_link TEXT,
    status VARCHAR(50),
    documents JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if they don't exist (for existing tables)
ALTER TABLE IF EXISTS tbl_candidate_onboarding
    ADD COLUMN IF NOT EXISTS generated_link TEXT,
    ADD COLUMN IF NOT EXISTS status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS documents JSONB;

-- Indexes for onboarding
CREATE INDEX IF NOT EXISTS idx_tbl_candidate_onboarding_status
    ON tbl_candidate_onboarding (status);

CREATE INDEX IF NOT EXISTS idx_tbl_candidate_onboarding_client_id
    ON tbl_candidate_onboarding (client_id);

CREATE INDEX IF NOT EXISTS idx_tbl_candidate_onboarding_recruiter_id
    ON tbl_candidate_onboarding (recruiter_id);

CREATE INDEX IF NOT EXISTS idx_tbl_candidate_onboarding_generated_link
    ON tbl_candidate_onboarding (generated_link) WHERE generated_link IS NOT NULL;

-- ==============================================
-- INTERVIEW SCHEDULE TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS tbl_interview_schedule (
    id BIGSERIAL PRIMARY KEY,
    candidate_name VARCHAR(255) NOT NULL,
    recruiter_name VARCHAR(255),
    recruiter_id BIGINT,
    email VARCHAR(255),
    round VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    interview_schedules JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for interview schedule
CREATE INDEX IF NOT EXISTS idx_interview_schedule_status 
    ON tbl_interview_schedule(status);

CREATE INDEX IF NOT EXISTS idx_interview_schedule_recruiter_id 
    ON tbl_interview_schedule(recruiter_id);

CREATE INDEX IF NOT EXISTS idx_interview_schedule_json 
    ON tbl_interview_schedule USING GIN (interview_schedules);

-- ==============================================
-- INTERVIEWS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS tbl_interviews (
    id BIGSERIAL PRIMARY KEY,
    submission_id BIGINT NOT NULL,
    recruiter_id BIGINT NOT NULL,
    interview_date TIMESTAMPTZ NOT NULL,
    mode TEXT NOT NULL DEFAULT 'online',
    status TEXT NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interviews_recruiter_id 
    ON tbl_interviews(recruiter_id);

CREATE INDEX IF NOT EXISTS idx_interviews_submission_id 
    ON tbl_interviews(submission_id);

CREATE INDEX IF NOT EXISTS idx_interviews_status 
    ON tbl_interviews(status);

-- ==============================================
-- COMMENTS
-- ==============================================
COMMENT ON TABLE tbl_candidate_onboarding IS 'Stores candidate onboarding information with documents and status';
COMMENT ON TABLE tbl_interview_schedule IS 'Stores interview schedules with rounds and slots in JSON format';
COMMENT ON TABLE tbl_interviews IS 'Stores individual interview records';

