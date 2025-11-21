import os
import json
import re
from typing import Any, Dict, List, Optional
from datetime import datetime

import psycopg
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from pydantic import BaseModel
from dotenv import load_dotenv

# Load .env file
backend_env = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(backend_env):
    load_dotenv(backend_env, override=True)

# Database connection
try:
    from .config import settings
    DATABASE_DSN = settings.database_url or ""
except Exception:
    DATABASE_DSN = os.getenv("DATABASE_URL", "")

# Fallback to default if still empty
if not DATABASE_DSN:
    DATABASE_DSN = "postgresql://kudzuops:kudzu%40%402025@127.0.0.1:5432/kudzuops"

router = APIRouter(prefix="/api", tags=["Interviews"])

# Import recruiter ID extraction function and get_current_user
try:
    from .login import extract_recruiter_id_from_request, get_current_user
except ImportError:
    # Fallback if import fails
    def extract_recruiter_id_from_request(request: Request, query_param: Optional[int] = None) -> Optional[int]:
        return None
    async def get_current_user():
        return {"uid": 1, "role": "team_leader"}

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


class InterviewFinalizeRequest(BaseModel):
    schedule_id: int
    round_key: str


def _update_cv_interview_status(
    cur: psycopg.Cursor,
    demand_id: Optional[int],
    recruiter_id: Optional[int],
    candidate_email: Optional[str],
    candidate_name: Optional[str],
    interview_status: str,
) -> None:
    """Update interview_status inside tbl_recruiter_activity.cv_list."""
    if not demand_id or not interview_status:
        return

    cur.execute(
        """
        SELECT id, cv_list
        FROM tbl_recruiter_activity
        WHERE demand_id = %s
          AND (%s IS NULL OR recruiter_id = %s)
        ORDER BY id DESC
        LIMIT 1
        """,
        (demand_id, recruiter_id, recruiter_id),
    )
    row = cur.fetchone()
    if not row:
        return

    activity_id, cv_list = row
    if not cv_list:
        return

    if isinstance(cv_list, str):
        try:
            cv_list = json.loads(cv_list)
        except json.JSONDecodeError:
            return

    if not isinstance(cv_list, list):
        return

    lookup_name = (candidate_name or "").strip().lower()
    lookup_email = (candidate_email or "").strip().lower()
    updated = False

    for entry in cv_list:
        entry_name = str(entry.get("candidate_name") or "").strip().lower()
        entry_email = str(entry.get("candidate_email") or entry.get("email") or "").strip().lower()

        if lookup_email and lookup_email == entry_email:
            entry["interview_status"] = interview_status
            updated = True
            break
        if not lookup_email and lookup_name and lookup_name == entry_name:
            entry["interview_status"] = interview_status
            updated = True
            break

    if updated:
        cur.execute(
            """
            UPDATE tbl_recruiter_activity
            SET cv_list = %s::jsonb,
                updated_at = NOW()
            WHERE id = %s
            """,
            (json.dumps(cv_list), activity_id),
        )
class InterviewScheduleRequest(BaseModel):
    submission_id: Optional[int] = None
    recruiter_id: Optional[int] = None
    recruiter_name: Optional[str] = None
    candidate_name: str
    candidate_email: Optional[str] = None
    candidate_phone: Optional[str] = None
    demand_id: Optional[int] = None
    interview_schedules: Any
    status: str = "scheduled"


