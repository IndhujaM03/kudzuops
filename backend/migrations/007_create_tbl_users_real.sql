-- Ensure a real table `tbl_users` exists with columns expected by the app
-- This migration replaces the compatibility VIEW approach with a concrete table.
-- Safe to run even if a VIEW exists: it will drop the view first.

DO $$
BEGIN
    -- If a VIEW named tbl_users exists, drop it to allow creating the table
    IF EXISTS (
        SELECT 1 FROM pg_views WHERE viewname = 'tbl_users'
    ) THEN
        EXECUTE 'DROP VIEW IF EXISTS tbl_users CASCADE';
    END IF;
END
$$;

-- Create the table if it does not exist
CREATE TABLE IF NOT EXISTS tbl_users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE,
  password_hash TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  user_type TEXT NOT NULL DEFAULT 'candidate',
  approval_status BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by BIGINT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'candidate',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optional self-reference for approved_by
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

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_tbl_users_email ON tbl_users(email);
CREATE INDEX IF NOT EXISTS idx_tbl_users_approval_status ON tbl_users(approval_status);
CREATE INDEX IF NOT EXISTS idx_tbl_users_role ON tbl_users(role);




