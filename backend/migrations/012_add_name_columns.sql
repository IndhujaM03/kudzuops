-- Add first_name and last_name columns to tbl_users table
-- Remove username column if it exists

-- Add the name columns
ALTER TABLE tbl_users 
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) NULL;

-- Remove username column if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tbl_users' AND column_name = 'username'
    ) THEN
        ALTER TABLE tbl_users DROP COLUMN username;
    END IF;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tbl_users_first_name ON tbl_users(first_name);
CREATE INDEX IF NOT EXISTS idx_tbl_users_last_name ON tbl_users(last_name);

-- Update existing users to have names based on email prefix if names are null
UPDATE tbl_users 
SET first_name = SPLIT_PART(email, '@', 1),
    last_name = ''
WHERE first_name IS NULL AND last_name IS NULL AND email IS NOT NULL;

