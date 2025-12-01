-- Migration: Add cv_date field to existing CV entries in cv_list
-- This script backfills the cv_date field for existing CV entries
-- The cv_date will be set to the activity's updated_at date if not present

-- Function to update cv_list with cv_date field
DO $$
DECLARE
    activity_record RECORD;
    cv_list_json JSONB;
    updated_cv_list JSONB;
    cv_entry JSONB;
    cv_date_value DATE;
BEGIN
    -- Loop through all recruiter activities
    FOR activity_record IN 
        SELECT id, cv_list, updated_at 
        FROM tbl_recruiter_activity 
        WHERE cv_list IS NOT NULL 
        AND jsonb_array_length(cv_list) > 0
    LOOP
        cv_list_json := activity_record.cv_list;
        updated_cv_list := '[]'::JSONB;
        
        -- Process each CV entry in the list
        FOR cv_entry IN SELECT * FROM jsonb_array_elements(cv_list_json)
        LOOP
            -- If cv_date doesn't exist, set it to the activity's updated_at date
            IF cv_entry->>'cv_date' IS NULL THEN
                cv_date_value := DATE(activity_record.updated_at);
                -- Update the CV entry with cv_date
                cv_entry := cv_entry || jsonb_build_object('cv_date', cv_date_value::text);
            END IF;
            
            -- Add the updated CV entry to the new list
            updated_cv_list := updated_cv_list || jsonb_build_array(cv_entry);
        END LOOP;
        
        -- Update the activity record with the updated cv_list
        UPDATE tbl_recruiter_activity
        SET cv_list = updated_cv_list
        WHERE id = activity_record.id;
    END LOOP;
END $$;

-- Add comment to document the migration
COMMENT ON COLUMN tbl_recruiter_activity.cv_list IS 
'JSONB array of CV entries. Each entry should include cv_date field (YYYY-MM-DD format) for date filtering. If cv_date is missing, queries will fall back to activity updated_at date.';


