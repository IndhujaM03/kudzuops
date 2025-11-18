import os
import json
from typing import Any, Dict, List, Optional
from datetime import datetime

import psycopg
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

# Database connection
DATABASE_DSN = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/kudzu_operations")

router = APIRouter(prefix="/api", tags=["Interviews"])

# Pydantic models
class InterviewCreate(BaseModel):
    submission_id: int
    recruiter_id: int
    interview_date: str
    mode: str = "online"
    status: str = "scheduled"

class InterviewUpdate(BaseModel):
    status: str

def _ensure_tables():
    """Ensure interview tables exist"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Create interviews table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS tbl_interviews (
                        id BIGSERIAL PRIMARY KEY,
                        submission_id BIGINT NOT NULL,
                        recruiter_id BIGINT NOT NULL,
                        interview_date TIMESTAMPTZ NOT NULL,
                        mode TEXT NOT NULL DEFAULT 'online',
                        status TEXT NOT NULL DEFAULT 'scheduled',
                        notes TEXT,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    );
                """)
                
                # Create index for better performance
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_interviews_recruiter_id 
                    ON tbl_interviews(recruiter_id);
                """)
                
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_interviews_submission_id 
                    ON tbl_interviews(submission_id);
                """)
                
                conn.commit()
    except Exception as e:
        print(f"Error ensuring interview tables: {e}")

