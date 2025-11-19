import os
import json
from typing import Any, Dict, List, Optional

import psycopg
from fastapi import APIRouter, HTTPException, Query

# Import helper function from recruiter_activity
from .recruiter_activity import _check_and_close_activity_on_submission

try:
    from ..config import settings
    DATABASE_DSN = settings.database_url
except Exception:
    DATABASE_DSN = os.getenv(
        "DATABASE_URL",
        "postgresql://kudzuops:kudzu%40%402025@127.0.0.1:5432/kudzuops",
    )

router = APIRouter(prefix="/api", tags=["candidate-submissions"])


def _ensure_tables():
    """Ensure required tables exist"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Create candidate submissions table if it doesn't exist
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS tbl_candidate_submissions (
                        id SERIAL PRIMARY KEY,
                        demand_id INTEGER REFERENCES tbl_demand_sheet(id),
                        recruiter_id INTEGER REFERENCES users(id),
                        candidate_name VARCHAR(255),
                        candidate_email VARCHAR(255),
                        candidate_phone VARCHAR(50),
                        resume_url TEXT,
                        status VARCHAR(32) DEFAULT 'submitted',
                        notes TEXT,
                        created_at TIMESTAMP DEFAULT now(),
                        updated_at TIMESTAMP DEFAULT now()
                    )
                """)
                
                # Add job_description column to tbl_demand_sheet if it doesn't exist
                cur.execute("""
                    ALTER TABLE tbl_demand_sheet 
                    ADD COLUMN IF NOT EXISTS job_description TEXT
                """)
                
                conn.commit()
    except Exception as e:
        print(f"Error ensuring tables: {e}")


@router.get("/submitted")
def get_submitted_candidates(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None)
) -> Dict[str, Any]:
    """Get all candidate submissions with pagination and filtering"""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Build WHERE clause
                where_conditions = []
                params = []
                
                if search:
                    where_conditions.append("""
                        (cs.candidate_name ILIKE %s OR 
                         cs.candidate_email ILIKE %s OR 
                         ds.job_title ILIKE %s OR 
                         c.client_name ILIKE %s)
                    """)
                    search_param = f"%{search}%"
                    params.extend([search_param, search_param, search_param, search_param])
                
                if status:
                    where_conditions.append("cs.status = %s")
                    params.append(status)
                
                where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
                
                # Count total
                count_query = f"""
                    SELECT COUNT(*) 
                    FROM tbl_candidate_submissions cs
                    LEFT JOIN tbl_demand_sheet ds ON cs.demand_id = ds.id
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    LEFT JOIN users u ON cs.recruiter_id = u.id
                    WHERE {where_clause}
                """
                cur.execute(count_query, params)
                total = int(cur.fetchone()[0])
                
                # Get submissions with pagination
                query = f"""
                    SELECT 
                        cs.id, cs.recruiter_id, cs.demand_id, cs.candidate_name,
                        cs.candidate_email, cs.candidate_phone, cs.resume_url,
                        cs.status, cs.submitted_at, cs.created_at,
                        ds.job_title, c.client_name,
                        CONCAT(u.first_name, ' ', u.last_name) as recruiter_name
                    FROM tbl_candidate_submissions cs
                    LEFT JOIN tbl_demand_sheet ds ON cs.demand_id = ds.id
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    LEFT JOIN users u ON cs.recruiter_id = u.id
                    WHERE {where_clause}
                    ORDER BY cs.submitted_at DESC
                    LIMIT %s OFFSET %s
                """
                
                params.extend([size, (page - 1) * size])
                cur.execute(query, params)
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description]
                submissions = [dict(zip(cols, row)) for row in rows]
                
                return {
                    "items": submissions,
                    "total": total,
                    "page": page,
                    "size": size
                }
    except Exception as e:
        print(f"Error getting submitted candidates: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get submitted candidates: {e}")


