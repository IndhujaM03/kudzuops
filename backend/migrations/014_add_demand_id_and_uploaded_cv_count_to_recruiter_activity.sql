-- Add demand_id and uploaded_cv_count columns to tbl_recruiter_activity table
-- This will link recruiter activity to specific demands and track CV uploads

-- Add the demand_id column (foreign key to tbl_demand_sheet)
ALTER TABLE tbl_recruiter_activity 
ADD COLUMN IF NOT EXISTS demand_id BIGINT NULL;

-- Add the uploaded_cv_count column
ALTER TABLE tbl_recruiter_activity 
ADD COLUMN IF NOT EXISTS uploaded_cv_count INT NOT NULL DEFAULT 0;

-- Add the required_cv_count column (to maintain reference to demand sheet's required profile count)
ALTER TABLE tbl_recruiter_activity 
ADD COLUMN IF NOT EXISTS required_cv_count INT NULL;

-- Add foreign key constraint to ensure demand_id references a valid demand
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'tbl_recruiter_activity_demand_id_fkey'
    ) THEN
        ALTER TABLE tbl_recruiter_activity
        ADD CONSTRAINT tbl_recruiter_activity_demand_id_fkey
        FOREIGN KEY (demand_id) REFERENCES tbl_demand_sheet(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tbl_recruiter_activity_demand_id ON tbl_recruiter_activity(demand_id);
CREATE INDEX IF NOT EXISTS idx_tbl_recruiter_activity_uploaded_cv_count ON tbl_recruiter_activity(uploaded_cv_count);
CREATE INDEX IF NOT EXISTS idx_tbl_recruiter_activity_required_cv_count ON tbl_recruiter_activity(required_cv_count);

-- Add composite index for demand and recruiter queries
CREATE INDEX IF NOT EXISTS idx_tbl_recruiter_activity_demand_recruiter ON tbl_recruiter_activity(demand_id, recruiter_id);