@router.get("/interviews/recruiter/{recruiter_id}")
def get_recruiter_interviews(recruiter_id: int, page: int = 1, size: int = 10) -> Dict[str, Any]:
    """Get all interviews for a specific recruiter"""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Count total
                cur.execute(
                    "SELECT COUNT(*) FROM tbl_interviews WHERE recruiter_id = %s",
                    (recruiter_id,)
                )
                total = int(cur.fetchone()[0])
                
                # Get interviews with submission and demand info
                cur.execute("""
                    SELECT 
                        i.id, i.submission_id, i.recruiter_id, i.interview_date, 
                        i.mode, i.status, i.notes, i.created_at, i.updated_at,
                        rs.candidate_name, rs.candidate_email, rs.demand_id,
                        ds.skill as job_title, c.client_name
                    FROM tbl_interviews i
                    LEFT JOIN tbl_recruiter_submissions rs ON i.submission_id = rs.id
                    LEFT JOIN tbl_demand_sheet ds ON rs.demand_id = ds.id
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    WHERE i.recruiter_id = %s
                    ORDER BY i.interview_date DESC
                    LIMIT %s OFFSET %s
                """, (recruiter_id, size, (page - 1) * size))
                
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description]
                interviews = [dict(zip(cols, row)) for row in rows]
                
                return {
                    "items": interviews,
                    "total": total,
                    "page": page,
                    "size": size
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch interviews: {e}")

@router.get("/interviews/all")
def get_all_interviews(page: int = 1, size: int = 10) -> Dict[str, Any]:
    """Get all interviews (for TL/Manager/SuperAdmin)"""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Count total
                cur.execute("SELECT COUNT(*) FROM tbl_interviews")
                total = int(cur.fetchone()[0])
                
                # Get interviews with submission and demand info
                cur.execute("""
                    SELECT 
                        i.id, i.submission_id, i.recruiter_id, i.interview_date, 
                        i.mode, i.status, i.notes, i.created_at, i.updated_at,
                        rs.candidate_name, rs.candidate_email, rs.demand_id,
                        ds.skill as job_title, c.client_name,
                        u.display_name as recruiter_name
                    FROM tbl_interviews i
                    LEFT JOIN tbl_recruiter_submissions rs ON i.submission_id = rs.id
                    LEFT JOIN tbl_demand_sheet ds ON rs.demand_id = ds.id
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    LEFT JOIN tbl_users u ON i.recruiter_id = u.id
                    ORDER BY i.interview_date DESC
                    LIMIT %s OFFSET %s
                """, (size, (page - 1) * size))
                
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description]
                interviews = [dict(zip(cols, row)) for row in rows]
                
                return {
                    "items": interviews,
                    "total": total,
                    "page": page,
                    "size": size
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch interviews: {e}")

@router.post("/interviews")
def create_interview(interview: InterviewCreate) -> Dict[str, Any]:
    """Create a new interview"""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Parse interview date
                interview_datetime = datetime.fromisoformat(interview.interview_date.replace('Z', '+00:00'))
                
                cur.execute("""
                    INSERT INTO tbl_interviews 
                    (submission_id, recruiter_id, interview_date, mode, status)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    interview.submission_id,
                    interview.recruiter_id,
                    interview_datetime,
                    interview.mode,
                    interview.status
                ))
                
                interview_id = cur.fetchone()[0]
                conn.commit()
                
                return {
                    "message": "Interview created successfully",
                    "interview_id": interview_id
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create interview: {e}")

@router.patch("/interviews/{interview_id}/status")
def update_interview_status(interview_id: int, update: InterviewUpdate) -> Dict[str, Any]:
    """Update interview status"""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE tbl_interviews 
                    SET status = %s, updated_at = NOW()
                    WHERE id = %s
                    RETURNING id
                """, (update.status, interview_id))
                
                if cur.fetchone() is None:
                    raise HTTPException(status_code=404, detail="Interview not found")
                
                conn.commit()
                
                return {
                    "message": "Interview status updated successfully",
                    "interview_id": interview_id,
                    "status": update.status
                }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update interview status: {e}")

@router.get("/interviews/{interview_id}")
def get_interview(interview_id: int) -> Dict[str, Any]:
    """Get interview details"""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 
                        i.id, i.submission_id, i.recruiter_id, i.interview_date, 
                        i.mode, i.status, i.notes, i.created_at, i.updated_at,
                        rs.candidate_name, rs.candidate_email, rs.candidate_phone, rs.demand_id,
                        ds.skill as job_title, c.client_name,
                        u.display_name as recruiter_name
                    FROM tbl_interviews i
                    LEFT JOIN tbl_recruiter_submissions rs ON i.submission_id = rs.id
                    LEFT JOIN tbl_demand_sheet ds ON rs.demand_id = ds.id
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    LEFT JOIN tbl_users u ON i.recruiter_id = u.id
                    WHERE i.id = %s
                """, (interview_id,))
                
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="Interview not found")
                
                cols = [d[0] for d in cur.description]
                interview = dict(zip(cols, row))
                
                return interview
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch interview: {e}")

@router.delete("/interviews/{interview_id}")
def delete_interview(interview_id: int) -> Dict[str, Any]:
    """Delete an interview"""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM tbl_interviews WHERE id = %s RETURNING id", (interview_id,))
                
                if cur.fetchone() is None:
                    raise HTTPException(status_code=404, detail="Interview not found")
                
                conn.commit()
                
                return {
                    "message": "Interview deleted successfully",
                    "interview_id": interview_id
                }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete interview: {e}")

def _ensure_interview_schedule_table():
    """Ensure tbl_interview_schedule table exists"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Create interview schedule table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS tbl_interview_schedule (
                        id BIGSERIAL PRIMARY KEY,
                        submission_id BIGINT,
                        recruiter_id BIGINT NOT NULL,
                        candidate_name TEXT,
                        demand_id BIGINT,
                        candidate_email TEXT,
                        candidate_phone TEXT,
                        interview_schedules TEXT,  -- JSON column to store round-based schedule data
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    );
                """)
                
                # Add interview_schedules column if table exists but column doesn't
                cur.execute("""
                    DO $$ 
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'tbl_interview_schedule' 
                            AND column_name = 'interview_schedules'
                        ) THEN
                            ALTER TABLE tbl_interview_schedule 
                            ADD COLUMN interview_schedules TEXT;
                        END IF;
                    END $$;
                """)
                
                # Drop cv_ids column if it exists (migration)
                cur.execute("""
                    DO $$ 
                    BEGIN
                        IF EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'tbl_interview_schedule' 
                            AND column_name = 'cv_ids'
                        ) THEN
                            ALTER TABLE tbl_interview_schedule 
                            DROP COLUMN cv_ids;
                        END IF;
                    END $$;
                """)
                
                # Add status column if it doesn't exist
                cur.execute("""
                    DO $$ 
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'tbl_interview_schedule' 
                            AND column_name = 'status'
                        ) THEN
                            ALTER TABLE tbl_interview_schedule 
                            ADD COLUMN status TEXT DEFAULT 'scheduled';
                        END IF;
                    END $$;
                """)
                
                # Create indexes for better performance
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_interview_schedule_recruiter_id 
                    ON tbl_interview_schedule(recruiter_id);
                """)
                
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_interview_schedule_demand_id 
                    ON tbl_interview_schedule(demand_id);
                """)
                
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_interview_schedule_submission_id 
                    ON tbl_interview_schedule(submission_id);
                """)
                
                conn.commit()
    except Exception as e:
        print(f"Error ensuring interview schedule table: {e}")

