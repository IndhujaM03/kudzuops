-- Add required_cv_count column to tbl_demand_sheet table
-- This column will store the number of profiles required for this demand

-- Add the required_cv_count column
ALTER TABLE tbl_demand_sheet 
ADD COLUMN IF NOT EXISTS required_cv_count INT NULL DEFAULT 0;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_tbl_demand_sheet_required_cv_count ON tbl_demand_sheet(required_cv_count);

-- Add index for status and required count queries
CREATE INDEX IF NOT EXISTS idx_tbl_demand_sheet_status_required_cv ON tbl_demand_sheet(status, required_cv_count);