class RescheduleUpdateRequest(BaseModel):
    round_key: str
    slots: List[Dict[str, str]]

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
                        submission_id BIGINT,
                        demand_id BIGINT,
                        candidate_email VARCHAR(255),
                        candidate_phone VARCHAR(50),
                        round VARCHAR(50),
                        status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
                        interview_schedules JSONB,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    );
                """)
                # Ensure legacy tables include new columns
                cur.execute("ALTER TABLE tbl_interview_schedule ADD COLUMN IF NOT EXISTS submission_id BIGINT;")
                cur.execute("ALTER TABLE tbl_interview_schedule ADD COLUMN IF NOT EXISTS demand_id BIGINT;")
                cur.execute("ALTER TABLE tbl_interview_schedule ADD COLUMN IF NOT EXISTS candidate_email VARCHAR(255);")
                cur.execute("ALTER TABLE tbl_interview_schedule ADD COLUMN IF NOT EXISTS candidate_phone VARCHAR(50);")
                cur.execute("ALTER TABLE tbl_interview_schedule ADD COLUMN IF NOT EXISTS recruiter_name VARCHAR(255);")

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
                    CREATE INDEX IF NOT EXISTS idx_interview_schedule_submission_id 
                    ON tbl_interview_schedule(submission_id);
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_interview_schedule_demand_id 
                    ON tbl_interview_schedule(demand_id);
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_interview_schedule_json 
                    ON tbl_interview_schedule USING GIN (interview_schedules);
                """)
                conn.commit()
    except Exception as e:
        print(f"Error ensuring interview schedule table: {e}")

