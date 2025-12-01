-- Add approval and role columns to users table (tbl_users is a view)
-- These columns should already exist in the users table, but we add them if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'approval_status'
    ) THEN
        ALTER TABLE users
        ADD COLUMN approval_status BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'approved_by'
    ) THEN
        ALTER TABLE users
        ADD COLUMN approved_by INTEGER NULL;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'role'
    ) THEN
        ALTER TABLE users
        ADD COLUMN role VARCHAR(50) DEFAULT 'candidate';
    END IF;
END $$;
