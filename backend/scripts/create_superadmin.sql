-- Manual migration and super admin creation script
-- Run this with: psql -h localhost -U kudzuops -d kudzuops -f create_superadmin.sql

-- Add approval and role fields to tbl_users (safe to run multiple times)
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tbl_users_approval_status ON tbl_users(approval_status);
CREATE INDEX IF NOT EXISTS idx_tbl_users_role ON tbl_users(role);

-- Create super admin user (password: admin123)
INSERT INTO tbl_users (email, password_hash, is_verified, user_type, approval_status, role) 
VALUES (
    'admin@kudzu.com', 
    'pbkdf2_sha256$' || encode(gen_random_bytes(16), 'hex') || '$' || encode(digest('admin123' || encode(gen_random_bytes(16), 'hex'), 'sha256'), 'hex'),
    true, 
    'candidate', 
    true, 
    'super_admin'
) ON CONFLICT (email) DO UPDATE SET 
    role = 'super_admin',
    approval_status = true,
    is_verified = true;

-- Verify the super admin was created
SELECT id, email, role, approval_status, is_verified FROM tbl_users WHERE role = 'super_admin';
