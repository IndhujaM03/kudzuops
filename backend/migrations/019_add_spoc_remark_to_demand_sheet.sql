-- Migration: Add spoc_remark column to tbl_demand_sheet
-- This column stores remarks from the SPOC/Team Leader when updating demand status

ALTER TABLE tbl_demand_sheet ADD COLUMN IF NOT EXISTS spoc_remark TEXT;

COMMENT ON COLUMN tbl_demand_sheet.spoc_remark IS 'Remarks from SPOC/Team Leader when updating demand status';

