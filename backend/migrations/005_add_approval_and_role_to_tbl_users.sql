-- Add approval and role fields to tbl_users
-- Safe to run multiple times due to IF NOT EXISTS checks

ALTER TABLE IF EXISTS tbl_users
ADD COLUMN IF NOT EXISTS approval_status BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS approved_by BIGINT NULL,
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'candidate';

-- Add FK for approved_by referencing tbl_users(id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'tbl_users_approved_by_fkey'
    ) THEN
        ALTER TABLE tbl_users
        ADD CONSTRAINT tbl_users_approved_by_fkey
        FOREIGN KEY (approved_by) REFERENCES tbl_users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Indexes to speed up superadmin queries
CREATE INDEX IF NOT EXISTS idx_tbl_users_approval_status ON tbl_users(approval_status);
CREATE INDEX IF NOT EXISTS idx_tbl_users_role ON tbl_users(role);


