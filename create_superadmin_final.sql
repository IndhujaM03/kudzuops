-- Super Admin Setup Script
-- Run this in your PostgreSQL database

-- Apply migration to add approval fields
ALTER TABLE IF EXISTS tbl_users
ADD COLUMN IF NOT EXISTS approval_status BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS approved_by BIGINT NULL,
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'candidate';

-- Add foreign key constraint
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tbl_users_approval_status ON tbl_users(approval_status);
CREATE INDEX IF NOT EXISTS idx_tbl_users_role ON tbl_users(role);

-- Create super admin user with password "admin123"
-- This hash was generated using PBKDF2 with 200,000 iterations
INSERT INTO tbl_users (email, password_hash, is_verified, user_type, approval_status, role)
VALUES (
    'admin@kudzu.com',
    'pbkdf2_sha256$0f95662f0a4e2d985a07bde6c01e2335$229d839cbfd48a7a0933d1b84579d5a037b4c8bb2f8ad2cd58e22985c7ffcd3316e5ac4509163615a47f1ef00be2208e850e17b5b014f537a1828e7b09d146c1',
    TRUE,
    'admin',
    TRUE,
    'super_admin'
)
ON CONFLICT (email) DO UPDATE SET
    is_verified = TRUE,
    user_type = 'admin',
    approval_status = TRUE,
    role = 'super_admin';

-- Verify the super admin was created
SELECT id, email, is_verified, approval_status, role, created_at 
FROM tbl_users 
WHERE role = 'super_admin';

-- Show all users for verification
SELECT id, email, role, approval_status, is_verified 
FROM tbl_users 
ORDER BY created_at DESC;