@router.get("/interview-schedule/waiting")
async def get_waiting_candidates(
    request: Request,
    page: int = Query(1, ge=1),
    size: int = Query(1000, ge=1, le=10000),
    search: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get candidates in Waiting tab: status='scheduled' and round_status=0, filtered by user role (TL by tl_id, Recruiter by recruiter_id)"""
    _ensure_interview_schedule_table()
    try:
        user_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        user_role = current_user.get('role', '').lower()
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                where_conditions = ["s.status = 'scheduled'"]
                params = []
                
                # Filter by role: Recruiters see their own records, TLs see their team's records
                if user_role in ['recruiter', 'recruiters']:
                    where_conditions.append("s.recruiter_id = %s")
                    params.append(user_id)
                else:
                    # Team Leader or other roles: filter by tl_id
                    where_conditions.append("d.tl_id = %s")
                    params.append(user_id)
                
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
                count_query = f"SELECT COUNT(*) FROM tbl_interview_schedule s LEFT JOIN tbl_demand_sheet d ON s.demand_id = d.id WHERE {where_clause}"
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
                    LEFT JOIN tbl_demand_sheet d ON s.demand_id = d.id
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
async def get_scheduled_candidates(
    request: Request,
    page: int = Query(1, ge=1),
    size: int = Query(1000, ge=1, le=10000),
    search: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get candidates in Scheduled tab: status='slot_allocated' or 'confirmed' with slot_status=1, filtered by user role (TL by tl_id, Recruiter by recruiter_id)"""
    _ensure_interview_schedule_table()
    try:
        user_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        user_role = current_user.get('role', '').lower()
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Filter for status = 'slot_allocated' OR status = 'confirmed'
                where_conditions = ["(s.status = 'slot_allocated' OR s.status = 'confirmed')"]
                params = []
                
                # Filter by role: Recruiters see their own records, TLs see their team's records
                if user_role in ['recruiter', 'recruiters']:
                    where_conditions.append("s.recruiter_id = %s")
                    params.append(user_id)
                else:
                    # Team Leader or other roles: filter by tl_id
                    where_conditions.append("d.tl_id = %s")
                    params.append(user_id)
                
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
                count_query = f"SELECT COUNT(*) FROM tbl_interview_schedule s LEFT JOIN tbl_demand_sheet d ON s.demand_id = d.id WHERE {where_clause}"
                cur.execute(count_query, params)
                total = int(cur.fetchone()[0])
                
                # Get candidates with recruiter name from users table
                query = f"""
                    SELECT 
                        s.id, 
                        s.candidate_name,
                        s.candidate_email,
                        COALESCE(
                            TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))),
                            'N/A'
                        ) as recruiter_name,
                        s.recruiter_id, 
                        s.round, 
                        s.status, 
                        s.interview_schedules, 
                        s.created_at
                    FROM tbl_interview_schedule s
                    LEFT JOIN tbl_demand_sheet d ON s.demand_id = d.id
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
                    # Sort rounds in order: R1, R2, R3, etc.
                    all_slots = []
                    if candidate.get('interview_schedules'):
                        # Extract round keys and sort them
                        round_keys = list(candidate['interview_schedules'].keys())
                        # Sort rounds: R1, R2, R3, etc.
                        def sort_round_key(key):
                            # Extract number from round key (e.g., "R1" -> 1, "R2" -> 2)
                            match = re.search(r'(\d+)', str(key))
                            return int(match.group(1)) if match else 999
                        
                        round_keys_sorted = sorted(round_keys, key=sort_round_key)
                        
                        for round_key in round_keys_sorted:
                            round_data = candidate['interview_schedules'][round_key]
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


@router.get("/interview-schedule/reschedule")
async def get_reschedule_candidates(
    page: int = Query(1, ge=1),
    size: int = Query(1000, ge=1, le=10000),
    search: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get candidates whose interviews require rescheduling (status='reschedule'), filtered by logged-in TL's tl_id."""
    _ensure_interview_schedule_table()
    try:
        team_leader_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not team_leader_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                where_conditions = ["s.status = 'reschedule'", "d.tl_id = %s"]
                params: List[Any] = [team_leader_id]

                if search:
                    like = f"%{search}%"
                    where_conditions.append("(s.candidate_name ILIKE %s OR s.recruiter_name ILIKE %s)")
                    params.extend([like, like])

                where_clause = " AND ".join(where_conditions)

                cur.execute(f"SELECT COUNT(*) FROM tbl_interview_schedule s LEFT JOIN tbl_demand_sheet d ON s.demand_id = d.id WHERE {where_clause}", params)
                total = int(cur.fetchone()[0])

                query = f"""
                    SELECT
                        s.id,
                        s.submission_id,
                        s.recruiter_id,
                        COALESCE(
                            NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''),
                            s.recruiter_name,
                            u.email,
                            'N/A'
                        ) AS recruiter_name,
                        s.candidate_name,
                        s.candidate_email,
                        s.candidate_phone,
                        s.demand_id,
                        s.round,
                        s.status,
                        s.interview_schedules,
                        s.created_at,
                        s.updated_at,
                        d.client_id,
                        c.client_name AS client_name,
                        cs.spoc_name AS spoc_name,
                        d.skill
                    FROM tbl_interview_schedule s
                    LEFT JOIN tbl_demand_sheet d ON s.demand_id = d.id
                    LEFT JOIN tbl_clients c ON d.client_id = c.id
                    LEFT JOIN tbl_client_spocs cs ON d.spoc_id = cs.id
                    LEFT JOIN tbl_users u ON s.recruiter_id = u.id
                    WHERE {where_clause}
                    ORDER BY s.created_at DESC
                    LIMIT %s OFFSET %s
                """
                params.extend([size, (page - 1) * size])
                cur.execute(query, params)

                rows = cur.fetchall()
                cols = [desc[0] for desc in cur.description]
                items: List[Dict[str, Any]] = []

                for row in rows:
                    record = dict(zip(cols, row))
                    schedules_json = record.get("interview_schedules") or {}
                    if isinstance(schedules_json, str):
                        try:
                            schedules_json = json.loads(schedules_json)
                        except json.JSONDecodeError:
                            schedules_json = {}

                    reschedule_rounds = []
                    for round_key, round_value in schedules_json.items():
                        if isinstance(round_value, dict) and round_value.get("round_status") == 1:
                            reschedule_rounds.append(
                                {
                                    "round_key": round_key,
                                    "slots": round_value.get("slots") or [],
                                }
                            )

                    if not reschedule_rounds:
                        continue

                    record["interview_schedules"] = schedules_json
                    record["reschedule_rounds"] = reschedule_rounds
                    if record.get("created_at") and hasattr(record["created_at"], "isoformat"):
                        record["created_at"] = record["created_at"].isoformat()
                    if record.get("updated_at") and hasattr(record["updated_at"], "isoformat"):
                        record["updated_at"] = record["updated_at"].isoformat()
                    items.append(record)

                return {"items": items, "total": len(items), "page": page, "size": size}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch reschedule candidates: {str(e)}")


@router.post("/interview-schedule/finalize")
def finalize_interview_schedule(payload: InterviewFinalizeRequest) -> Dict[str, Any]:
    """Finalize an interview schedule and create/update onboarding record."""
    _ensure_interview_schedule_table()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        s.id,
                        s.candidate_name,
                        s.candidate_email,
                        s.candidate_phone,
                        s.recruiter_id,
                        s.demand_id,
                        s.submission_id,
                        s.interview_schedules,
                        d.client_id,
                        d.skill,
                        cs.spoc_name,
                        COALESCE(
                            NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''),
                            u.email,
                            CAST(u.id AS TEXT)
                        ) AS recruiter_name
                    FROM tbl_interview_schedule s
                    LEFT JOIN tbl_demand_sheet d ON s.demand_id = d.id
                    LEFT JOIN tbl_client_spocs cs ON d.spoc_id = cs.id
                    LEFT JOIN tbl_users u ON s.recruiter_id = u.id
                    WHERE s.id = %s
                    """,
                    (payload.schedule_id,),
                )
                schedule_row = cur.fetchone()
                if not schedule_row:
                    raise HTTPException(status_code=404, detail="Interview schedule not found")

                column_names = [desc[0] for desc in cur.description]
                schedule = dict(zip(column_names, schedule_row))

                schedules_json = schedule.get("interview_schedules") or {}
                if isinstance(schedules_json, str):
                    try:
                        schedules_json = json.loads(schedules_json)
                    except json.JSONDecodeError:
                        schedules_json = {}

                round_data = schedules_json.get(payload.round_key)
                if not round_data:
                    raise HTTPException(status_code=400, detail="Round not found in interview schedule")

                # Update round_status to 2 (completed/final)
                # Keep slot_status as is (1 for selected slots, 0 for others)
                round_data["round_status"] = 2
                slots = round_data.get("slots") or []
                schedules_json[payload.round_key] = round_data

                cur.execute(
                    """
                    UPDATE tbl_interview_schedule
                    SET interview_schedules = %s::jsonb,
                        status = 'completed',
                        updated_at = NOW()
                    WHERE id = %s
                    """,
                    (json.dumps(schedules_json), payload.schedule_id),
                )

                cur.execute(
                    "ALTER TABLE tbl_candidate_onboarding ADD COLUMN IF NOT EXISTS demand_id BIGINT;"
                )
                cur.execute(
                    "ALTER TABLE tbl_candidate_onboarding ADD COLUMN IF NOT EXISTS skill VARCHAR(255);"
                )
                cur.execute(
                    "ALTER TABLE tbl_candidate_onboarding ADD COLUMN IF NOT EXISTS spoc_name VARCHAR(255);"
                )

                cv_path = None
                demand_id = schedule.get("demand_id")
                recruiter_id = schedule.get("recruiter_id")
                cv_row = None
                if demand_id:
                    cur.execute(
                        """
                        SELECT cv_list
                        FROM tbl_recruiter_activity
                        WHERE demand_id = %s
                          AND (%s IS NULL OR recruiter_id = %s)
                        ORDER BY id DESC
                        LIMIT 1
                        """,
                        (demand_id, recruiter_id, recruiter_id),
                    )
                    cv_row = cur.fetchone()
                if cv_row and cv_row[0]:
                    cv_list = cv_row[0]
                    if isinstance(cv_list, str):
                        try:
                            cv_list = json.loads(cv_list)
                        except json.JSONDecodeError:
                            cv_list = []
                    if isinstance(cv_list, list):
                        lookup_name = (schedule.get("candidate_name") or "").strip().lower()
                        lookup_email = (schedule.get("candidate_email") or "").strip().lower()
                        for entry in cv_list:
                            entry_name = str(entry.get("candidate_name") or "").strip().lower()
                            entry_email = str(entry.get("candidate_email") or entry.get("email") or "").strip().lower()
                            entry_status = str(entry.get("status") or "").lower()
                            if entry_status not in {"1", "submitted", "approved"}:
                                continue
                            if (lookup_email and lookup_email == entry_email) or (
                                lookup_name and lookup_name == entry_name
                            ):
                                cv_path = entry.get("cv_url") or entry.get("file_path") or entry.get("cv_path")
                                break

                # Fetch ALL interview schedules for this candidate to get all completed rounds
                candidate_email = schedule.get("candidate_email")
                candidate_name = schedule.get("candidate_name")
                
                # Build lookup to find all interview schedules for this candidate
                schedule_lookup_conditions = []
                schedule_lookup_params = []
                
                if candidate_email:
                    schedule_lookup_conditions.append("candidate_email = %s")
                    schedule_lookup_params.append(candidate_email)
                if demand_id is not None:
                    schedule_lookup_conditions.append("demand_id = %s")
                    schedule_lookup_params.append(demand_id)
                if candidate_name and not candidate_email:
                    schedule_lookup_conditions.append("candidate_name = %s")
                    schedule_lookup_params.append(candidate_name)
                
                # Fetch all interview schedules and merge completed rounds
                all_completed_rounds = {}
                if schedule_lookup_conditions:
                    cur.execute(
                        f"""
                        SELECT interview_schedules
                        FROM tbl_interview_schedule
                        WHERE {' AND '.join(schedule_lookup_conditions)}
                        """,
                        schedule_lookup_params,
                    )
                    all_schedule_rows = cur.fetchall()
                    
                    # Merge all completed rounds from all interview schedules
                    for schedule_row in all_schedule_rows:
                        schedules_json = schedule_row[0]
                        if schedules_json:
                            if isinstance(schedules_json, str):
                                try:
                                    schedules_json = json.loads(schedules_json)
                                except json.JSONDecodeError:
                                    continue
                            
                            # Extract all rounds with round_status = 2 and filter slots
                            if isinstance(schedules_json, dict):
                                for round_key, round_data in schedules_json.items():
                                    if round_data and round_data.get("round_status") == 2:
                                        # Filter slots to keep only those with slot_status = 1
                                        all_slots = round_data.get("slots", [])
                                        selected_slots = [
                                            slot for slot in all_slots
                                            if slot.get("slot_status") == 1
                                        ]
                                        
                                        # Only include round if it has at least one selected slot
                                        if selected_slots:
                                            all_completed_rounds[round_key] = {
                                                "round_status": 2,
                                                "slots": selected_slots
                                            }
                
                # Use the merged completed rounds
                onboarding_rounds = all_completed_rounds

                existing_onboarding_id = None
                lookup_clauses = []
                lookup_params: List[Any] = []
                if candidate_email:
                    lookup_clauses.append("candidate_email = %s")
                    lookup_params.append(candidate_email)
                if demand_id is not None:
                    lookup_clauses.append("demand_id = %s")
                    lookup_params.append(demand_id)
                if not candidate_email and candidate_name:
                    lookup_clauses.append("candidate_name = %s")
                    lookup_params.append(candidate_name)

                if lookup_clauses:
                    cur.execute(
                        f"""
                        SELECT id FROM tbl_candidate_onboarding
                        WHERE {" AND ".join(lookup_clauses)}
                        ORDER BY id DESC
                        LIMIT 1
                        """,
                        lookup_params,
                    )
                    match = cur.fetchone()
                    if match:
                        existing_onboarding_id = match[0]

                status_value = "pending"
                skill_value = schedule.get("skill")
                spoc_name_value = schedule.get("spoc_name")
                
                if existing_onboarding_id:
                    cur.execute(
                        """
                        UPDATE tbl_candidate_onboarding
                        SET candidate_name = %s,
                            candidate_email = %s,
                            candidate_phone = %s,
                            client_id = %s,
                            recruiter_id = %s,
                            cv_path = COALESCE(%s, cv_path),
                            interview_schedules = %s::jsonb,
                            status = %s,
                            demand_id = %s,
                            skill = COALESCE(%s, skill),
                            spoc_name = COALESCE(%s, spoc_name),
                            updated_at = NOW()
                        WHERE id = %s
                        """,
                        (
                            candidate_name,
                            candidate_email,
                            schedule.get("candidate_phone"),
                            schedule.get("client_id"),
                            recruiter_id,
                            cv_path,
                            json.dumps(onboarding_rounds),
                            status_value,
                            demand_id,
                            skill_value,
                            spoc_name_value,
                            existing_onboarding_id,
                        ),
                    )
                    onboarding_id = existing_onboarding_id
                else:
                    cur.execute(
                        """
                        INSERT INTO tbl_candidate_onboarding (
                            candidate_name,
                            candidate_email,
                            candidate_phone,
                            client_id,
                            recruiter_id,
                            cv_path,
                            interview_schedules,
                            status,
                            demand_id,
                            skill,
                            spoc_name
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s)
                        RETURNING id
                        """,
                        (
                            candidate_name,
                            candidate_email,
                            schedule.get("candidate_phone"),
                            schedule.get("client_id"),
                            recruiter_id,
                            cv_path,
                            json.dumps(onboarding_rounds),
                            status_value,
                            demand_id,
                            skill_value,
                            spoc_name_value,
                        ),
                    )
                    onboarding_id = cur.fetchone()[0]

                conn.commit()

        return {
            "message": "Interview finalized and onboarding entry created",
            "schedule_id": payload.schedule_id,
            "onboarding_id": onboarding_id,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to finalize interview: {exc}") from exc


@router.post("/interview-schedule/{schedule_id}/reschedule")
def update_reschedule_slots(schedule_id: int, payload: RescheduleUpdateRequest) -> Dict[str, Any]:
    """Replace slots for an existing round and move status back to scheduled."""
    _ensure_interview_schedule_table()
    if not payload.slots:
        raise HTTPException(status_code=400, detail="At least one slot is required")

    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT interview_schedules, recruiter_id, demand_id, candidate_email, candidate_name
                    FROM tbl_interview_schedule
                    WHERE id = %s
                    """,
                    (schedule_id,),
                )
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="Interview schedule not found")

                schedules_json, recruiter_id, demand_id, candidate_email, candidate_name = row
                if not schedules_json:
                    schedules_json = {}
                elif isinstance(schedules_json, str):
                    try:
                        schedules_json = json.loads(schedules_json)
                    except json.JSONDecodeError:
                        schedules_json = {}

                round_data = schedules_json.get(payload.round_key)
                if not round_data:
                    raise HTTPException(status_code=400, detail=f"Round {payload.round_key} not found")

                new_slots = []
                for slot in payload.slots:
                    date_value = slot.get("date")
                    time_value = slot.get("time")
                    if not date_value or not time_value:
                        continue
                    new_slots.append(
                        {
                            "date": date_value,
                            "time": time_value,
                            "slot_status": 0,
                        }
                    )

                if not new_slots:
                    raise HTTPException(status_code=400, detail="Valid slots are required")

                round_data["slots"] = new_slots
                round_data["round_status"] = 0
                schedules_json[payload.round_key] = round_data

                cur.execute(
                    """
                    UPDATE tbl_interview_schedule
                    SET interview_schedules = %s::jsonb,
                        status = 'scheduled',
                        updated_at = NOW()
                    WHERE id = %s
                    """,
                    (json.dumps(schedules_json), schedule_id),
                )

                if demand_id:
                    _update_cv_interview_status(
                        cur,
                        demand_id,
                        recruiter_id,
                        candidate_email,
                        candidate_name,
                        "scheduled",
                    )

                conn.commit()

        return {"message": "Interview schedule updated", "schedule_id": schedule_id}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to update reschedule slots: {exc}") from exc


