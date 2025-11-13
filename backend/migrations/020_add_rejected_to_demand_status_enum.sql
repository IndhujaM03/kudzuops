-- Migration: Add 'rejected' value to demand_status_enum
-- This allows demands to be marked as rejected when cancelled

-- Add 'rejected' to the enum if it doesn't exist
DO $$ 
BEGIN
    -- Check if 'rejected' already exists in the enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'rejected' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'demand_status_enum')
    ) THEN
        ALTER TYPE demand_status_enum ADD VALUE 'rejected';
    END IF;
END $$;

COMMENT ON TYPE demand_status_enum IS 'Status values for demand sheet: open, in_progress, closed, on_hold, rejected';