@router.patch("/update-status/{submission_id}")
def update_submission_status(
    submission_id: int,
    status: str = Query(..., description="New status: Under Verification, Selected, or Rejected")
) -> Dict[str, Any]:
    """Update candidate submission status"""
    _ensure_tables()
    
    valid_statuses = ["Under Verification", "Selected", "Rejected"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Check if submission exists
                cur.execute(
                    "SELECT id FROM tbl_candidate_submissions WHERE id = %s",
                    (submission_id,)
                )
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Submission not found")
                
                # Update status
                cur.execute(
                    """
                    UPDATE tbl_candidate_submissions 
                    SET status = %s, updated_at = NOW() 
                    WHERE id = %s
                    """,
                    (status, submission_id)
                )
                
                conn.commit()
                
                return {
                    "message": "Status updated successfully",
                    "submission_id": submission_id,
                    "new_status": status
                }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating submission status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update status: {e}")


@router.get("/recruiter/{recruiter_id}")
def get_recruiter_submissions(
    recruiter_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100)
) -> Dict[str, Any]:
    """Get submissions by a specific recruiter"""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Count total
                cur.execute(
                    "SELECT COUNT(*) FROM tbl_candidate_submissions WHERE recruiter_id = %s",
                    (recruiter_id,)
                )
                total = int(cur.fetchone()[0])
                
                # Get submissions
                cur.execute(
                    """
                    SELECT 
                        cs.id, cs.recruiter_id, cs.demand_id, cs.candidate_name,
                        cs.candidate_email, cs.candidate_phone, cs.resume_url,
                        cs.status, cs.submitted_at, cs.created_at,
                        ds.job_title, c.client_name
                    FROM tbl_candidate_submissions cs
                    LEFT JOIN tbl_demand_sheet ds ON cs.demand_id = ds.id
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    WHERE cs.recruiter_id = %s
                    ORDER BY cs.submitted_at DESC
                    LIMIT %s OFFSET %s
                    """,
                    (recruiter_id, size, (page - 1) * size)
                )
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description]
                submissions = [dict(zip(cols, row)) for row in rows]
                
                return {
                    "items": submissions,
                    "total": total,
                    "page": page,
                    "size": size
                }
    except Exception as e:
        print(f"Error getting recruiter submissions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get recruiter submissions: {e}")


