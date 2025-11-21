-- Add tl_id column to tbl_demand_sheet table
-- This column will store the Team Leader's user ID

-- Add the tl_id column
ALTER TABLE tbl_demand_sheet 
ADD COLUMN IF NOT EXISTS tl_id BIGINT NULL;

-- Add foreign key constraint to ensure tl_id references a valid user
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'tbl_demand_sheet_tl_id_fkey'
    ) THEN
        ALTER TABLE tbl_demand_sheet
        ADD CONSTRAINT tbl_demand_sheet_tl_id_fkey
        FOREIGN KEY (tl_id) REFERENCES tbl_users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_tbl_demand_sheet_tl_id ON tbl_demand_sheet(tl_id);


