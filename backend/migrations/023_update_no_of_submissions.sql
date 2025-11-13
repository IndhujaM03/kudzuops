-- Migration: Update no_of_submissions in tbl_submissions based on demand_id
-- This migration ensures that all records for the same demand_id have the same no_of_submissions value
-- which equals the count of ACCEPTED submissions (shortlisted = 1) for that demand_id
-- Rejected submissions (shortlisted = 0) are NOT counted

DO $$
DECLARE
    demand_record RECORD;
    accepted_count INTEGER;
BEGIN
    RAISE NOTICE 'Starting migration: Updating no_of_submissions based on accepted submissions only...';

    -- Loop through all unique demand_ids in tbl_submissions
    FOR demand_record IN
        SELECT DISTINCT demand_id
        FROM tbl_submissions
        WHERE demand_id IS NOT NULL
    LOOP
        -- Count only accepted submissions (shortlisted = 1) for this demand_id
        SELECT COUNT(*) INTO accepted_count
        FROM tbl_submissions
        WHERE demand_id = demand_record.demand_id AND shortlisted = 1;

        -- Update all records for this demand_id with the same no_of_submissions value
        -- This ensures all records (accepted and rejected) show the count of accepted submissions
        UPDATE tbl_submissions
        SET no_of_submissions = accepted_count,
            updated_at = NOW()
        WHERE demand_id = demand_record.demand_id;

        RAISE NOTICE 'Updated demand_id %: Set no_of_submissions to % (accepted count) for all records', 
            demand_record.demand_id, accepted_count;
    END LOOP;

    RAISE NOTICE 'Migration completed: All no_of_submissions values have been updated based on accepted submissions only';

    -- Verify migration: Check if counts are consistent
    DECLARE
        inconsistent_count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO inconsistent_count
        FROM tbl_submissions s1
        WHERE EXISTS (
            SELECT 1
            FROM tbl_submissions s2
            WHERE s2.demand_id = s1.demand_id
            AND s2.no_of_submissions != (
                SELECT COUNT(*)
                FROM tbl_submissions s3
                WHERE s3.demand_id = s1.demand_id AND s3.shortlisted = 1
            )
        );

        IF inconsistent_count > 0 THEN
            RAISE WARNING 'Warning: % records still have inconsistent no_of_submissions values', inconsistent_count;
        ELSE
            RAISE NOTICE 'Success: All no_of_submissions values are consistent with accepted submission counts';
        END IF;
    END;

END $$;