@router.post("/submit_profile")
def submit_profile(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Submit candidate profile; does not change demand status."""
    _ensure_tables()
    try:
        recruiter_id = int(payload.get("recruiter_id") or 0)
        demand_id = int(payload.get("demand_id") or 0)
        if not recruiter_id or not demand_id:
            raise HTTPException(status_code=400, detail="recruiter_id and demand_id are required")
        candidate_name = (payload.get("candidate_name") or payload.get("candidateName") or "").strip()
        candidate_email = (payload.get("candidate_email") or payload.get("candidateEmail") or "").strip()
        candidate_phone = (payload.get("candidate_phone") or payload.get("candidatePhone") or "").strip() or None
        resume_url = (payload.get("resume_url") or payload.get("resumeUrl") or "").strip() or None
        notes = (payload.get("notes") or "").strip() or None

        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Insert submission
                cur.execute(
                    """
                    INSERT INTO tbl_candidate_submissions
                    (demand_id, recruiter_id, candidate_name, candidate_email, candidate_phone, resume_url, status, notes)
                    VALUES (%s, %s, %s, %s, %s, %s, 'submitted', %s)
                    RETURNING id
                    """,
                    (demand_id, recruiter_id, candidate_name or None, candidate_email or None, candidate_phone, resume_url, notes)
                )
                submission_id = cur.fetchone()[0]

                # Append minimal entry to activity.submissions
                cur.execute(
                    "SELECT id, submissions FROM tbl_recruiter_activity WHERE recruiter_id=%s AND demand_id=%s AND activity_status='processing' ORDER BY id DESC LIMIT 1",
                    (recruiter_id, demand_id)
                )
                row = cur.fetchone()
                if row:
                    activity_id, subs = row
                    try:
                        current = subs if isinstance(subs, list) else json.loads(subs or "[]")
                    except Exception:
                        current = []
                    current.append({"submission_id": submission_id, "candidate_name": candidate_name})
                    cur.execute(
                        "UPDATE tbl_recruiter_activity SET submissions=%s::jsonb, updated_at=NOW() WHERE id=%s",
                        (json.dumps(current), activity_id)
                    )

                # Audit trail
                cur.execute(
                    "INSERT INTO tbl_audit_trail (event_type, recruiter_id, demand_id, details) VALUES ('submit_profile', %s, %s, %s::jsonb)",
                    (recruiter_id, demand_id, json.dumps({"submission_id": submission_id, "candidate_name": candidate_name}))
                )

                # Note: CV count will be updated by the frontend via update-cv-count-and-check endpoint
                # This prevents double increment
                
                # Check if uploaded_cv_count equals required_cv_count and close if needed
                demand_closed = _check_and_close_activity_on_submission(demand_id, cur)

                conn.commit()

        return {
            "message": "Profile submitted successfully", 
            "submission_id": submission_id,
            "demand_closed": demand_closed
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error submitting candidate: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to submit candidate: {e}")

@router.get("/demand/{demand_id}/submissions")
def get_demand_submissions(demand_id: int) -> Dict[str, Any]:
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, recruiter_id, demand_id, candidate_name, candidate_email, candidate_phone, resume_url, status, created_at, updated_at
                    FROM tbl_candidate_submissions
                    WHERE demand_id = %s
                    ORDER BY created_at DESC
                    """,
                    (demand_id,)
                )
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description]
                return {"items": [dict(zip(cols, r)) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch submissions: {e}")

@router.get("/admin/demand/{demand_id}/submitted")
def admin_demand_submitted(demand_id: int) -> Dict[str, Any]:
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT cs.id, cs.recruiter_id, cs.demand_id, cs.candidate_name, cs.candidate_email, cs.candidate_phone,
                           cs.resume_url, cs.status, cs.created_at, cs.updated_at,
                           u.first_name, u.last_name
                    FROM tbl_candidate_submissions cs
                    LEFT JOIN users u ON u.id = cs.recruiter_id
                    WHERE cs.demand_id = %s
                    ORDER BY cs.created_at DESC
                    """,
                    (demand_id,)
                )
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description]
                return {"items": [dict(zip(cols, r)) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch demand submissions: {e}")


@router.get("/candidate-onboarding/all")
def list_candidate_onboarding(
    page: int = Query(1, ge=1),
    size: int = Query(100, ge=1, le=500),
    search: Optional[str] = Query(None, description="Candidate name/email/skills search"),
    status: Optional[str] = Query(None, description="Filter by status"),
    demand_id: Optional[int] = Query(None, description="Filter by demand id"),
) -> Dict[str, Any]:
    """Lightweight onboarding list for Team Leader UI."""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Ensure demand_id column exists
                cur.execute(
                    "ALTER TABLE tbl_candidate_onboarding ADD COLUMN IF NOT EXISTS demand_id BIGINT;"
                )
                
                where_parts: List[str] = []
                params: List[Any] = []

                if search:
                    like = f"%{search}%"
                    # Use COALESCE to handle NULL skill values
                    where_parts.append(
                        "(o.candidate_name ILIKE %s OR o.candidate_email ILIKE %s OR COALESCE(d.skill, '') ILIKE %s)"
                    )
                    params.extend([like, like, like])

                if status:
                    where_parts.append("LOWER(o.status) = LOWER(%s)")
                    params.append(status)

                if demand_id:
                    where_parts.append("o.demand_id = %s")
                    params.append(demand_id)

                where_clause = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""
                
                # Build COUNT query with same joins as main query
                count_query = f"""
                    SELECT COUNT(*) 
                    FROM tbl_candidate_onboarding o
                    LEFT JOIN tbl_demand_sheet d ON o.demand_id = d.id
                    {where_clause}
                """
                cur.execute(count_query, params)
                total = int(cur.fetchone()[0])

                query = f"""
                    SELECT
                        o.*,
                        c.client_name,
                        COALESCE(
                            NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''),
                            u.email,
                            CAST(u.id AS TEXT)
                        ) AS recruiter_name,
                        d.skill
                    FROM tbl_candidate_onboarding o
                    LEFT JOIN tbl_clients c ON c.id = o.client_id
                    LEFT JOIN tbl_users u ON u.id = o.recruiter_id
                    LEFT JOIN tbl_demand_sheet d ON o.demand_id = d.id
                    {where_clause}
                    ORDER BY o.updated_at DESC
                    LIMIT %s OFFSET %s
                """
                cur.execute(query, params + [size, (page - 1) * size])
                rows = cur.fetchall()
                columns = [desc[0] for desc in cur.description]
                items = [dict(zip(columns, row)) for row in rows]

                # For each onboarding record, fetch ALL completed rounds from tbl_interview_schedule
                for item in items:
                    candidate_email = item.get("candidate_email")
                    candidate_name = item.get("candidate_name")
                    demand_id = item.get("demand_id")
                    
                    # Build lookup conditions - try multiple matching strategies
                    lookup_conditions = []
                    lookup_params = []
                    
                    # Strategy 1: Match by email (most reliable)
                    if candidate_email:
                        lookup_conditions.append("s.candidate_email = %s")
                        lookup_params.append(candidate_email)
                    
                    # Strategy 2: Also try matching by name + demand_id (in case email doesn't match)
                    if candidate_name and demand_id:
                        if lookup_conditions:
                            lookup_conditions.append("OR (s.candidate_name = %s AND s.demand_id = %s)")
                        else:
                            lookup_conditions.append("(s.candidate_name = %s AND s.demand_id = %s)")
                        lookup_params.extend([candidate_name, demand_id])
                    elif candidate_name and not candidate_email:
                        # Fallback: just by name if no email
                        if not lookup_conditions:
                            lookup_conditions.append("s.candidate_name = %s")
                            lookup_params.append(candidate_name)
                    
                    # Fetch all interview schedules for this candidate
                    all_completed_rounds = {}
                    if lookup_conditions:
                        # Build the WHERE clause properly
                        if len(lookup_conditions) > 1 and "OR" in lookup_conditions[1]:
                            where_clause = " ".join(lookup_conditions)
                        else:
                            where_clause = " AND ".join(lookup_conditions)
                        
                        lookup_query = f"""
                            SELECT s.interview_schedules
                            FROM tbl_interview_schedule s
                            WHERE {where_clause}
                        """
                        cur.execute(lookup_query, lookup_params)
                        schedule_rows = cur.fetchall()
                        
                        # Merge all completed rounds from all interview schedules
                        for schedule_row in schedule_rows:
                            schedules_json = schedule_row[0]
                            if schedules_json:
                                if isinstance(schedules_json, str):
                                    try:
                                        schedules_json = json.loads(schedules_json)
                                    except json.JSONDecodeError:
                                        continue
                                
                                # Extract all rounds with round_status = 2
                                if isinstance(schedules_json, dict):
                                    for round_key, round_data in schedules_json.items():
                                        if round_data and round_data.get("round_status") == 2:
                                            all_completed_rounds[round_key] = round_data
                    
                    # Set the merged completed rounds
                    item["interview_schedules"] = all_completed_rounds

                return {
                    "items": items,
                    "total": total,
                    "page": page,
                    "size": size,
                }
    except psycopg.errors.UndefinedTable:
        raise HTTPException(status_code=404, detail="tbl_candidate_onboarding table not found")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load onboarding records: {exc}") from exc
