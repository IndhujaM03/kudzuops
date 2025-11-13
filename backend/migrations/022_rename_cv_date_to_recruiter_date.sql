-- Migration: Rename cv_date to recruiter_date in cv_list JSONB field
-- This script renames all cv_date keys to recruiter_date in the cv_list array

DO $$
DECLARE
    activity_record RECORD;
    updated_cv_list JSONB;
    cv_entry JSONB;
    cv_array JSONB;
    i INT;
BEGIN
    -- Loop through all recruiter activity records
    FOR activity_record IN 
        SELECT id, cv_list 
        FROM tbl_recruiter_activity 
        WHERE cv_list IS NOT NULL 
        AND jsonb_typeof(cv_list) = 'array'
        AND jsonb_array_length(cv_list) > 0
    LOOP
        updated_cv_list := '[]'::jsonb;
        cv_array := activity_record.cv_list;
        
        -- Process each CV entry in the array
        FOR i IN 0..jsonb_array_length(cv_array) - 1 LOOP
            cv_entry := cv_array->i;
            
            -- If cv_entry has cv_date, rename it to recruiter_date
            IF cv_entry ? 'cv_date' THEN
                -- Copy all fields except cv_date, then add recruiter_date with cv_date's value
                cv_entry := cv_entry - 'cv_date' || jsonb_build_object('recruiter_date', cv_entry->'cv_date');
            END IF;
            
            -- Add the updated entry to the new array
            updated_cv_list := updated_cv_list || jsonb_build_array(cv_entry);
        END LOOP;
        
        -- Update the record with the modified cv_list
        UPDATE tbl_recruiter_activity 
        SET cv_list = updated_cv_list,
            updated_at = updated_at  -- Keep existing updated_at
        WHERE id = activity_record.id;
    END LOOP;
    
    RAISE NOTICE 'Success: Renamed cv_date to recruiter_date in all CV entries';
END $$;

-- Verify the migration
DO $$
DECLARE
    count_with_cv_date INT;
    count_with_recruiter_date INT;
BEGIN
    -- Count entries that still have cv_date
    SELECT COUNT(*) INTO count_with_cv_date
    FROM tbl_recruiter_activity ra
    CROSS JOIN LATERAL jsonb_array_elements(ra.cv_list) AS cv
    WHERE ra.cv_list IS NOT NULL
    AND jsonb_array_length(ra.cv_list) > 0
    AND cv ? 'cv_date';
    
    -- Count entries that have recruiter_date
    SELECT COUNT(*) INTO count_with_recruiter_date
    FROM tbl_recruiter_activity ra
    CROSS JOIN LATERAL jsonb_array_elements(ra.cv_list) AS cv
    WHERE ra.cv_list IS NOT NULL
    AND jsonb_array_length(ra.cv_list) > 0
    AND cv ? 'recruiter_date';
    
    IF count_with_cv_date > 0 THEN
        RAISE WARNING 'Warning: % CV entries still have cv_date after migration', count_with_cv_date;
    ELSE
        RAISE NOTICE 'Success: All cv_date keys have been renamed to recruiter_date';
    END IF;
    
    RAISE NOTICE 'Total CV entries with recruiter_date: %', count_with_recruiter_date;
END $$;




