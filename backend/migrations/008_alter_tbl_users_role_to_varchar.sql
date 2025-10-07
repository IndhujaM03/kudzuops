-- Alter tbl_users.role to a character type (character varying(50))
-- Safe to re-run: TYPE change to the same type is a no-op

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'tbl_users' AND column_name = 'role'
    ) THEN
        -- If role is not already character varying, coerce it via text
        EXECUTE $$
            ALTER TABLE tbl_users
            ALTER COLUMN role TYPE character varying(50) USING role::text
        $$;
    END IF;
END
$$;




