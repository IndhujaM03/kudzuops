-- Add assigned_to column to tbl_demand_sheet table
-- This column will store the ID of the user that this demand is assigned to

-- Add the assigned_to column (check if it exists and what type it is)
DO $$
BEGIN
    -- Check if column exists and what type it is
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tbl_demand_sheet' AND column_name = 'assigned_to'
    ) THEN
        -- If it exists as JSONB, alter it to BIGINT
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'tbl_demand_sheet' 
            AND column_name = 'assigned_to' 
            AND data_type = 'jsonb'
        ) THEN
            -- Drop the column and recreate it as BIGINT
            ALTER TABLE tbl_demand_sheet DROP COLUMN assigned_to;
            ALTER TABLE tbl_demand_sheet ADD COLUMN assigned_to BIGINT NULL;
        END IF;
    ELSE
        -- Column doesn't exist, add it
        ALTER TABLE tbl_demand_sheet 
        ADD COLUMN assigned_to BIGINT NULL;
    END IF;
END $$;

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


