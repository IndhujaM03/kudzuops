-- ==============================================
-- KUDZU OPERATIONS DATABASE SCHEMA
-- ==============================================
-- Complete database schema for Kudzu Operations
-- Run this script in your PostgreSQL query tool to create the database structure
-- Created: 2025-10-23
-- Purpose: Replicate database tables and structure on remote server

-- ==============================================
-- EXTENSIONS AND ENUMS
-- ==============================================

-- Enable required extensions
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom enums
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_type_enum') THEN
        CREATE TYPE user_type_enum AS ENUM ('candidate', 'recruiter', 'hiring_manager', 'admin', 'internal');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'demand_status_enum') THEN
        CREATE TYPE demand_status_enum AS ENUM ('open', 'in_progress', 'closed', 'on_hold');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'priority_enum') THEN
        CREATE TYPE priority_enum AS ENUM ('low', 'medium', 'high', 'critical');
    END IF;
END $$;

-- ==============================================
-- CORE TABLES
-- ==============================================

-- 1. Roles Table
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

-- 2. Role Permissions Table
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

-- 3. Users Table
CREATE TABLE IF NOT EXISTS tbl_users (
    id BIGSERIAL PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    email TEXT UNIQUE,
    phone_number TEXT UNIQUE,
    password_hash TEXT,
    user_type user_type_enum NOT NULL,
    role VARCHAR(50),
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
    created_by BIGINT REFERENCES tbl_users(id),
    approval_status BOOLEAN DEFAULT FALSE,
    approved_by BIGINT REFERENCES tbl_users(id),
    reporting_to BIGINT REFERENCES tbl_users(id)
);

