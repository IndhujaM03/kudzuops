-- Add approval and role fields to users table (tbl_users is a view)
-- Safe to run multiple times due to IF NOT EXISTS checks

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
        ADD COLUMN approved_by BIGINT NULL;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'role'
    ) THEN
        ALTER TABLE users
        ADD COLUMN role VARCHAR(50) DEFAULT 'candidate';
    END IF;
END $$;

-- Add FK for approved_by referencing users(id) on the underlying table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'users_approved_by_fkey'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_approved_by_fkey
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Indexes to speed up superadmin queries (on the underlying users table)
CREATE INDEX IF NOT EXISTS idx_users_approval_status ON users(approval_status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);


