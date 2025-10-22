-- Add assigned_to column to tbl_demand_sheet table
-- This column will store the ID of the user that this demand is assigned to

-- Add the assigned_to column
ALTER TABLE tbl_demand_sheet 
ADD COLUMN IF NOT EXISTS assigned_to BIGINT NULL;

-- Add foreign key constraint to ensure assigned_to references a valid user
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'tbl_demand_sheet_assigned_to_fkey'
    ) THEN
        ALTER TABLE tbl_demand_sheet
        ADD CONSTRAINT tbl_demand_sheet_assigned_to_fkey
        FOREIGN KEY (assigned_to) REFERENCES tbl_users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_tbl_demand_sheet_assigned_to ON tbl_demand_sheet(assigned_to);

-- Add index for status-based queries
CREATE INDEX IF NOT EXISTS idx_tbl_demand_sheet_assigned_status ON tbl_demand_sheet(assigned_to, status);


