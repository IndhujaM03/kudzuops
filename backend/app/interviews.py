import os
import json
from typing import Any, Dict, List, Optional
from datetime import datetime

import psycopg
from fastapi import APIRouter, HTTPException, Depends, Query
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
def get_recruiter_interviews(
    recruiter_id: int, 
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None)
) -> Dict[str, Any]:
    """Get all interviews for a specific recruiter with optional search"""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Build WHERE clause with search
                where_conditions = ["i.recruiter_id = %s"]
                params = [recruiter_id]
                
                if search:
                    search_pattern = f"%{search}%"
                    where_conditions.append("""
                        (rs.candidate_name ILIKE %s OR 
                         rs.candidate_email ILIKE %s OR 
                         ds.skill ILIKE %s OR 
                         c.client_name ILIKE %s)
                    """)
                    params.extend([search_pattern, search_pattern, search_pattern, search_pattern])
                
                where_clause = " AND ".join(where_conditions)
                
                # Count total
                count_query = f"""
                    SELECT COUNT(*) 
                    FROM tbl_interviews i
                    LEFT JOIN tbl_recruiter_submissions rs ON i.submission_id = rs.id
                    LEFT JOIN tbl_demand_sheet ds ON rs.demand_id = ds.id
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    WHERE {where_clause}
                """
                cur.execute(count_query, params)
                total = int(cur.fetchone()[0])
                
                # Get interviews with submission and demand info
                query = f"""
                    SELECT 
                        i.id, i.submission_id, i.recruiter_id, i.interview_date, 
                        i.mode, i.status, i.notes, i.created_at, i.updated_at,
                        rs.candidate_name, rs.candidate_email, rs.demand_id,
                        ds.skill as job_title, c.client_name
                    FROM tbl_interviews i
                    LEFT JOIN tbl_recruiter_submissions rs ON i.submission_id = rs.id
                    LEFT JOIN tbl_demand_sheet ds ON rs.demand_id = ds.id
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    WHERE {where_clause}
                    ORDER BY i.interview_date DESC
                    LIMIT %s OFFSET %s
                """
                params.extend([size, (page - 1) * size])
                cur.execute(query, params)
                
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
                        u.display_name as candidate_name
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

# Interview Schedule endpoints for tbl_interview_schedule table (Page 1)
# New structure with JSON column for rounds and slots

class SlotAssignment(BaseModel):
    round_key: str  # e.g., "R1"
    slot_index: int  # Index of the slot in the slots array

class RejectAllSlots(BaseModel):
    round_key: str  # e.g., "R1"

