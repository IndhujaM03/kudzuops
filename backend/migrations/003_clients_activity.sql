-- Enums for demand sheet status and priority
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'demand_status_enum') THEN
        CREATE TYPE demand_status_enum AS ENUM ('open','in_progress','closed','on_hold');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'priority_enum') THEN
        CREATE TYPE priority_enum AS ENUM ('low','medium','high','critical');
    END IF;
END $$;

-- 1) Clients
CREATE TABLE IF NOT EXISTS tbl_clients (
    id BIGSERIAL PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    industry VARCHAR(255),
    location VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Client SPOCs
CREATE TABLE IF NOT EXISTS tbl_client_spocs (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES tbl_clients(id) ON DELETE CASCADE,
    spoc_name VARCHAR(255) NOT NULL,
    designation VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(50) UNIQUE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Recruiter Activity
-- recruiter_id references tbl_users.id
CREATE TABLE IF NOT EXISTS tbl_recruiter_activity (
    id BIGSERIAL PRIMARY KEY,
    recruiter_id BIGINT NOT NULL REFERENCES tbl_users(id) ON DELETE CASCADE,
    analysis_date DATE NOT NULL,
    skill VARCHAR(255),
    cvs_sourced INT NOT NULL DEFAULT 0,
    calls_connected INT NOT NULL DEFAULT 0,
    recommended_profiles INT NOT NULL DEFAULT 0,
    client_id BIGINT REFERENCES tbl_clients(id) ON DELETE SET NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) Demand Sheet
CREATE TABLE IF NOT EXISTS tbl_demand_sheet (
    id BIGSERIAL PRIMARY KEY,
    demand_date DATE NOT NULL,
    client_id BIGINT NOT NULL REFERENCES tbl_clients(id) ON DELETE CASCADE,
    spoc_id BIGINT REFERENCES tbl_client_spocs(id) ON DELETE SET NULL,
    recruiter_id BIGINT REFERENCES tbl_users(id) ON DELETE SET NULL,
    skill VARCHAR(255),
    no_of_positions INT NOT NULL DEFAULT 1,
    status demand_status_enum NOT NULL DEFAULT 'open',
    priority priority_enum NOT NULL DEFAULT 'medium',
    job_description_url TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5) Submissions
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

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_client_spocs_client ON tbl_client_spocs(client_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_activity_recruiter ON tbl_recruiter_activity(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_demand_sheet_client ON tbl_demand_sheet(client_id);
CREATE INDEX IF NOT EXISTS idx_submissions_demand ON tbl_submissions(demand_id);

















