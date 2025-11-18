ALTER TABLE IF EXISTS tbl_candidate_onboarding
    ADD COLUMN IF NOT EXISTS generated_link TEXT,
    ADD COLUMN IF NOT EXISTS status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS documents JSONB;

CREATE INDEX IF NOT EXISTS idx_tbl_candidate_onboarding_status
    ON tbl_candidate_onboarding (status);


