-- Fix missing recruiter_id column in tbl_recruiter_activity table
-- This migration adds the missing recruiter_id column that should have been created in 003_clients_activity.sql

-- Add the missing recruiter_id column
ALTER TABLE tbl_recruiter_activity 
ADD COLUMN IF NOT EXISTS recruiter_id BIGINT NULL;

-- Add foreign key constraint to ensure recruiter_id references a valid user
-- First, check if recruiter_id has a NOT NULL constraint and handle orphaned records
DO $$
BEGIN
    -- Temporarily drop NOT NULL constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tbl_recruiter_activity' 
        AND column_name = 'recruiter_id' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE tbl_recruiter_activity ALTER COLUMN recruiter_id DROP NOT NULL;
    END IF;
    
    -- Clean up orphaned records (set recruiter_id to NULL if user doesn't exist in tbl_users)
    UPDATE tbl_recruiter_activity
    SET recruiter_id = NULL
    WHERE recruiter_id IS NOT NULL
    AND recruiter_id NOT IN (SELECT id FROM tbl_users);
    
    -- Re-add NOT NULL constraint if needed (but only if all records now have valid recruiter_id)
    -- We'll leave it nullable to avoid issues with orphaned data
END $$;

-- Now add the foreign key constraint
DO $$
BEGIN
    -- Drop existing FK (if any) so we can safely recreate it pointing to tbl_users
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'tbl_recruiter_activity_recruiter_id_fkey'
          AND table_name = 'tbl_recruiter_activity'
    ) THEN
        ALTER TABLE tbl_recruiter_activity
        DROP CONSTRAINT tbl_recruiter_activity_recruiter_id_fkey;
    END IF;

    -- Now (re)create the FK pointing at tbl_users
    ALTER TABLE tbl_recruiter_activity
    ADD CONSTRAINT tbl_recruiter_activity_recruiter_id_fkey
    FOREIGN KEY (recruiter_id) REFERENCES tbl_users(id) ON DELETE CASCADE;
END $$;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_tbl_recruiter_activity_recruiter_id ON tbl_recruiter_activity(recruiter_id);

