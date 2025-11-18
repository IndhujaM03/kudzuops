-- Migration: Add candidate fields to tbl_submissions
-- This allows tracking individual candidate accept/reject actions

ALTER TABLE tbl_submissions 
ADD COLUMN IF NOT EXISTS candidate_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS candidate_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS candidate_phone VARCHAR(50);

COMMENT ON COLUMN tbl_submissions.candidate_name IS 'Name of the candidate being accepted/rejected';
COMMENT ON COLUMN tbl_submissions.candidate_email IS 'Email of the candidate';
COMMENT ON COLUMN tbl_submissions.candidate_phone IS 'Phone number of the candidate';

<<<<<<< HEAD
=======



>>>>>>> features