-- 4. Clients Table
CREATE TABLE IF NOT EXISTS tbl_clients (
    id BIGSERIAL PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    industry VARCHAR(255),
    location VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Client SPOCs Table
CREATE TABLE IF NOT EXISTS tbl_client_spocs (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES tbl_clients(id) ON DELETE CASCADE,
    spoc_name VARCHAR(255) NOT NULL,
    designation VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(50) UNIQUE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    spoc_reporting_manager CHAR(1)
);

-- 6. Demand Sheet Table
CREATE TABLE IF NOT EXISTS tbl_demand_sheet (
    id BIGSERIAL PRIMARY KEY,
    demand_date DATE NOT NULL,
    client_id BIGINT NOT NULL REFERENCES tbl_clients(id) ON DELETE CASCADE,
    spoc_id BIGINT REFERENCES tbl_client_spocs(id) ON DELETE SET NULL,
    skill VARCHAR(255),
    no_of_positions INT NOT NULL DEFAULT 1,
    status demand_status_enum NOT NULL DEFAULT 'open',
    priority priority_enum NOT NULL DEFAULT 'medium',
    job_description_url TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    required_cv_count INT DEFAULT 0,
    assigned_to JSONB
);

-- 7. Recruiter Activity Table
CREATE TABLE IF NOT EXISTS tbl_recruiter_activity (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    recruiter_id BIGINT REFERENCES tbl_users(id) ON DELETE CASCADE,
    demand_id BIGINT REFERENCES tbl_demand_sheet(id) ON DELETE CASCADE,
    uploaded_cv_count INT DEFAULT 0 NOT NULL,
    required_cv_count INT,
    cv_list JSONB DEFAULT '[]'::jsonb,
    activity_status TEXT,
    approved_cv_count INT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    closed_at TIMESTAMP,
    opened_at TIMESTAMP
);

-- 8. Submissions Table
CREATE TABLE IF NOT EXISTS tbl_submissions (
    id BIGSERIAL PRIMARY KEY,
    submission_date DATE NOT NULL,
    submission_week INT,
    recruiter_id BIGINT REFERENCES tbl_users(id) ON DELETE SET NULL,
    spoc_id BIGINT REFERENCES tbl_client_spocs(id) ON DELETE SET NULL,
    skill VARCHAR(255),
    demand_id BIGINT REFERENCES tbl_demand_sheet(id) ON DELETE CASCADE,
    no_of_submissions INT NOT NULL DEFAULT 0,
    shortlisted INT NOT NULL DEFAULT 0,
    feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. OTPs Table
CREATE TABLE IF NOT EXISTS tbl_otps (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    purpose VARCHAR(20) NOT NULL,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed BOOLEAN NOT NULL DEFAULT FALSE
);

-- 10. CV Downloads Table
CREATE TABLE IF NOT EXISTS tbl_cv_downloads (
    id SERIAL PRIMARY KEY,
    recruiter_id INT NOT NULL,
    demand_id INT NOT NULL,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    status TEXT,
    candidate_details JSONB
);

-- 11. CV Uploads Table
CREATE TABLE IF NOT EXISTS tbl_cv_uploads (
    id SERIAL PRIMARY KEY,
    recruiter_id INT NOT NULL,
    demand_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT now()
);

-- 12. Recruiter Settings Table
CREATE TABLE IF NOT EXISTS tbl_recruiter_settings (
    id SERIAL PRIMARY KEY,
    recruiter_id INT UNIQUE,
    cv_download_path TEXT,
    folder_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- 13. Recruiter Submissions Table
CREATE TABLE IF NOT EXISTS tbl_recruiter_submissions (
    id BIGSERIAL PRIMARY KEY,
    recruiter_id BIGINT NOT NULL,
    demand_id BIGINT NOT NULL,
    candidate_name TEXT NOT NULL,
    candidate_email TEXT NOT NULL,
    candidate_phone TEXT,
    notes TEXT,
    cv_ids JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'submitted',
    submitted_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. Candidate Submissions Table
CREATE TABLE IF NOT EXISTS tbl_candidate_submissions (
    id SERIAL PRIMARY KEY,
    demand_id INT,
    recruiter_id INT,
    file_name TEXT,
    file_time TIMESTAMP,
    candidate_name VARCHAR(255),
    candidate_email VARCHAR(255),
    candidate_phone VARCHAR(255),
    remarks TEXT,
    verified_status VARCHAR(50) DEFAULT 'under_verification',
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- 15. Audit Trail Table
CREATE TABLE IF NOT EXISTS tbl_audit_trail (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(255) NOT NULL,
    recruiter_id INT,
    demand_id INT,
    file_name VARCHAR(255),
    file_path TEXT,
    details JSONB,
    created_at TIMESTAMP DEFAULT now()
);

-- ==============================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- ==============================================

-- Add missing columns to tbl_clients
ALTER TABLE tbl_clients ADD COLUMN IF NOT EXISTS client_code VARCHAR(50);
ALTER TABLE tbl_clients ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE tbl_clients ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255);
ALTER TABLE tbl_clients ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'inactive';

-- Add missing columns to tbl_demand_sheet
ALTER TABLE tbl_demand_sheet ADD COLUMN IF NOT EXISTS spoc_id BIGINT REFERENCES tbl_client_spocs(id) ON DELETE SET NULL;
ALTER TABLE tbl_demand_sheet ADD COLUMN IF NOT EXISTS remarks TEXT;

-- Add missing columns to tbl_recruiter_activity
ALTER TABLE tbl_recruiter_activity ADD COLUMN IF NOT EXISTS activity_status TEXT;
ALTER TABLE tbl_recruiter_activity ADD COLUMN IF NOT EXISTS required_cv_count INT;

-- Add missing column to tbl_client_spocs
ALTER TABLE tbl_client_spocs ADD COLUMN IF NOT EXISTS spoc_reporting_manager CHAR(1);

-- Add missing column to tbl_users
ALTER TABLE tbl_users ADD COLUMN IF NOT EXISTS reporting_to BIGINT REFERENCES tbl_users(id);

-- ==============================================
-- INDEXES FOR PERFORMANCE
-- ==============================================

-- Users indexes (on underlying users table, not the view)
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Client SPOCs indexes
CREATE INDEX IF NOT EXISTS idx_client_spocs_client ON tbl_client_spocs(client_id);

-- Demand Sheet indexes
CREATE INDEX IF NOT EXISTS idx_demand_sheet_client ON tbl_demand_sheet(client_id);
CREATE INDEX IF NOT EXISTS idx_tbl_demand_sheet_required_cv_count ON tbl_demand_sheet(required_cv_count);
CREATE INDEX IF NOT EXISTS idx_tbl_demand_sheet_status_required_cv ON tbl_demand_sheet(status, required_cv_count);
CREATE INDEX IF NOT EXISTS idx_demand_sheet_assigned_to ON tbl_demand_sheet (assigned_to);

-- Recruiter Activity indexes
CREATE INDEX IF NOT EXISTS idx_recruiter_activity_recruiter_demand ON tbl_recruiter_activity(recruiter_id, demand_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_activity_status ON tbl_recruiter_activity(activity_status);
CREATE INDEX IF NOT EXISTS idx_tbl_recruiter_activity_cv_list ON tbl_recruiter_activity USING GIN (cv_list);
CREATE INDEX IF NOT EXISTS idx_tbl_recruiter_activity_cv_status ON tbl_recruiter_activity USING GIN ((cv_list->'status'));
CREATE INDEX IF NOT EXISTS idx_tbl_recruiter_activity_demand_id ON tbl_recruiter_activity(demand_id);
CREATE INDEX IF NOT EXISTS idx_tbl_recruiter_activity_demand_recruiter ON tbl_recruiter_activity(demand_id, recruiter_id);
CREATE INDEX IF NOT EXISTS idx_tbl_recruiter_activity_recruiter_id ON tbl_recruiter_activity(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_tbl_recruiter_activity_required_cv_count ON tbl_recruiter_activity(required_cv_count);
CREATE INDEX IF NOT EXISTS idx_tbl_recruiter_activity_uploaded_cv_count ON tbl_recruiter_activity(uploaded_cv_count);

-- Submissions indexes
CREATE INDEX IF NOT EXISTS idx_submissions_demand ON tbl_submissions(demand_id);

-- OTPs indexes
CREATE INDEX IF NOT EXISTS idx_tbl_otps_email_purpose ON tbl_otps(email, purpose);
CREATE INDEX IF NOT EXISTS idx_tbl_otps_expires_at ON tbl_otps(expires_at);

-- Audit Trail indexes
CREATE INDEX IF NOT EXISTS idx_audit_trail_demand ON tbl_audit_trail(demand_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_recruiter ON tbl_audit_trail(recruiter_id);

-- ==============================================
-- SEED DATA
-- ==============================================

-- Insert default roles
INSERT INTO tbl_roles (role_name, role_key, description, is_system_role, is_active, is_default)
VALUES
  ('Admin', 'admin', 'Can manage all users and settings', TRUE, TRUE, FALSE),
  ('Recruiter', 'recruiter', 'Handles candidate sourcing and pipeline', TRUE, TRUE, TRUE),
  ('Candidate', 'candidate', 'End user applying for jobs', TRUE, TRUE, TRUE),
  ('Hiring Manager', 'hiring_manager', 'Reviews and approves candidates', TRUE, TRUE, FALSE),
  ('Team Lead', 'team_lead', 'Leads a team of recruiters', TRUE, TRUE, FALSE),
  ('Super Admin', 'super_admin', 'System administrator with full access', TRUE, TRUE, FALSE)
ON CONFLICT (role_key) DO NOTHING;

-- Insert role permissions
WITH roles AS (
  SELECT id, role_key FROM tbl_roles
)
INSERT INTO tbl_role_permissions (role_id, module, permission_key, is_allowed)
SELECT r.id, p.module, p.permission_key, p.is_allowed
FROM roles r
JOIN (
  VALUES
    -- Admin: allow all basic actions on key modules
    ('admin','users','view',TRUE), ('admin','users','create',TRUE), ('admin','users','edit',TRUE), ('admin','users','delete',TRUE), ('admin','users','export',TRUE),
    ('admin','jobs','view',TRUE), ('admin','jobs','create',TRUE), ('admin','jobs','edit',TRUE), ('admin','jobs','delete',TRUE), ('admin','jobs','export',TRUE),
    ('admin','candidates','view',TRUE), ('admin','candidates','create',TRUE), ('admin','candidates','edit',TRUE), ('admin','candidates','delete',TRUE), ('admin','candidates','export',TRUE),

    -- Recruiter: typical permissions
    ('recruiter','candidates','view',TRUE), ('recruiter','candidates','create',TRUE), ('recruiter','candidates','edit',TRUE), ('recruiter','candidates','delete',FALSE), ('recruiter','candidates','export',TRUE),
    ('recruiter','jobs','view',TRUE), ('recruiter','jobs','create',TRUE), ('recruiter','jobs','edit',TRUE), ('recruiter','jobs','delete',FALSE), ('recruiter','jobs','export',TRUE),

    -- Candidate: self-scope
    ('candidate','self','view',TRUE), ('candidate','self','edit',TRUE),

    -- Hiring Manager: review candidates and jobs
    ('hiring_manager','candidates','view',TRUE), ('hiring_manager','candidates','edit',TRUE), ('hiring_manager','candidates','delete',FALSE),
    ('hiring_manager','jobs','view',TRUE), ('hiring_manager','jobs','edit',TRUE),

    -- Team Lead: manage team and jobs
    ('team_lead','candidates','view',TRUE), ('team_lead','candidates','edit',TRUE), ('team_lead','candidates','delete',FALSE),
    ('team_lead','jobs','view',TRUE), ('team_lead','jobs','create',TRUE), ('team_lead','jobs','edit',TRUE), ('team_lead','jobs','delete',FALSE),

    -- Super Admin: full access
    ('super_admin','users','view',TRUE), ('super_admin','users','create',TRUE), ('super_admin','users','edit',TRUE), ('super_admin','users','delete',TRUE), ('super_admin','users','export',TRUE),
    ('super_admin','jobs','view',TRUE), ('super_admin','jobs','create',TRUE), ('super_admin','jobs','edit',TRUE), ('super_admin','jobs','delete',TRUE), ('super_admin','jobs','export',TRUE),
    ('super_admin','candidates','view',TRUE), ('super_admin','candidates','create',TRUE), ('super_admin','candidates','edit',TRUE), ('super_admin','candidates','delete',TRUE), ('super_admin','candidates','export',TRUE)
) AS p(role_key, module, permission_key, is_allowed)
  ON r.role_key = p.role_key
ON CONFLICT (role_id, module, permission_key) DO NOTHING;

-- ==============================================
-- SCHEMA COMPLETE
-- ==============================================
-- Total tables created: 15
-- Schema creation completed successfully

