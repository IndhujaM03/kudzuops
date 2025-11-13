-- Migration: Ensure all CV entries in cv_list have cv_date field
-- This is a more comprehensive version that handles all edge cases

DO $$
DECLARE
    activity_record RECORD;
    cv_list_json JSONB;
    updated_cv_list JSONB;
    cv_entry JSONB;
    cv_date_value DATE;
    has_changes BOOLEAN;
BEGIN
    -- Loop through all recruiter activities
    FOR activity_record IN 
        SELECT id, cv_list, updated_at, created_at 
        FROM tbl_recruiter_activity 
        WHERE cv_list IS NOT NULL 
        AND jsonb_array_length(cv_list) > 0
    LOOP
        cv_list_json := activity_record.cv_list;
        updated_cv_list := '[]'::JSONB;
        has_changes := FALSE;
        
        -- Process each CV entry in the list
        FOR cv_entry IN SELECT * FROM jsonb_array_elements(cv_list_json)
        LOOP
            -- If cv_date doesn't exist or is empty, set it
            IF cv_entry->>'cv_date' IS NULL OR cv_entry->>'cv_date' = '' THEN
                has_changes := TRUE;
                
                -- Try to extract date from various timestamp fields
                IF cv_entry->>'time' IS NOT NULL THEN
                    BEGIN
                        cv_date_value := (cv_entry->>'time')::timestamp::date;
                    EXCEPTION WHEN OTHERS THEN
                        cv_date_value := DATE(activity_record.updated_at);
                    END;
                ELSIF cv_entry->>'timestamp' IS NOT NULL THEN
                    BEGIN
                        cv_date_value := (cv_entry->>'timestamp')::timestamp::date;
                    EXCEPTION WHEN OTHERS THEN
                        cv_date_value := DATE(activity_record.updated_at);
                    END;
                ELSIF cv_entry->>'upload_date' IS NOT NULL THEN
                    BEGIN
                        cv_date_value := (cv_entry->>'upload_date')::date;
                    EXCEPTION WHEN OTHERS THEN
                        cv_date_value := DATE(activity_record.updated_at);
                    END;
                ELSE
                    -- Fallback to activity's updated_at or created_at
                    cv_date_value := COALESCE(DATE(activity_record.updated_at), DATE(activity_record.created_at), CURRENT_DATE);
                END IF;
                
                -- Update the CV entry with cv_date
                cv_entry := cv_entry || jsonb_build_object('cv_date', cv_date_value::text);
            END IF;
            
            -- Add the CV entry to the new list
            updated_cv_list := updated_cv_list || jsonb_build_array(cv_entry);
        END LOOP;
        
        -- Update the activity record only if changes were made
        IF has_changes THEN
            UPDATE tbl_recruiter_activity
            SET cv_list = updated_cv_list, updated_at = NOW()
            WHERE id = activity_record.id;
        END IF;
    END LOOP;
END $$;

-- Verify the migration
DO $$
DECLARE
    count_without_date INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_without_date
    FROM tbl_recruiter_activity ra
    WHERE ra.cv_list IS NOT NULL
    AND jsonb_array_length(ra.cv_list) > 0
    AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(ra.cv_list) AS cv
        WHERE cv->>'cv_date' IS NULL OR cv->>'cv_date' = ''
    );
    
    IF count_without_date > 0 THEN
        RAISE NOTICE 'Warning: % CV entries still missing cv_date after migration', count_without_date;
    ELSE
        RAISE NOTICE 'Success: All CV entries now have cv_date field';
    END IF;
END $$;


