-- Migration: Rename cv_date to recruiter_date in cv_list column
-- This migration updates all CV entries in tbl_recruiter_activity.cv_list
-- to use recruiter_date instead of cv_date
-- The recruiter_date field represents when the recruiter uploaded the profile

DO $$
DECLARE
    activity_record RECORD;
    cv_list_json JSONB;
    cv_entry JSONB;
    updated_cv_list JSONB;
    updated_entry JSONB;
    has_changes BOOLEAN;
BEGIN
    RAISE NOTICE 'Starting migration: Renaming cv_date to recruiter_date in cv_list...';
    
    -- Loop through all recruiter activities
    FOR activity_record IN 
        SELECT id, cv_list 
        FROM tbl_recruiter_activity 
        WHERE cv_list IS NOT NULL 
        AND jsonb_typeof(cv_list) = 'array'
    LOOP
        updated_cv_list := '[]'::JSONB;
        has_changes := FALSE;
        
        -- Process each CV entry in the cv_list
        FOR cv_entry IN SELECT * FROM jsonb_array_elements(activity_record.cv_list)
        LOOP
            updated_entry := cv_entry;
            
            -- If cv_entry has cv_date but not recruiter_date, rename it
            IF cv_entry ? 'cv_date' AND NOT (cv_entry ? 'recruiter_date') THEN
                updated_entry := updated_entry || jsonb_build_object('recruiter_date', cv_entry->>'cv_date');
                updated_entry := updated_entry - 'cv_date';
                has_changes := TRUE;
            -- If both exist, keep recruiter_date and remove cv_date
            ELSIF cv_entry ? 'cv_date' AND cv_entry ? 'recruiter_date' THEN
                updated_entry := updated_entry - 'cv_date';
                has_changes := TRUE;
            -- If neither exists and this is a new entry, add recruiter_date with current date
            ELSIF NOT (cv_entry ? 'recruiter_date') AND NOT (cv_entry ? 'cv_date') THEN
                updated_entry := updated_entry || jsonb_build_object('recruiter_date', CURRENT_DATE::text);
                has_changes := TRUE;
            END IF;
            
            updated_cv_list := updated_cv_list || jsonb_build_array(updated_entry);
        END LOOP;
        
        -- Update the activity record if changes were made
        IF has_changes THEN
            UPDATE tbl_recruiter_activity 
            SET cv_list = updated_cv_list,
                updated_at = NOW()
            WHERE id = activity_record.id;
            
            RAISE NOTICE 'Updated activity ID %: Renamed cv_date to recruiter_date', activity_record.id;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Migration completed: All cv_date fields have been renamed to recruiter_date';
END $$;

-- Verify migration: Count entries that still have cv_date (should be 0)
DO $$
DECLARE
    count_with_cv_date INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_with_cv_date
    FROM tbl_recruiter_activity
    WHERE cv_list IS NOT NULL
    AND EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(cv_list) AS cv
        WHERE cv ? 'cv_date'
    );
    
    IF count_with_cv_date > 0 THEN
        RAISE WARNING 'Warning: % activities still have cv_date field after migration', count_with_cv_date;
    ELSE
        RAISE NOTICE 'Success: All cv_date fields have been successfully renamed to recruiter_date';
    END IF;
END $$;
<<<<<<< HEAD
=======



>>>>>>> features
