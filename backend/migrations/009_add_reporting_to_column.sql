-- Add reporting_to column to tbl_users table
-- This column will store the ID of the user that this user reports to

-- Add the reporting_to column
ALTER TABLE tbl_users 
ADD COLUMN IF NOT EXISTS reporting_to BIGINT NULL;

-- Add foreign key constraint to ensure reporting_to references a valid user
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'tbl_users_reporting_to_fkey'
    ) THEN
        ALTER TABLE tbl_users
        ADD CONSTRAINT tbl_users_reporting_to_fkey
        FOREIGN KEY (reporting_to) REFERENCES tbl_users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_tbl_users_reporting_to ON tbl_users(reporting_to);

-- Add index for role-based queries
CREATE INDEX IF NOT EXISTS idx_tbl_users_role_reporting ON tbl_users(role, reporting_to);