def _ensure_interview_schedule_table():
    """Ensure interview schedule table exists with new structure"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS tbl_interview_schedule (
                        id BIGSERIAL PRIMARY KEY,
                        candidate_name VARCHAR(255) NOT NULL,
                        recruiter_name VARCHAR(255),
                        recruiter_id BIGINT,
                        round VARCHAR(50),
                        status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
                        interview_schedules JSONB,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    );
                """)
                # Create indexes
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_interview_schedule_status 
                    ON tbl_interview_schedule(status);
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_interview_schedule_recruiter_id 
                    ON tbl_interview_schedule(recruiter_id);
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_interview_schedule_json 
                    ON tbl_interview_schedule USING GIN (interview_schedules);
                """)
                conn.commit()
    except Exception as e:
        print(f"Error ensuring interview schedule table: {e}")

@router.get("/interview-schedule/waiting")
def get_waiting_candidates(
    page: int = Query(1, ge=1),
    size: int = Query(1000, ge=1, le=10000),
    search: Optional[str] = Query(None)
) -> Dict[str, Any]:
    """Get candidates in Waiting tab: status='scheduled' and round_status=0"""
    _ensure_interview_schedule_table()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                where_conditions = ["s.status = 'scheduled'"]
                params = []
                
                # Filter for round_status = 0 in JSON (handle NULL)
                where_conditions.append("""
                    (s.interview_schedules IS NOT NULL AND EXISTS (
                        SELECT 1 FROM jsonb_each(s.interview_schedules) AS rounds
                        WHERE (rounds.value->>'round_status')::int = 0
                    ))
                """)
                
                if search:
                    search_pattern = f"%{search}%"
                    where_conditions.append("s.candidate_name ILIKE %s")
                    params.extend([search_pattern])
                
                where_clause = " AND ".join(where_conditions)
                
                # Count total
                count_query = f"SELECT COUNT(*) FROM tbl_interview_schedule s WHERE {where_clause}"
                cur.execute(count_query, params)
                total = int(cur.fetchone()[0])
                
                # Get candidates with recruiter name from users table
                query = f"""
                    SELECT 
                        s.id, s.candidate_name, 
                        COALESCE(
                            TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))),
                            'N/A'
                        ) as recruiter_name,
                        s.recruiter_id, 
                        s.round, s.status, s.interview_schedules, s.created_at
                    FROM tbl_interview_schedule s
                    LEFT JOIN tbl_users u ON s.recruiter_id = u.id
                    WHERE {where_clause}
                    ORDER BY s.created_at DESC
                    LIMIT %s OFFSET %s
                """
                params.extend([size, (page - 1) * size])
                cur.execute(query, params)
                
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description]
                candidates = []
                
                for row in rows:
                    candidate = dict(zip(cols, row))
                    # Parse JSON if it exists
                    if candidate.get('interview_schedules'):
                        if isinstance(candidate['interview_schedules'], str):
                            candidate['interview_schedules'] = json.loads(candidate['interview_schedules'])
                    else:
                        candidate['interview_schedules'] = {}
                    
                    # Extract round key and all slots from JSON where round_status = 0
                    all_slots = []
                    if candidate.get('interview_schedules'):
                        for round_key, round_data in candidate['interview_schedules'].items():
                            if round_data.get('round_status') == 0:
                                candidate['round'] = round_key
                                # Extract all slots for this round
                                if round_data.get('slots'):
                                    for slot in round_data['slots']:
                                        if slot.get('date') and slot.get('time'):
                                            all_slots.append({
                                                'date': slot.get('date'),
                                                'time': slot.get('time'),
                                                'slot_status': slot.get('slot_status', 0),
                                                'round': round_key
                                            })
                                break
                    
                    # Add all_slots to candidate for frontend display
                    candidate['all_slots'] = all_slots
                    
                    # Serialize timestamps
                    if candidate.get('created_at'):
                        if hasattr(candidate['created_at'], 'isoformat'):
                            candidate['created_at'] = candidate['created_at'].isoformat()
                        else:
                            candidate['created_at'] = str(candidate['created_at'])
                    
                    candidates.append(candidate)
                
                return {
                    "items": candidates,
                    "total": total,
                    "page": page,
                    "size": size
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch waiting candidates: {str(e)}")

@router.get("/interview-schedule/scheduled")
def get_scheduled_candidates(
    page: int = Query(1, ge=1),
    size: int = Query(1000, ge=1, le=10000),
    search: Optional[str] = Query(None)
) -> Dict[str, Any]:
    """Get candidates in Scheduled tab: status='slot_allocated' and at least one slot_status=1"""
    _ensure_interview_schedule_table()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                where_conditions = ["s.status = 'slot_allocated'"]
                params = []
                
                # Filter for at least one slot with slot_status = 1 (handle NULL)
                where_conditions.append("""
                    (s.interview_schedules IS NOT NULL AND EXISTS (
                        SELECT 1 FROM jsonb_each(s.interview_schedules) AS rounds,
                        jsonb_array_elements(rounds.value->'slots') AS slot
                        WHERE (slot->>'slot_status')::int = 1
                    ))
                """)
                
                if search:
                    search_pattern = f"%{search}%"
                    where_conditions.append("s.candidate_name ILIKE %s")
                    params.extend([search_pattern])
                
                where_clause = " AND ".join(where_conditions)
                
                # Count total
                count_query = f"SELECT COUNT(*) FROM tbl_interview_schedule s WHERE {where_clause}"
                cur.execute(count_query, params)
                total = int(cur.fetchone()[0])
                
                # Get candidates with recruiter name from users table
                query = f"""
                    SELECT 
                        s.id, s.candidate_name, 
                        COALESCE(
                            TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))),
                            'N/A'
                        ) as recruiter_name,
                        s.recruiter_id, 
                        s.round, s.status, s.interview_schedules, s.created_at
                    FROM tbl_interview_schedule s
                    LEFT JOIN tbl_users u ON s.recruiter_id = u.id
                    WHERE {where_clause}
                    ORDER BY s.created_at DESC
                    LIMIT %s OFFSET %s
                """
                params.extend([size, (page - 1) * size])
                cur.execute(query, params)
                
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description]
                candidates = []
                
                for row in rows:
                    candidate = dict(zip(cols, row))
                    # Parse JSON if it exists
                    if candidate.get('interview_schedules'):
                        if isinstance(candidate['interview_schedules'], str):
                            candidate['interview_schedules'] = json.loads(candidate['interview_schedules'])
                    else:
                        candidate['interview_schedules'] = {}
                    
                    # Extract round key and all slots with slot_status = 1
                    all_slots = []
                    if candidate.get('interview_schedules'):
                        for round_key, round_data in candidate['interview_schedules'].items():
                            if round_data.get('slots'):
                                for slot in round_data['slots']:
                                    if slot.get('slot_status') == 1:
                                        if not candidate.get('round'):
                                            candidate['round'] = round_key
                                        # Only include slots with slot_status = 1
                                        if slot.get('date') and slot.get('time'):
                                            all_slots.append({
                                                'date': slot.get('date'),
                                                'time': slot.get('time'),
                                                'slot_status': slot.get('slot_status', 1),
                                                'round': round_key
                                            })
                    
                    # Add all_slots to candidate for frontend display (only slot_status = 1)
                    candidate['all_slots'] = all_slots
                    
                    # Serialize timestamps
                    if candidate.get('created_at'):
                        if hasattr(candidate['created_at'], 'isoformat'):
                            candidate['created_at'] = candidate['created_at'].isoformat()
                        else:
                            candidate['created_at'] = str(candidate['created_at'])
                    
                    candidates.append(candidate)
                
                return {
                    "items": candidates,
                    "total": total,
                    "page": page,
                    "size": size
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch scheduled candidates: {str(e)}")

@router.post("/interview-schedule/{schedule_id}/assign-slot")
def assign_slot(schedule_id: int, assignment: SlotAssignment) -> Dict[str, Any]:
    """Assign a slot: Update selected slot slot_status=1, round round_status=1, and status='slot_allocated'"""
    _ensure_interview_schedule_table()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get current data
                cur.execute("""
                    SELECT interview_schedules, status
                    FROM tbl_interview_schedule
                    WHERE id = %s
                """, (schedule_id,))
                
                result = cur.fetchone()
                if not result:
                    raise HTTPException(status_code=404, detail="Interview schedule not found")
                
                schedules_json = result[0]
                if schedules_json is None:
                    schedules_json = {}
                elif isinstance(schedules_json, str):
                    schedules_json = json.loads(schedules_json)
                
                # Update the specific slot
                if assignment.round_key not in schedules_json:
                    raise HTTPException(status_code=400, detail=f"Round {assignment.round_key} not found")
                
                round_data = schedules_json[assignment.round_key]
                if 'slots' not in round_data:
                    raise HTTPException(status_code=400, detail=f"No slots found for round {assignment.round_key}")
                
                slots = round_data['slots']
                if assignment.slot_index < 0 or assignment.slot_index >= len(slots):
                    raise HTTPException(status_code=400, detail="Invalid slot index")
                
                # Update slot status to 1
                slots[assignment.slot_index]['slot_status'] = 1
                
                # Do NOT update round_status when assigning a slot
                # round_status should only be updated when rejecting all slots
                
                # Update schedules JSON
                schedules_json[assignment.round_key] = round_data
                
                # Update database
                cur.execute("""
                    UPDATE tbl_interview_schedule 
                    SET interview_schedules = %s::jsonb,
                        status = 'slot_allocated',
                        updated_at = NOW()
                    WHERE id = %s
                    RETURNING id
                """, (json.dumps(schedules_json), schedule_id))
                
                if cur.fetchone() is None:
                    raise HTTPException(status_code=404, detail="Failed to update interview schedule")
                
                conn.commit()
                
                return {
                    "message": "Slot assigned successfully",
                    "schedule_id": schedule_id,
                    "round": assignment.round_key,
                    "slot_index": assignment.slot_index
                }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to assign slot: {str(e)}")

@router.post("/interview-schedule/{schedule_id}/reject-all-slots")
def reject_all_slots(schedule_id: int, reject: RejectAllSlots) -> Dict[str, Any]:
    """Reject all slots: Update round round_status=1 and status='reschedule'"""
    _ensure_interview_schedule_table()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get current data
                cur.execute("""
                    SELECT interview_schedules, status
                    FROM tbl_interview_schedule
                    WHERE id = %s
                """, (schedule_id,))
                
                result = cur.fetchone()
                if not result:
                    raise HTTPException(status_code=404, detail="Interview schedule not found")
                
                schedules_json = result[0]
                if schedules_json is None:
                    schedules_json = {}
                elif isinstance(schedules_json, str):
                    schedules_json = json.loads(schedules_json)
                
                # Update the round status
                if reject.round_key not in schedules_json:
                    raise HTTPException(status_code=400, detail=f"Round {reject.round_key} not found")
                
                round_data = schedules_json[reject.round_key]
                round_data['round_status'] = 1
                schedules_json[reject.round_key] = round_data
                
                # Update database
                cur.execute("""
                    UPDATE tbl_interview_schedule 
                    SET interview_schedules = %s::jsonb,
                        status = 'reschedule',
                        updated_at = NOW()
                    WHERE id = %s
                    RETURNING id
                """, (json.dumps(schedules_json), schedule_id))
                
                if cur.fetchone() is None:
                    raise HTTPException(status_code=404, detail="Failed to update interview schedule")
                
                conn.commit()
                
                return {
                    "message": "All slots rejected. Candidate moved to reschedule.",
                    "schedule_id": schedule_id,
                    "round": reject.round_key
                }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reject slots: {str(e)}")

@router.get("/interview-schedule/test")
def test_interview_schedule_endpoint() -> Dict[str, Any]:
    """Test endpoint to verify interview-schedule routes are working"""
    return {
        "message": "Interview schedule endpoint is working",
        "status": "ok"
    }

