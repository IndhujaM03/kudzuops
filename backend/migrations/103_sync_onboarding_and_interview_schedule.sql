-- ==============================================
-- MIGRATION 103: Sync Onboarding & Interview Schema with Current Code
-- ==============================================
-- This migration brings the database schema in line with the current
-- backend code for:
--   - tbl_candidate_onboarding
--   - tbl_interview_schedule
-- It formalizes columns that are currently being created via runtime ALTERs.
-- Date: 2025-12-01
-- ==============================================


-- ==============================================
-- 1) CANDIDATE ONBOARDING TABLE
-- ==============================================

-- Base table definition (kept compatible with existing schema)
CREATE TABLE IF NOT EXISTS tbl_candidate_onboarding (
    id BIGSERIAL PRIMARY KEY,
    candidate_name       VARCHAR(255),
    candidate_email      VARCHAR(255),
    candidate_phone      VARCHAR(255),
    client_id            BIGINT REFERENCES tbl_clients(id) ON DELETE SET NULL,
    recruiter_id         BIGINT REFERENCES tbl_users(id) ON DELETE SET NULL,
    cv_path              TEXT,
    interview_schedules  JSONB,
    generated_link       TEXT,
    status               VARCHAR(50),
    documents            JSONB,
    demand_id            BIGINT,
    skill                VARCHAR(255),
    spoc_name            VARCHAR(255),
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all expected columns exist
ALTER TABLE IF EXISTS tbl_candidate_onboarding
    ADD COLUMN IF NOT EXISTS generated_link TEXT,
    ADD COLUMN IF NOT EXISTS status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS documents JSONB,
    ADD COLUMN IF NOT EXISTS demand_id BIGINT,
    ADD COLUMN IF NOT EXISTS skill VARCHAR(255),
    ADD COLUMN IF NOT EXISTS spoc_name VARCHAR(255);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_tbl_candidate_onboarding_status
    ON tbl_candidate_onboarding (status);

CREATE INDEX IF NOT EXISTS idx_tbl_candidate_onboarding_client_id
    ON tbl_candidate_onboarding (client_id);

CREATE INDEX IF NOT EXISTS idx_tbl_candidate_onboarding_recruiter_id
    ON tbl_candidate_onboarding (recruiter_id);

CREATE INDEX IF NOT EXISTS idx_tbl_candidate_onboarding_generated_link
    ON tbl_candidate_onboarding (generated_link)
    WHERE generated_link IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tbl_candidate_onboarding_demand_id
    ON tbl_candidate_onboarding (demand_id);

CREATE INDEX IF NOT EXISTS idx_tbl_candidate_onboarding_skill
    ON tbl_candidate_onboarding (skill);


-- ==============================================
-- 2) INTERVIEW SCHEDULE TABLE
-- ==============================================

-- Base table definition matching _ensure_interview_schedule_table()
CREATE TABLE IF NOT EXISTS tbl_interview_schedule (
    id                  BIGSERIAL PRIMARY KEY,
    candidate_name      VARCHAR(255) NOT NULL,
    recruiter_name      VARCHAR(255),
    recruiter_id        BIGINT,
    submission_id       BIGINT,
    demand_id           BIGINT,
    candidate_email     VARCHAR(255),
    candidate_phone     VARCHAR(50),
    round               VARCHAR(50),
    status              VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    interview_schedules JSONB,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all expected columns exist (for legacy tables)
ALTER TABLE IF EXISTS tbl_interview_schedule
    ADD COLUMN IF NOT EXISTS recruiter_name   VARCHAR(255),
    ADD COLUMN IF NOT EXISTS recruiter_id     BIGINT,
    ADD COLUMN IF NOT EXISTS submission_id    BIGINT,
    ADD COLUMN IF NOT EXISTS demand_id        BIGINT,
    ADD COLUMN IF NOT EXISTS candidate_email  VARCHAR(255),
    ADD COLUMN IF NOT EXISTS candidate_phone  VARCHAR(50),
    ADD COLUMN IF NOT EXISTS round            VARCHAR(50),
    ADD COLUMN IF NOT EXISTS status           VARCHAR(50) DEFAULT 'scheduled',
    ADD COLUMN IF NOT EXISTS interview_schedules JSONB,
    ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW();

-- Indexes used by current queries
CREATE INDEX IF NOT EXISTS idx_interview_schedule_status 
    ON tbl_interview_schedule(status);

CREATE INDEX IF NOT EXISTS idx_interview_schedule_recruiter_id 
    ON tbl_interview_schedule(recruiter_id);

CREATE INDEX IF NOT EXISTS idx_interview_schedule_submission_id 
    ON tbl_interview_schedule(submission_id);

CREATE INDEX IF NOT EXISTS idx_interview_schedule_demand_id 
    ON tbl_interview_schedule(demand_id);

CREATE INDEX IF NOT EXISTS idx_interview_schedule_json 
    ON tbl_interview_schedule USING GIN (interview_schedules);


-- ==============================================
-- COMMENTS
-- ==============================================
COMMENT ON TABLE tbl_candidate_onboarding IS
  'Stores candidate onboarding information, linked to demand, recruiter, and client, plus documents and status.';

COMMENT ON TABLE tbl_interview_schedule IS
  'Stores interview schedules with rounds and slots in JSON format, linked to submissions, demands, and recruiters.';


