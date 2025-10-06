-- Add approval and role columns to tbl_users
ALTER TABLE tbl_users
  ADD COLUMN IF NOT EXISTS approval_status BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS approved_by INTEGER NULL REFERENCES tbl_users(id),
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'candidate';
