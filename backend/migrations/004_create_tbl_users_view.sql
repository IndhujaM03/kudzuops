-- Create or replace a compatibility view so code can reference tbl_users
-- while the canonical storage remains the users table
CREATE OR REPLACE VIEW tbl_users AS
SELECT
    id,
    first_name,
    last_name,
    email,
    phone_number,
    password_hash,
    user_type,
    role,
    profile_picture_url,
    location,
    address,
    timezone,
    linkedin_url,
    resume_url,
    job_title,
    department,
    team_id,
    designation,
    permissions,
    is_active,
    is_verified,
    last_login_at,
    last_password_change_at,
    failed_login_attempts,
    locked_until,
    two_factor_enabled,
    created_at,
    updated_at,
    deleted_at,
    created_by
FROM users;




