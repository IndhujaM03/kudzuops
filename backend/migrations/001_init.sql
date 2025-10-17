-- Enable required extensions (jsonb is built-in; uuid only if needed)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_type_enum') THEN
        CREATE TYPE user_type_enum AS ENUM ('candidate', 'recruiter', 'hiring_manager', 'admin');
    END IF;
END $$;

-- Tables: roles first (referenced by permissions and users)
CREATE TABLE IF NOT EXISTS tbl_roles (
    id BIGSERIAL PRIMARY KEY,
    role_name TEXT NOT NULL,
    role_key TEXT NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Role permissions (depends on roles)
CREATE TABLE IF NOT EXISTS tbl_role_permissions (
    id BIGSERIAL PRIMARY KEY,
    role_id BIGINT NOT NULL REFERENCES tbl_roles(id) ON DELETE CASCADE,
    module TEXT NOT NULL,
    permission_key TEXT NOT NULL,
    is_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_role_perm UNIQUE (role_id, module, permission_key)
);

-- Users (can reference roles and self via created_by)
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    email TEXT UNIQUE,
    phone_number TEXT UNIQUE,
    password_hash TEXT,
    user_type user_type_enum NOT NULL,
    role BIGINT REFERENCES tbl_roles(id),
    profile_picture_url TEXT,
    location TEXT,
    address TEXT,
    timezone TEXT,
    linkedin_url TEXT,
    resume_url TEXT,
    job_title TEXT,
    department TEXT,
    team_id BIGINT,
    designation TEXT,
    permissions JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    last_password_change_at TIMESTAMPTZ,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    created_by BIGINT REFERENCES tbl_users(id)
);

-- Optional helpful indexes
CREATE INDEX IF NOT EXISTS idx_users_user_type ON tbl_users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON tbl_users(is_active);

