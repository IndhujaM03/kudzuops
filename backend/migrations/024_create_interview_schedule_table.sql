-- Migration 024: Create tbl_interview_schedule with JSON structure
-- This table stores interview schedules with rounds and slots in JSON format

CREATE TABLE IF NOT EXISTS tbl_interview_schedule (
    id BIGSERIAL PRIMARY KEY,
    candidate_name VARCHAR(255) NOT NULL,
    recruiter_name VARCHAR(255),
    recruiter_id BIGINT,
    email VARCHAR(255),
    round VARCHAR(50), -- e.g., R1, R2, R3
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'slot_allocated', 'reschedule'
    interview_schedules JSONB, -- Stores rounds with slots: {"R1": {"slots": [...], "round_status": 0}}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_interview_schedule_status ON tbl_interview_schedule(status);

-- Create index for recruiter_id
CREATE INDEX IF NOT EXISTS idx_interview_schedule_recruiter_id ON tbl_interview_schedule(recruiter_id);

-- Create GIN index for JSONB column for efficient JSON queries
CREATE INDEX IF NOT EXISTS idx_interview_schedule_json ON tbl_interview_schedule USING GIN (interview_schedules);

COMMENT ON TABLE tbl_interview_schedule IS 'Stores interview schedules with rounds and slots in JSON format';
COMMENT ON COLUMN tbl_interview_schedule.interview_schedules IS 'JSON structure: {"R1": {"slots": [{"date": "2025-11-17", "time": "10:00 AM", "slot_status": 0}], "round_status": 0}}';
COMMENT ON COLUMN tbl_interview_schedule.status IS 'scheduled: slot created but not allocated, slot_allocated: slot assigned, reschedule: all slots rejected';