@router.post("/interview-schedule/multiple-slots")
def create_interview_schedule(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Create interview schedule with multiple rounds and slots stored as JSON"""
    _ensure_interview_schedule_table()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Validate required fields
                if not payload.get('recruiter_id'):
                    raise HTTPException(status_code=400, detail="recruiter_id is required")
                if not payload.get('demand_id'):
                    raise HTTPException(status_code=400, detail="demand_id is required")
                if not payload.get('interview_schedules'):
                    raise HTTPException(status_code=400, detail="interview_schedules (schedule JSON) is required")
                
                # Insert or update interview schedule
                # Check if schedule already exists for this candidate
                cur.execute("""
                    SELECT id FROM tbl_interview_schedule 
                    WHERE recruiter_id = %s 
                    AND demand_id = %s 
                    AND (candidate_email = %s OR candidate_name = %s)
                    LIMIT 1
                """, (
                    payload.get('recruiter_id'),
                    payload.get('demand_id'),
                    payload.get('candidate_email'),
                    payload.get('candidate_name')
                ))
                
                existing = cur.fetchone()
                
                # Get interview_schedules - ensure it's a JSON string
                interview_schedules = payload.get('interview_schedules')
                if isinstance(interview_schedules, dict):
                    interview_schedules = json.dumps(interview_schedules)
                elif not isinstance(interview_schedules, str):
                    interview_schedules = json.dumps(interview_schedules) if interview_schedules else '{}'
                
                print(f"Saving interview_schedules for candidate {payload.get('candidate_name')}: {interview_schedules[:200]}...")  # Log first 200 chars
                
                if existing:
                    # Update existing record
                    schedule_id = existing[0]
                    # Check if status is provided in payload
                    status = payload.get('status', 'scheduled')  # Default to 'scheduled' if not provided
                    
                    cur.execute("""
                        UPDATE tbl_interview_schedule 
                        SET interview_schedules = %s,
                            candidate_name = %s,
                            candidate_email = %s,
                            candidate_phone = %s,
                            submission_id = %s,
                            status = %s,
                            updated_at = NOW()
                        WHERE id = %s
                        RETURNING id
                    """, (
                        interview_schedules,
                        payload.get('candidate_name'),
                        payload.get('candidate_email'),
                        payload.get('candidate_phone'),
                        payload.get('submission_id'),
                        status,
                        schedule_id
                    ))
                else:
                    # Insert new record
                    cur.execute("""
                        INSERT INTO tbl_interview_schedule 
                        (submission_id, recruiter_id, candidate_name, demand_id, 
                         candidate_email, candidate_phone, interview_schedules)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                    """, (
                        payload.get('submission_id'),
                        payload.get('recruiter_id'),
                        payload.get('candidate_name'),
                        payload.get('demand_id'),
                        payload.get('candidate_email'),
                        payload.get('candidate_phone'),
                        interview_schedules
                    ))
                    schedule_id = cur.fetchone()[0]
                
                conn.commit()
                
                return {
                    "message": "Interview schedule saved successfully",
                    "schedule_id": schedule_id
                }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save interview schedule: {e}")

@router.get("/interview-schedule/all")
def get_all_interview_schedules() -> Dict[str, Any]:
    """Get all interview schedules for Team Leader"""
    _ensure_interview_schedule_table()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 
                        isch.id, isch.submission_id, isch.recruiter_id, isch.candidate_name, isch.demand_id,
                        isch.candidate_email, isch.candidate_phone, isch.interview_schedules,
                        isch.created_at, isch.updated_at, isch.status,
                        u.first_name, u.last_name, u.email as recruiter_email
                    FROM tbl_interview_schedule isch
                    LEFT JOIN tbl_users u ON isch.recruiter_id = u.id
                    ORDER BY isch.created_at DESC
                """)
                
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description]
                schedules = []
                
                for row in rows:
                    schedule = dict(zip(cols, row))
                    # Parse JSON if it exists
                    interview_schedules_raw = schedule.get('interview_schedules')
                    print(f"Retrieving schedule {schedule.get('id')} for candidate {schedule.get('candidate_name')}")
                    print(f"Raw interview_schedules value: {interview_schedules_raw}")
                    print(f"Type: {type(interview_schedules_raw)}")
                    
                    if interview_schedules_raw:
                        try:
                            # If it's already a dict, use it directly
                            if isinstance(interview_schedules_raw, dict):
                                schedule['interview_schedules'] = interview_schedules_raw
                                print(f"Already a dict, using directly")
                            else:
                                # Otherwise parse the string
                                schedule['interview_schedules'] = json.loads(str(interview_schedules_raw))
                                print(f"Parsed successfully: {schedule['interview_schedules']}")
                        except Exception as e:
                            print(f"Error parsing interview_schedules for schedule {schedule.get('id')}: {e}")
                            print(f"Raw value: {interview_schedules_raw}")
                            print(f"Type: {type(interview_schedules_raw)}")
                            schedule['interview_schedules'] = {}
                    else:
                        print(f"interview_schedules is empty/null for schedule {schedule.get('id')}")
                        schedule['interview_schedules'] = {}
                    
                    # Construct recruiter_name from first_name and last_name
                    first_name = schedule.get('first_name') or ''
                    last_name = schedule.get('last_name') or ''
                    if first_name or last_name:
                        schedule['recruiter_name'] = f'{first_name} {last_name}'.strip()
                    else:
                        schedule['recruiter_name'] = schedule.get('recruiter_email') or f'Recruiter {schedule.get("recruiter_id")}'
                    
                    schedules.append(schedule)
                
                return {
                    "items": schedules,
                    "total": len(schedules)
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch interview schedules: {e}")

def _ensure_candidate_onboarding_table():
    """Ensure tbl_candidate_onboarding table exists"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Rename old table if it exists
                cur.execute("""
                    DO $$ 
                    BEGIN
                        IF EXISTS (
                            SELECT 1 FROM information_schema.tables 
                            WHERE table_name = 'tbl_client_onboarding'
                        ) AND NOT EXISTS (
                            SELECT 1 FROM information_schema.tables 
                            WHERE table_name = 'tbl_candidate_onboarding'
                        ) THEN
                            ALTER TABLE tbl_client_onboarding 
                            RENAME TO tbl_candidate_onboarding;
                        END IF;
                    END $$;
                """)
                
                # Create candidate onboarding table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS tbl_candidate_onboarding (
                        id BIGSERIAL PRIMARY KEY,
                        demand_id BIGINT NOT NULL,
                        client_name TEXT,
                        candidate_name TEXT,
                        candidate_email TEXT,
                        candidate_phone TEXT,
                        recruiter_id BIGINT,
                        interview_schedules TEXT,  -- JSON column for selected slot
                        cv_path TEXT,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    );
                """)
                
                # Add client_id column if it doesn't exist
                cur.execute("""
                    DO $$ 
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'tbl_candidate_onboarding' 
                            AND column_name = 'client_id'
                        ) THEN
                            ALTER TABLE tbl_candidate_onboarding 
                            ADD COLUMN client_id BIGINT;
                        END IF;
                    END $$;
                """)
                
                # Add client_name column if it doesn't exist
                cur.execute("""
                    DO $$ 
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'tbl_candidate_onboarding' 
                            AND column_name = 'client_name'
                        ) THEN
                            ALTER TABLE tbl_candidate_onboarding 
                            ADD COLUMN client_name TEXT;
                        END IF;
                    END $$;
                """)
                
                # Create indexes
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_candidate_onboarding_demand_id 
                    ON tbl_candidate_onboarding(demand_id);
                """)
                
                # Create client_id index only if column exists
                cur.execute("""
                    DO $$ 
                    BEGIN
                        IF EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'tbl_candidate_onboarding' 
                            AND column_name = 'client_id'
                        ) THEN
                            CREATE INDEX IF NOT EXISTS idx_candidate_onboarding_client_id 
                            ON tbl_candidate_onboarding(client_id);
                        END IF;
                    END $$;
                """)
                
                conn.commit()
    except Exception as e:
        print(f"Error ensuring candidate onboarding table: {e}")

@router.post("/interview-schedule/finalize")
def finalize_interview(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Finalize interview: update status to completed, set round_status=2, and create candidate onboarding record"""
    _ensure_interview_schedule_table()
    _ensure_candidate_onboarding_table()
    
    try:
        schedule_id = payload.get('schedule_id')
        round_key = payload.get('round_key')
        
        if not schedule_id or not round_key:
            raise HTTPException(status_code=400, detail="schedule_id and round_key are required")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # 1. Fetch current interview schedule
                cur.execute("""
                    SELECT id, submission_id, recruiter_id, candidate_name, demand_id,
                           candidate_email, candidate_phone, interview_schedules, status
                    FROM tbl_interview_schedule
                    WHERE id = %s
                """, (schedule_id,))
                
                schedule_row = cur.fetchone()
                if not schedule_row:
                    raise HTTPException(status_code=404, detail="Interview schedule not found")
                
                schedule_cols = ['id', 'submission_id', 'recruiter_id', 'candidate_name', 'demand_id',
                               'candidate_email', 'candidate_phone', 'interview_schedules', 'status']
                schedule = dict(zip(schedule_cols, schedule_row))
                
                # Parse interview_schedules JSON
                interview_schedules_raw = schedule.get('interview_schedules')
                if isinstance(interview_schedules_raw, str):
                    try:
                        interview_schedules = json.loads(interview_schedules_raw)
                    except Exception as e:
                        print(f"Error parsing interview_schedules JSON: {e}")
                        interview_schedules = {}
                else:
                    interview_schedules = interview_schedules_raw or {}
                
                if not isinstance(interview_schedules, dict):
                    interview_schedules = {}
                
                # 2. Update the specific round's round_status to 2 (finalized)
                if round_key not in interview_schedules:
                    raise HTTPException(status_code=400, detail=f"Round '{round_key}' not found in interview schedules")
                
                if not isinstance(interview_schedules[round_key], dict):
                    raise HTTPException(status_code=400, detail=f"Invalid structure for round '{round_key}'")
                
                interview_schedules[round_key]['round_status'] = 2
                
                # Find the selected slot (slot_status = 1) from the finalized round
                selected_slot = None
                if 'slots' in interview_schedules[round_key]:
                    slots = interview_schedules[round_key]['slots']
                    if isinstance(slots, list):
                        for slot in slots:
                            if isinstance(slot, dict):
                                slot_status = slot.get('slot_status')
                                if slot_status == 1 or slot_status == '1' or str(slot_status) == '1':
                                    selected_slot = slot
                                    break
                
                # Collect ALL completed rounds (round_status = 2) for onboarding
                completed_rounds_for_onboarding = {}
                for round_name, round_data in interview_schedules.items():
                    if isinstance(round_data, dict):
                        round_status = round_data.get('round_status')
                        # Check if round is completed (round_status = 2)
                        if round_status == 2 or round_status == '2' or str(round_status) == '2':
                            # Find the selected slot (slot_status = 1) for this completed round
                            selected_slot_for_round = None
                            if 'slots' in round_data and isinstance(round_data['slots'], list):
                                for slot in round_data['slots']:
                                    if isinstance(slot, dict):
                                        slot_status = slot.get('slot_status')
                                        if slot_status == 1 or slot_status == '1' or str(slot_status) == '1':
                                            selected_slot_for_round = slot
                                            break
                            
                            # Only include rounds that have a selected slot
                            if selected_slot_for_round:
                                completed_rounds_for_onboarding[round_name] = {
                                    "round_status": 2,
                                    "slots": [selected_slot_for_round]
                                }
                
                # 3. Update tbl_interview_schedule with status = "completed" and updated round_status
                cur.execute("""
                    UPDATE tbl_interview_schedule 
                    SET status = 'completed',
                        interview_schedules = %s,
                        updated_at = NOW()
                    WHERE id = %s
                    RETURNING id
                """, (json.dumps(interview_schedules), schedule_id))
                
                if not cur.fetchone():
                    raise HTTPException(status_code=500, detail="Failed to update interview schedule")
                
                # 4. Fetch demand details and client information
                demand_id = schedule.get('demand_id')
                if not demand_id:
                    raise HTTPException(status_code=400, detail="demand_id not found in schedule")
                
                cur.execute("""
                    SELECT 
                        ds.id, ds.client_id, ds.skill,
                        ds.skill as job_title,
                        c.client_name, c.industry, c.location
                    FROM tbl_demand_sheet ds
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    WHERE ds.id = %s
                """, (demand_id,))
                
                demand_row = cur.fetchone()
                if not demand_row:
                    raise HTTPException(status_code=404, detail="Demand not found")
                
                demand_cols = ['demand_id', 'client_id', 'skill', 'job_title', 'client_name', 'industry', 'location']
                demand = dict(zip(demand_cols, demand_row))
                
                # 5. Fetch CV path from tbl_recruiter_activity
                recruiter_id = schedule.get('recruiter_id')
                candidate_name = schedule.get('candidate_name')
                candidate_email = schedule.get('candidate_email')
                cv_path = None
                
                cur.execute("""
                    SELECT cv_list
                    FROM tbl_recruiter_activity
                    WHERE recruiter_id = %s AND demand_id = %s
                    ORDER BY id DESC
                    LIMIT 1
                """, (recruiter_id, demand_id))
                
                cv_list_row = cur.fetchone()
                cv_list = []
                if cv_list_row and cv_list_row[0]:
                    cv_list_raw = cv_list_row[0]
                    if isinstance(cv_list_raw, str):
                        try:
                            cv_list = json.loads(cv_list_raw)
                        except Exception as e:
                            print(f"Error parsing cv_list JSON string: {e}")
                            cv_list = []
                    elif isinstance(cv_list_raw, (list, dict)):
                        # If it's already a list or dict (JSONB), use it directly
                        cv_list = cv_list_raw if isinstance(cv_list_raw, list) else [cv_list_raw]
                    else:
                        cv_list = []
                    
                    # Find CV for this candidate (match by candidate_name or candidate_email)
                    # Only process items that have candidate information (candidates only)
                    for cv_item in cv_list:
                        if isinstance(cv_item, dict):
                            # Only consider items that have candidate_name or candidate_email (candidate records)
                            cv_candidate_name = cv_item.get('candidate_name', '').strip()
                            cv_candidate_email = cv_item.get('candidate_email', '').strip()
                            
                            # Skip if this item doesn't have candidate information
                            if not cv_candidate_name and not cv_candidate_email:
                                continue
                            
                            file_path = cv_item.get('file_path') or cv_item.get('cv_path')
                            
                            # Match by candidate name (case-insensitive partial match)
                            name_match = False
                            if candidate_name and cv_candidate_name:
                                candidate_name_lower = candidate_name.lower().strip()
                                cv_candidate_name_lower = cv_candidate_name.lower().strip()
                                name_match = (candidate_name_lower in cv_candidate_name_lower) or \
                                            (cv_candidate_name_lower in candidate_name_lower)
                            
                            # Match by candidate email (exact match, case-insensitive)
                            email_match = False
                            if candidate_email and cv_candidate_email:
                                email_match = candidate_email.lower().strip() == cv_candidate_email.lower().strip()
                            
                            if name_match or email_match:
                                cv_path = file_path
                                break
                
                # 6. Use all completed rounds for onboarding (already collected above)
                onboarding_interview_schedules = completed_rounds_for_onboarding
                
                # 7. Insert into tbl_candidate_onboarding
                cur.execute("""
                    INSERT INTO tbl_candidate_onboarding 
                    (demand_id, client_id, client_name, candidate_name, candidate_email, 
                     candidate_phone, recruiter_id, interview_schedules, cv_path)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    demand_id,
                    demand.get('client_id'),
                    demand.get('client_name'),
                    candidate_name,
                    schedule.get('candidate_email'),
                    schedule.get('candidate_phone'),
                    recruiter_id,
                    json.dumps(onboarding_interview_schedules) if onboarding_interview_schedules else '{}',
                    cv_path
                ))
                
                onboarding_id = cur.fetchone()[0]
                conn.commit()
                
                return {
                    "message": "Interview finalized and candidate onboarding record created successfully",
                    "schedule_id": schedule_id,
                    "onboarding_id": onboarding_id
                }
                
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"Failed to finalize interview: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR in finalize_interview: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Failed to finalize interview: {str(e)}")

@router.get("/candidate-onboarding/all")
def get_all_candidate_onboarding() -> Dict[str, Any]:
    """Get all candidate onboarding records for Team Leader"""
    _ensure_candidate_onboarding_table()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Check if client_name column exists, if not join with clients table
                cur.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'tbl_candidate_onboarding' 
                    AND column_name = 'client_name'
                """)
                has_client_name_column = cur.fetchone() is not None
                
                if has_client_name_column:
                    # Use client_name from tbl_candidate_onboarding and join with demand_sheet for skill
                    cur.execute("""
                        SELECT 
                            co.id, co.demand_id, co.client_id, co.client_name, co.candidate_name, 
                            co.candidate_email, co.candidate_phone, co.recruiter_id, 
                            co.interview_schedules, co.cv_path, co.created_at, co.updated_at,
                            COALESCE(ds.skill, '') as skill
                        FROM tbl_candidate_onboarding co
                        LEFT JOIN tbl_demand_sheet ds ON co.demand_id = ds.id
                        ORDER BY co.created_at DESC
                    """)
                else:
                    # Join with clients table to get client_name and demand_sheet for skill
                    cur.execute("""
                        SELECT 
                            co.id, co.demand_id, co.client_id, 
                            COALESCE(c.client_name, '') as client_name,
                            co.candidate_name, 
                            co.candidate_email, co.candidate_phone, co.recruiter_id, 
                            co.interview_schedules, co.cv_path, co.created_at, co.updated_at,
                            COALESCE(ds.skill, '') as skill
                        FROM tbl_candidate_onboarding co
                        LEFT JOIN tbl_clients c ON co.client_id = c.id
                        LEFT JOIN tbl_demand_sheet ds ON co.demand_id = ds.id
                        ORDER BY co.created_at DESC
                    """)
                
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description]
                records = []
                
                for row in rows:
                    record = dict(zip(cols, row))
                    # Parse interview_schedules JSON if it exists
                    interview_schedules_raw = record.get('interview_schedules')
                    if interview_schedules_raw:
                        try:
                            if isinstance(interview_schedules_raw, str):
                                record['interview_schedules'] = json.loads(interview_schedules_raw)
                            else:
                                record['interview_schedules'] = interview_schedules_raw
                        except Exception as e:
                            print(f"Error parsing interview_schedules for record {record.get('id')}: {e}")
                            record['interview_schedules'] = {}
                    else:
                        record['interview_schedules'] = {}
                    
                    records.append(record)
                
                return {
                    "items": records,
                    "total": len(records)
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch candidate onboarding records: {e}")





