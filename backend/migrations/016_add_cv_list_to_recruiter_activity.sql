-- Add cv_list JSON column to tbl_recruiter_activity table
-- This will store CV information with status tracking for TL approval/rejection

-- Add the cv_list column as JSONB for better performance and indexing
ALTER TABLE tbl_recruiter_activity 
ADD COLUMN IF NOT EXISTS cv_list JSONB DEFAULT '[]'::jsonb;

-- Add index for JSONB queries on cv_list
CREATE INDEX IF NOT EXISTS idx_tbl_recruiter_activity_cv_list ON tbl_recruiter_activity USING GIN (cv_list);

-- Add index for filtering CVs by status (status = 0 for waiting approval)
CREATE INDEX IF NOT EXISTS idx_tbl_recruiter_activity_cv_status ON tbl_recruiter_activity 
USING GIN ((cv_list->'status'));

-- Example structure of cv_list JSON:
-- [
--   {
--     "candidate_name": "John Doe",
--     "cv_url": "https://example.com/cv.pdf",
--     "upload_date": "2024-01-15",
--     "status": 0,  -- 0: Waiting for approval, 1: Approved, 2: Rejected
--     "candidate_email": "john@example.com",
--     "candidate_phone": "+1234567890",
--     "candidate_id": "CAND_001",  -- Unique identifier for the candidate
--     "remark": "Strong technical background with 5+ years experience",
--     "skills": ["Java", "Spring Boot", "Microservices"]
--   }
-- ]

