-- Fix missing recruiter_id column in tbl_recruiter_activity table
-- This migration adds the missing recruiter_id column that should have been created in 003_clients_activity.sql

-- Add the missing recruiter_id column
ALTER TABLE tbl_recruiter_activity 
ADD COLUMN IF NOT EXISTS recruiter_id BIGINT NULL;

-- Add foreign key constraint to ensure recruiter_id references a valid user
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'tbl_recruiter_activity_recruiter_id_fkey'
    ) THEN
        ALTER TABLE tbl_recruiter_activity
        ADD CONSTRAINT tbl_recruiter_activity_recruiter_id_fkey
        FOREIGN KEY (recruiter_id) REFERENCES tbl_users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_tbl_recruiter_activity_recruiter_id ON tbl_recruiter_activity(recruiter_id);