@router.get("/interview-schedule/all")
async def get_all_interview_schedules(
    page: int = Query(1, ge=1),
    size: int = Query(1000, ge=1, le=10000),
    search: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get all interview schedules without filtering by status, filtered by logged-in TL's tl_id"""
    _ensure_interview_schedule_table()
    try:
        team_leader_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not team_leader_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                where_conditions = ["d.tl_id = %s"]
                params: List[Any] = [team_leader_id]

                if search:
                    search_pattern = f"%{search}%"
                    where_conditions.append(
                        "(s.candidate_name ILIKE %s OR s.recruiter_name ILIKE %s)"
                    )
                    params.extend([search_pattern, search_pattern])

                where_clause = " AND ".join(where_conditions)

                count_query = f"SELECT COUNT(*) FROM tbl_interview_schedule s LEFT JOIN tbl_demand_sheet d ON s.demand_id = d.id WHERE {where_clause}"
                cur.execute(count_query, params)
                total = int(cur.fetchone()[0])

                query = f"""
                    SELECT 
                        s.id,
                        s.submission_id,
                        s.recruiter_id,
                        COALESCE(
                            NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''),
                            s.recruiter_name,
                            'N/A'
                        ) AS recruiter_name,
                        s.candidate_name,
                        s.candidate_email,
                        s.candidate_phone,
                        s.demand_id,
                        s.round,
                        s.status,
                        s.interview_schedules,
                        s.created_at,
                        s.updated_at,
                        d.skill,
                        cs.spoc_name
                    FROM tbl_interview_schedule s
                    LEFT JOIN tbl_users u ON s.recruiter_id = u.id
                    LEFT JOIN tbl_demand_sheet d ON s.demand_id = d.id
                    LEFT JOIN tbl_client_spocs cs ON d.spoc_id = cs.id
                    WHERE {where_clause}
                    ORDER BY s.created_at DESC
                    LIMIT %s OFFSET %s
                """
                params.extend([size, (page - 1) * size])
                cur.execute(query, params)

                rows = cur.fetchall()
                cols = [d[0] for d in cur.description]
                items = [dict(zip(cols, row)) for row in rows]

                # Serialize timestamps and normalize JSON
                for item in items:
                    if item.get("created_at") and hasattr(item["created_at"], "isoformat"):
                        item["created_at"] = item["created_at"].isoformat()
                    if item.get("updated_at") and hasattr(item["updated_at"], "isoformat"):
                        item["updated_at"] = item["updated_at"].isoformat()
                    schedules = item.get("interview_schedules")
                    if schedules and isinstance(schedules, str):
                        try:
                            item["interview_schedules"] = json.loads(schedules)
                        except json.JSONDecodeError:
                            item["interview_schedules"] = {}

                return {"items": items, "total": total, "page": page, "size": size}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch interview schedules: {str(e)}")


@router.post("/interview-schedule/multiple-slots")
def create_or_update_interview_schedule(payload: InterviewScheduleRequest) -> Dict[str, Any]:
    """Create or update an interview schedule with multiple slots"""
    _ensure_interview_schedule_table()
    try:
        schedules_json = payload.interview_schedules
        if isinstance(schedules_json, str):
            try:
                schedules_json = json.loads(schedules_json)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid interview_schedules JSON")

        if not isinstance(schedules_json, dict) or not schedules_json:
            raise HTTPException(status_code=400, detail="interview_schedules must be a non-empty object")

        first_round_key = next(iter(schedules_json.keys()), None)
        status_value = (payload.status or "scheduled").lower()
        schedules_text = json.dumps(schedules_json)

        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                existing_id: Optional[int] = None
                if payload.submission_id:
                    cur.execute(
                        "SELECT id FROM tbl_interview_schedule WHERE submission_id = %s",
                        (payload.submission_id,),
                    )
                    row = cur.fetchone()
                    if row:
                        existing_id = row[0]

                # When confirming, ensure skill and spoc_name are available from demand_sheet
                skill_value = None
                spoc_name_value = None
                if payload.demand_id and status_value == 'confirmed':
                    cur.execute(
                        """
                        SELECT d.skill, cs.spoc_name
                        FROM tbl_demand_sheet d
                        LEFT JOIN tbl_client_spocs cs ON d.spoc_id = cs.id
                        WHERE d.id = %s
                        """,
                        (payload.demand_id,)
                    )
                    demand_row = cur.fetchone()
                    if demand_row:
                        skill_value = demand_row[0]
                        spoc_name_value = demand_row[1]
                
                if existing_id:
                    cur.execute(
                        """
                        UPDATE tbl_interview_schedule
                        SET recruiter_id = %s,
                            recruiter_name = %s,
                            candidate_name = %s,
                            candidate_email = %s,
                            candidate_phone = %s,
                            demand_id = %s,
                            round = %s,
                            status = %s,
                            interview_schedules = %s::jsonb,
                            updated_at = NOW()
                        WHERE id = %s
                        """,
                        (
                            payload.recruiter_id,
                            payload.recruiter_name,
                            payload.candidate_name,
                            payload.candidate_email,
                            payload.candidate_phone,
                            payload.demand_id,
                            first_round_key,
                            status_value,
                            schedules_text,
                            existing_id,
                        ),
                    )
                    schedule_id = existing_id
                    
                    # When confirming, ensure skill and spoc_name are properly updated in demand_sheet
                    # The values are fetched from demand_sheet and spoc_id is ensured to be correct
                    if status_value == 'confirmed' and payload.demand_id and spoc_name_value:
                        # Ensure spoc_id is set correctly in demand_sheet
                        cur.execute(
                            """
                            SELECT id FROM tbl_client_spocs 
                            WHERE spoc_name = %s 
                            AND client_id = (SELECT client_id FROM tbl_demand_sheet WHERE id = %s)
                            LIMIT 1
                            """,
                            (spoc_name_value, payload.demand_id)
                        )
                        spoc_row = cur.fetchone()
                        if spoc_row:
                            spoc_id = spoc_row[0]
                            cur.execute(
                                "UPDATE tbl_demand_sheet SET spoc_id = %s WHERE id = %s",
                                (spoc_id, payload.demand_id)
                            )
                else:
                    cur.execute(
                        """
                        INSERT INTO tbl_interview_schedule (
                            candidate_name,
                            recruiter_name,
                            recruiter_id,
                            submission_id,
                            demand_id,
                            candidate_email,
                            candidate_phone,
                            round,
                            status,
                            interview_schedules
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                        RETURNING id
                        """,
                        (
                            payload.candidate_name,
                            payload.recruiter_name,
                            payload.recruiter_id,
                            payload.submission_id,
                            payload.demand_id,
                            payload.candidate_email,
                            payload.candidate_phone,
                            first_round_key,
                            status_value,
                            schedules_text,
                        ),
                    )
                    schedule_id = cur.fetchone()[0]

                if payload.demand_id:
                    _update_cv_interview_status(
                        cur,
                        payload.demand_id,
                        payload.recruiter_id,
                        payload.candidate_email,
                        payload.candidate_name,
                        "scheduled",
                    )

                conn.commit()

        return {
            "message": "Interview schedule saved successfully",
            "schedule_id": schedule_id,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save interview schedule: {exc}") from exc

@router.get("/interview-schedule/test")
def test_interview_schedule_endpoint() -> Dict[str, Any]:
    """Test endpoint to verify interview-schedule routes are working"""
    return {
        "message": "Interview schedule endpoint is working",
        "status": "ok"
    }

