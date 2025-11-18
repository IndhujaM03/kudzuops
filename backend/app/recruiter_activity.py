import os
import json
import threading
from typing import Any, Dict, List, Optional, Union
from datetime import datetime, timedelta

import psycopg  # type: ignore[reportMissingImports]
from fastapi import APIRouter, HTTPException, File, UploadFile, Form  # type: ignore[reportMissingImports]
from fastapi import Request  # type: ignore[reportMissingImports]
from fastapi import Body  # type: ignore[reportMissingImports]
from fastapi.responses import FileResponse, JSONResponse  # type: ignore[reportMissingImports]
from pydantic import BaseModel  # type: ignore[reportMissingImports]
from fastapi import Depends  # type: ignore[reportMissingImports]
import psycopg  # type: ignore[reportMissingImports]
from fastapi import APIRouter, HTTPException, File, UploadFile, Form  # type: ignore[reportMissingImports]
from fastapi import Request  # type: ignore[reportMissingImports]
from fastapi import Body  # type: ignore[reportMissingImports]
from fastapi.responses import FileResponse, JSONResponse  # type: ignore[reportMissingImports]
from pydantic import BaseModel  # type: ignore[reportMissingImports]
from fastapi import Depends  # type: ignore[reportMissingImports]
import shutil
import traceback

try:
    from .config import settings  # correct import path within app package
    DATABASE_DSN = settings.database_url
except Exception:
    DATABASE_DSN = os.getenv(
        "DATABASE_URL",
        "postgresql://kudzuops:kudzu%40%402025@127.0.0.1:5432/kudzuops",
    )

# Thread-safe flag to ensure tables are created only once
_tables_ensured = False
_tables_lock = threading.Lock()

# Optional listener service
try:
    from ..services.listener_service import cv_listener_service  # type: ignore
except Exception:
    cv_listener_service = None


router = APIRouter(prefix="/api/recruiter", tags=["recruiter"])

class QuotaCheckRequest(BaseModel):
    demand_id: Any
    recruiter_id: Any
    
    class Config:
        # Allow extra fields and be more flexible with validation
        extra = "allow"
        validate_assignment = False


# ------------------------
# In-memory listener state
# ------------------------
_listeners_lock = threading.RLock()
_active_listeners: Dict[int, Dict[str, Any]] = {}


def _serialize_value(value: Any) -> Any:
    """Serialize a value to be JSON-compatible"""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, timedelta):
        return str(value)
    if isinstance(value, dict):
        # Recursively serialize dictionaries
        return {k: _serialize_value(v) for k, v in value.items()}
    if isinstance(value, list):
        # Recursively serialize lists
        return [_serialize_value(item) for item in value]
    # Handle psycopg-specific types that might come from PostgreSQL
    try:
        # Try to convert to native Python types
        if hasattr(value, '__dict__'):
            return str(value)
    except:
        pass
    # For everything else, return as-is
    return value


def _rows_to_dicts(columns: List[str], rows: List[tuple]) -> List[Dict[str, Any]]:
    """Convert database rows to dictionaries with proper JSON serialization"""
    result = []
    for row in rows:
        row_dict = {}
        for col, val in zip(columns, row):
            row_dict[col] = _serialize_value(val)
        result.append(row_dict)
    return result


def _recalculate_uploaded_cv_count(cv_list: list, activity_id: int, cur) -> None:
    """Helper function to recalculate uploaded_cv_count based on cv_list"""
    try:
        count = 0
        for it in cv_list:
            try:
                has_id = it.get("candidate_id") is not None
                status_val = it.get("status")
                is_rejected = (int(status_val) == 2) if status_val is not None else False
                if has_id and not is_rejected:
                    count += 1
            except Exception:
                continue
        cur.execute(
            "UPDATE tbl_recruiter_activity SET uploaded_cv_count=%s, updated_at=NOW() WHERE id=%s",
            (count, activity_id)
        )
    except Exception:
        pass

def _sync_uploaded_cv_count_across_demand(demand_id: int, cur) -> None:
    """Helper function to sync uploaded_cv_count across all recruiters for the same demand"""
    # DISABLED: This function is disabled to prevent conflicts with update-cv-count-and-check endpoint
    # The count is now managed exclusively by the update-cv-count-and-check endpoint
    print(f"⚠️ Sync function called for demand {demand_id} but is disabled to prevent count conflicts")
    pass

def _check_and_close_activity_on_submission(demand_id: int, cur) -> bool:
    """Check if uploaded_cv_count equals required_cv_count and close activity/demand if needed
    Returns True if demand was closed, False otherwise"""
    try:
        # Get the current uploaded_cv_count and required_cv_count for this demand
        cur.execute("""
            SELECT uploaded_cv_count, required_cv_count
            FROM tbl_recruiter_activity 
            WHERE demand_id = %s
            ORDER BY id DESC LIMIT 1
        """, (demand_id,))
        
        result = cur.fetchone()
        if not result:
            return False
            
        uploaded_count, required_count = result
        
        # Check if uploaded_cv_count equals required_cv_count (exact match)
        if uploaded_count and required_count and uploaded_count == required_count:
            print(f"Profile submission: Counts equal ({uploaded_count}/{required_count}). Closing activity and demand for demand_id {demand_id}")
            
            # Update activity_status to 'closed' for all recruiters of this demand
            cur.execute("""
                UPDATE tbl_recruiter_activity 
                SET activity_status = 'closed', updated_at = NOW()
                WHERE demand_id = %s
            """, (demand_id,))
            
            # Update demand status to 'closed'
            cur.execute("""
                UPDATE tbl_demand_sheet 
                SET status = 'closed', updated_at = NOW()
                WHERE id = %s
            """, (demand_id,))
            
            print(f"✅ Successfully updated activity_status to 'closed' and demand status to 'closed' for demand_id {demand_id}")
            return True
        else:
            print(f"Profile submission: Counts not equal ({uploaded_count}/{required_count}). No status changes for demand_id {demand_id}")
            return False
            
    except Exception as e:
        print(f"Error checking and closing activity for demand {demand_id}: {e}")
        return False

def _ensure_tables() -> None:
    # Comprehensive table creation and migration
    with psycopg.connect(DATABASE_DSN) as conn:
        try:
            with conn.cursor() as cur:
                # 1. Clients table
                cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tbl_clients (
                    id SERIAL PRIMARY KEY,
                    client_name VARCHAR(255) NOT NULL,
                    industry VARCHAR(100),
                    email VARCHAR(255),
                    contact_person VARCHAR(255),
                    created_at TIMESTAMP DEFAULT now(),
                    updated_at TIMESTAMP DEFAULT now()
                );
                """
            )
            
                # 2. Demand sheet table with all columns
                cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tbl_demand_sheet (
                    id SERIAL PRIMARY KEY,
                    client_id INTEGER REFERENCES tbl_clients(id),
                    job_title VARCHAR(255),
                    job_description TEXT,
                    job_description_url TEXT,
                    skill VARCHAR(255),
                    no_of_positions INTEGER DEFAULT 1,
                    priority VARCHAR(50) DEFAULT 'medium',
                    status VARCHAR(50) DEFAULT 'open',
                    experience_level VARCHAR(100),
                    location VARCHAR(255),
                    salary_range VARCHAR(255),
                    assigned_to JSONB DEFAULT '[]'::jsonb,
                    created_at TIMESTAMP DEFAULT now(),
                    updated_at TIMESTAMP DEFAULT now()
                );
                """
            )
            
                # 3. Recruiter activity table
                cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tbl_recruiter_activity (
                    id SERIAL PRIMARY KEY,
                    recruiter_id INTEGER NOT NULL,
                    demand_id INTEGER NOT NULL,
                    activity_status VARCHAR(32) NOT NULL DEFAULT 'idle',
                    opened_at TIMESTAMP,
                    closed_at TIMESTAMP,
                    cv_list JSONB DEFAULT '[]',
                    submissions JSONB DEFAULT '[]',
                    required_cv_count INTEGER,
                    uploaded_cv_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT now(),
                    updated_at TIMESTAMP DEFAULT now()
                );
                """
            )
            
                # Ensure new columns exist on older DBs
                try:
                    cur.execute("ALTER TABLE tbl_recruiter_activity ADD COLUMN IF NOT EXISTS required_cv_count INTEGER")
                    conn.commit()
                except Exception:
                    conn.rollback()
                try:
                    cur.execute("ALTER TABLE tbl_recruiter_activity ADD COLUMN IF NOT EXISTS uploaded_cv_count INTEGER DEFAULT 0")
                    conn.commit()
                except Exception:
                    conn.rollback()
            
                # 4. Recruiter settings table
                cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tbl_recruiter_settings (
                    id SERIAL PRIMARY KEY,
                    recruiter_id INTEGER UNIQUE,
                    cv_download_path TEXT,
                    folder_locked BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT now(),
                    updated_at TIMESTAMP DEFAULT now()
                );
                """
            )
            
                # 5. Audit trail table
                cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tbl_audit_trail (
                    id SERIAL PRIMARY KEY,
                    event_type VARCHAR(100) NOT NULL,
                    recruiter_id INTEGER,
                    demand_id INTEGER,
                    file_name VARCHAR(255),
                    file_path TEXT,
                    details JSONB,
                    created_at TIMESTAMP DEFAULT now()
                );
                """
            )
            
                # 6. Candidate submissions table
                cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tbl_candidate_submissions (
                    id SERIAL PRIMARY KEY,
                    demand_id INTEGER REFERENCES tbl_demand_sheet(id),
                    recruiter_id INTEGER,
                    file_name TEXT,
                    file_time TIMESTAMP,
                    candidate_name VARCHAR(255),
                    candidate_email VARCHAR(255),
                    candidate_phone VARCHAR(50),
                    remarks TEXT,
                    verified_status VARCHAR(32) DEFAULT 'under_verification',
                    created_at TIMESTAMP DEFAULT now(),
                    updated_at TIMESTAMP DEFAULT now()
                );
                """
            )
            
                # 7. CV uploads table
                cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tbl_cv_uploads (
                    id SERIAL PRIMARY KEY,
                    recruiter_id INTEGER NOT NULL,
                    demand_id INTEGER NOT NULL,
                    filename VARCHAR(255) NOT NULL,
                    file_path TEXT NOT NULL,
                    uploaded_at TIMESTAMP DEFAULT now()
                );
                """
            )

                # 7b. CV downloads table for recruiter-managed uploads (resume list)
                cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tbl_cv_downloads (
                    id SERIAL PRIMARY KEY,
                    recruiter_id INTEGER NOT NULL,
                    demand_id INTEGER NOT NULL,
                    filename TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    status TEXT NULL,
                    candidate_details JSONB NULL
                );
                """
            )
            
                # Create indexes for tbl_cv_downloads to speed up queries
                cur.execute("CREATE INDEX IF NOT EXISTS idx_cv_downloads_recruiter_demand ON tbl_cv_downloads(recruiter_id, demand_id);")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_cv_downloads_status ON tbl_cv_downloads(status) WHERE status IS NOT NULL;")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_cv_downloads_created_at ON tbl_cv_downloads(created_at DESC);")
            
                # 8. Recruiter submissions table
                cur.execute(
                """
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
                    submitted_at TIMESTAMPTZ DEFAULT NOW(),
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
                """
            )
            
                # Add missing columns to existing tables
                cur.execute("ALTER TABLE tbl_recruiter_activity ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP")
                cur.execute("ALTER TABLE tbl_demand_sheet ADD COLUMN IF NOT EXISTS job_description_url TEXT")
                cur.execute("ALTER TABLE tbl_demand_sheet ADD COLUMN IF NOT EXISTS assigned_to JSONB DEFAULT '[]'::jsonb")
                
                # Create indexes for better performance  
                cur.execute("CREATE INDEX IF NOT EXISTS idx_recruiter_activity_recruiter_demand ON tbl_recruiter_activity(recruiter_id, demand_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_recruiter_activity_status ON tbl_recruiter_activity(activity_status)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_audit_trail_recruiter ON tbl_audit_trail(recruiter_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_audit_trail_demand ON tbl_audit_trail(demand_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_demand_sheet_assigned_to ON tbl_demand_sheet USING GIN(assigned_to)")
            
            conn.commit()
        except Exception as e:
            print(f"Error in _ensure_tables: {e}")
            conn.rollback()
            raise


# Define literal routes BEFORE parameterized routes to prevent path matching conflicts
@router.get("/activity/{recruiter_id}/{demand_id}")
def get_activity_detail_route(recruiter_id: int, demand_id: int) -> Dict[str, Any]:
    """Get activity status - literal route to prevent /recruiter/activity/9/31 from matching /{recruiter_id}/..."""
    return get_activity_status(recruiter_id, demand_id)

@router.get("/demands")
async def recruiter_demands_no_path_param(
    request: Request,
    page: int = 1,
    size: int = 10,
    recruiter_id: Optional[int] = None
) -> Dict[str, Any]:
    """Demands endpoint - extracts recruiter_id from multiple sources"""
    from .login import extract_recruiter_id_from_request
    recruiter_id = extract_recruiter_id_from_request(request, recruiter_id)
    
    if not recruiter_id:
        raise HTTPException(status_code=400, detail="recruiter_id required (query param, JWT token, or X-Recruiter-ID header)")
    
    return recruiter_demands(recruiter_id, page, size)

@router.get("/{recruiter_id}/demands")
def recruiter_demands(recruiter_id: int, page: int = 1, size: int = 10) -> Dict[str, Any]:
    _ensure_tables()
    print(f"Recruiter API Debug - Fetching demands for recruiter_id: {recruiter_id}")
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Ensure assigned_to exists and filter where assigned_to JSON contains recruiter_id
                try:
                    cur.execute("ALTER TABLE tbl_demand_sheet ADD COLUMN IF NOT EXISTS assigned_to JSONB DEFAULT '[]'::jsonb")
                except Exception:
                    pass
                
                # Debug: Check what's in the assigned_to column
                try:
                    cur.execute("SELECT id, assigned_to FROM tbl_demand_sheet WHERE assigned_to IS NOT NULL AND assigned_to != '[]'::jsonb LIMIT 5")
                    debug_rows = cur.fetchall()
                    print(f"Recruiter API Debug - Sample assigned_to data: {debug_rows}")
                except Exception as e:
                    print(f"Recruiter API Debug - Error checking assigned_to data: {e}")
                    # Try to fix the column type
                    try:
                        cur.execute("ALTER TABLE tbl_demand_sheet ALTER COLUMN assigned_to TYPE JSONB USING assigned_to::JSONB")
                        conn.commit()
                        print("Recruiter API Debug - Fixed assigned_to column type")
                    except Exception as fix_error:
                        print(f"Recruiter API Debug - Could not fix column type: {fix_error}")
                        # Rollback any failed transaction
                        conn.rollback()
                
                # total - Updated to handle array format {3,4} instead of key-value format
                print(f"Recruiter API Debug - Searching for recruiter_id: {recruiter_id} in assigned_to array")
                
                try:
                        # First try JSON format (new format) - check for recruiter_id in array
                        search_json = json.dumps([{"recruiter_id": int(recruiter_id)}])
                        cur.execute(
                            """
                            SELECT COUNT(1)
                            FROM tbl_demand_sheet ds
                            LEFT JOIN tbl_recruiter_activity ra ON ra.demand_id = ds.id AND ra.recruiter_id = %s
                            WHERE COALESCE(ds.assigned_to,'[]'::jsonb) @> %s::jsonb
                            AND COALESCE(ra.activity_status, 'open') IN ('open','processing','hold')
                            """,
                            (recruiter_id, search_json)
                        )
                        total = int(cur.fetchone()[0])
                        print(f"Recruiter API Debug - Total demands found (JSON format): {total}")
                except Exception as json_error:
                    print(f"Recruiter API Debug - JSON query failed: {json_error}")
                    try:
                        # Try array format (old format)
                        cur.execute(
                            """
                            SELECT COUNT(1)
                            FROM tbl_demand_sheet ds
                            LEFT JOIN tbl_recruiter_activity ra ON ra.demand_id = ds.id AND ra.recruiter_id = %s
                            WHERE %s = ANY(ds.assigned_to)
                            AND COALESCE(ra.activity_status, 'open') IN ('open','processing','hold')
                            """,
                            (recruiter_id, recruiter_id)
                        )
                        total = int(cur.fetchone()[0])
                        print(f"Recruiter API Debug - Total demands found (array format): {total}")
                    except Exception as array_error:
                        print(f"Recruiter API Debug - Array query failed: {array_error}")
                        # Fallback to simple count
                        cur.execute("""
                            SELECT COUNT(1) 
                            FROM tbl_demand_sheet ds
                            LEFT JOIN tbl_recruiter_activity ra ON ra.demand_id = ds.id AND ra.recruiter_id = %s
                            WHERE COALESCE(ra.activity_status, 'open') IN ('open','processing','hold')
                        """, (recruiter_id,))
                        total = int(cur.fetchone()[0])
                        print(f"Recruiter API Debug - Fallback total: {total}")
                
                # page items - include activity_status from tbl_recruiter_activity
                try:
                        # First try JSON format (new format) - check for recruiter_id in array
                        search_json = json.dumps([{"recruiter_id": int(recruiter_id)}])
                        cur.execute(
                            """
                            SELECT 
                              ds.id,
                              ds.client_id,
                              c.client_name,
                              ds.skill AS job_title,
                              ds.skill AS demand_name,
                              ds.no_of_positions,
                              ds.priority,
                              ds.status,
                              ds.updated_at,
                              ds.assigned_to,
                              COALESCE(ra.activity_status, 'open') AS activity_status
                            FROM tbl_demand_sheet ds
                            LEFT JOIN tbl_clients c ON c.id = ds.client_id
                            LEFT JOIN tbl_recruiter_activity ra ON ra.demand_id = ds.id AND ra.recruiter_id = %s
                            WHERE COALESCE(ds.assigned_to,'[]'::jsonb) @> %s::jsonb
                            AND COALESCE(ra.activity_status, 'open') IN ('open','processing','hold')
                            ORDER BY ds.updated_at DESC NULLS LAST, ds.id DESC
                            OFFSET %s LIMIT %s
                            """,
                            (recruiter_id, search_json, (page-1)*size, size)
                        )
                except Exception as query_error:
                    print(f"Recruiter API Debug - JSON query failed: {query_error}")
                    try:
                        # Try array format (old format)
                        cur.execute(
                            """
                            SELECT 
                              ds.id,
                              ds.client_id,
                              c.client_name,
                              ds.skill AS job_title,
                              ds.skill AS demand_name,
                              ds.no_of_positions,
                              ds.priority,
                              ds.status,
                              ds.updated_at,
                              ds.assigned_to,
                              COALESCE(ra.activity_status, 'open') AS activity_status
                            FROM tbl_demand_sheet ds
                            LEFT JOIN tbl_clients c ON c.id = ds.client_id
                            LEFT JOIN tbl_recruiter_activity ra ON ra.demand_id = ds.id AND ra.recruiter_id = %s
                            WHERE %s = ANY(ds.assigned_to)
                            AND COALESCE(ra.activity_status, 'open') IN ('open','processing','hold')
                            ORDER BY ds.updated_at DESC NULLS LAST, ds.id DESC
                            OFFSET %s LIMIT %s
                            """,
                            (recruiter_id, recruiter_id, (page-1)*size, size)
                        )
                    except Exception as array_error:
                        print(f"Recruiter API Debug - Array query also failed: {array_error}")
                        # Final fallback - get all demands
                        cur.execute(
                            """
                            SELECT 
                              ds.id,
                              ds.client_id,
                              c.client_name,
                              ds.skill AS job_title,
                              ds.skill AS demand_name,
                              ds.no_of_positions,
                              ds.priority,
                              ds.status,
                              ds.updated_at,
                              ds.assigned_to,
                              COALESCE(ra.activity_status, 'open') AS activity_status
                            FROM tbl_demand_sheet ds
                            LEFT JOIN tbl_clients c ON c.id = ds.client_id
                            LEFT JOIN tbl_recruiter_activity ra ON ra.demand_id = ds.id AND ra.recruiter_id = %s
                            WHERE COALESCE(ra.activity_status, 'open') IN ('open','processing','hold')
                            ORDER BY ds.updated_at DESC NULLS LAST, ds.id DESC
                            OFFSET %s LIMIT %s
                            """,
                            (recruiter_id, (page-1)*size, size)
                        )
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description]
                items = _rows_to_dicts(cols, rows)
                response_data = {"items": items, "total": total, "page": page, "size": size}
                return JSONResponse(content=response_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch demands: {e}")


# -----------------
# Spec alias routes
# -----------------

@router.post("/activity/start/{demand_id}")
def alias_activity_start(demand_id: int, recruiter_id: Optional[int] = None) -> Dict[str, Any]:
    """Alias: POST /recruiter/activity/start/{demand_id}?recruiter_id=R"""
    if not recruiter_id:
        raise HTTPException(status_code=400, detail="recruiter_id is required")
    return open_demand(recruiter_id, demand_id)


@router.get("/activity/{demand_id}")
def alias_activity_detail(demand_id: int, recruiter_id: Optional[int] = None) -> Dict[str, Any]:
    """Alias: GET /recruiter/activity/{demand_id}?recruiter_id=R returns JD, questions, cv_list"""
    if not recruiter_id:
        raise HTTPException(status_code=400, detail="recruiter_id is required")
    # Compose from existing endpoints
    # Get activity for recruiter
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT a.id, a.cv_list, a.required_cv_count, a.uploaded_cv_count,
                           ds.skill, ds.skill
                    FROM tbl_recruiter_activity a
                    LEFT JOIN tbl_demand_sheet ds ON ds.id = a.demand_id
                    WHERE a.recruiter_id=%s AND a.demand_id=%s AND a.activity_status='processing'
                    ORDER BY a.id DESC LIMIT 1
                    """,
                    (recruiter_id, demand_id)
                )
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="No active activity found")
                activity_id, cv_list, req_count, upl_count, jd_text, jd_url = row
        # Questions via generator - simplified for now
        questions = []
        try:
            parsed_cv_list = cv_list if isinstance(cv_list, list) else json.loads(cv_list or "[]")
        except Exception:
            parsed_cv_list = []
        return {
            "activity_id": int(activity_id),
            "required_cv_count": req_count,
            "uploaded_cv_count": upl_count,
            "job_description": jd_text,
            "job_description_url": jd_url,
            "questions": questions,
            "cv_list": parsed_cv_list,
        }
    except Exception as e:
        print(f"Error in activity endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch activity: {e}")


@router.post("/activity/questions/refresh")
def alias_questions_refresh(demand_id: int, recruiter_id: Optional[int] = None) -> Dict[str, Any]:
    if not recruiter_id:
        raise HTTPException(status_code=400, detail="recruiter_id is required")
    return generate_ai_questions(recruiter_id, demand_id)


@router.post("/activity/upload_cv")
def alias_upload_cv(file: UploadFile = File(...), demand_id: int = Form(...), recruiter_id: int = Form(...)) -> Dict[str, Any]:
    """Alias for upload-cv per spec."""
    return upload_cv(file=file, demand_id=demand_id, recruiter_id=recruiter_id)


@router.get("/audit/active/{recruiter_id}")
def audit_active_demand(recruiter_id: int) -> Dict[str, Any]:
    """Return the currently active demand for recruiter (based on activity)."""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT demand_id, opened_at FROM tbl_recruiter_activity
                    WHERE recruiter_id=%s AND activity_status='processing'
                    ORDER BY opened_at DESC NULLS LAST, id DESC LIMIT 1
                    """,
                    (recruiter_id,)
                )
                row = cur.fetchone()
                if not row:
                    return {"demand_id": None}
                return {"demand_id": int(row[0]), "opened_at": row[1]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch active demand: {e}")


@router.get("/{recruiter_id}/demand/{demand_id}")
def recruiter_demand_detail(recruiter_id: int, demand_id: int) -> Dict[str, Any]:
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                try:
                    # Preferred: join clients; job_title comes from skill, JD URL comes from job_description_url
                    cur.execute(
                        """
                        SELECT 
                          ds.id,
                          ds.client_id,
                          ds.spoc_id,
                          ds.skill AS job_title,
                          COALESCE(c.client_name, '') AS client_name,
                          ds.skill,
                          ds.skill,
                          ds.no_of_positions,
                          ds.priority,
                          ds.status,
                          ds.assigned_to,
                          ds.created_at,
                          ds.updated_at,
                          COALESCE(spoc.spoc_name, '') AS spoc_name,
                          COALESCE(spoc.email, '') AS spoc_email,
                          COALESCE(spoc.phone_number, '') AS spoc_phone
                        FROM tbl_demand_sheet ds
                        LEFT JOIN tbl_clients c ON ds.client_id = c.id
                        LEFT JOIN tbl_client_spocs spoc ON ds.spoc_id = spoc.id
                        WHERE ds.id=%s
                        """,
                        (demand_id,)
                    )
                    row = cur.fetchone()
                    if not row:
                        raise HTTPException(status_code=404, detail="Demand not found")
                    cols = [d[0] for d in cur.description]
                    result = dict(zip(cols, row))
                    return result
                except Exception:
                    # Fallback without clients join; rollback any aborted transaction first
                    try:
                        conn.rollback()
                    except Exception:
                        pass
                    with conn.cursor() as cur2:
                        cur2.execute(
                        """
                        SELECT 
                          id,
                          client_id,
                          spoc_id,
                          skill AS job_title,
                          '' AS client_name,
                          skill,
                          skill,
                          no_of_positions,
                          priority,
                          status,
                          assigned_to,
                          created_at,
                          updated_at,
                          '' AS spoc_name,
                          '' AS spoc_email,
                          '' AS spoc_phone
                        FROM tbl_demand_sheet
                        WHERE id=%s
                        """,
                        (demand_id,)
                    )
                        row = cur2.fetchone()
                        if not row:
                            raise HTTPException(status_code=404, detail="Demand not found")
                        cols = [d[0] for d in cur2.description]
                        return dict(zip(cols, row))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch demand detail: {e}")


def _start_listener(recruiter_id: int, demand_id: int, cv_folder_path: Optional[str]) -> None:
    if cv_folder_path is None:
        return
    # Prefer service if available
    if cv_listener_service:
        try:
            cv_listener_service.start_watcher(recruiter_id, demand_id, cv_folder_path)
            return
        except Exception:
            pass
    # Fallback: start direct watcher using Downloads as source
    try:
        from .cv_listener import start_listener as _start  # type: ignore
    except Exception:
        try:
            from api.cv_listener import start_listener as _start  # type: ignore
        except Exception:
            return
    try:
        home = os.path.expanduser("~")
        downloads = os.path.join(home, "Downloads")
        downloads = os.getenv("RECRUITER_DOWNLOADS_DIR", downloads)
        # Fire and forget background watcher
        _start(recruiter_id, demand_id, downloads, cv_folder_path, DATABASE_DSN)
    except Exception:
        pass


def _stop_listener(recruiter_id: int, demand_id: int) -> None:
    if cv_listener_service:
        try:
            cv_listener_service.stop_watcher(recruiter_id, demand_id)
        except Exception:
            pass


@router.post("/{recruiter_id}/demand/{demand_id}/open")
def open_demand(recruiter_id: int, demand_id: int) -> Dict[str, Any]:
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Ensure only one task can be in processing status at a time
                # Move any existing processing tasks to 'hold'
                cur.execute(
                    """
                    UPDATE tbl_recruiter_activity 
                    SET activity_status='hold', updated_at=NOW()
                    WHERE recruiter_id=%s AND activity_status='processing'
                    """,
                    (recruiter_id,)
                )
                # Check if activity already exists for this recruiter-demand pair
                cur.execute(
                    "SELECT id FROM tbl_recruiter_activity WHERE recruiter_id=%s AND demand_id=%s",
                    (recruiter_id, demand_id)
                )
                existing_activity = cur.fetchone()
                
                if existing_activity:
                    # Update existing activity
                    cur.execute(
                        """
                        UPDATE tbl_recruiter_activity 
                        SET activity_status='processing', opened_at=NOW(), closed_at=NULL, updated_at=NOW()
                        WHERE recruiter_id=%s AND demand_id=%s
                        RETURNING id
                        """,
                        (recruiter_id, demand_id)
                    )
                    activity_id = int(cur.fetchone()[0])
                else:
                    # Insert new activity
                    cur.execute(
                        """
                        INSERT INTO tbl_recruiter_activity (recruiter_id, demand_id, activity_status, opened_at)
                        VALUES (%s, %s, 'processing', NOW())
                        RETURNING id
                        """,
                        (recruiter_id, demand_id)
                    )
                    activity_id = int(cur.fetchone()[0])

                # Sync required_cv_count from demand sheet
                try:
                    cur.execute("SELECT required_cv_count FROM tbl_demand_sheet WHERE id=%s", (demand_id,))
                    row = cur.fetchone()
                    required = int(row[0]) if row and row[0] is not None else None
                    cur.execute(
                        "UPDATE tbl_recruiter_activity SET required_cv_count=%s, updated_at=NOW() WHERE id=%s",
                        (required, activity_id)
                    )
                except Exception:
                    pass
                # Audit start
                cur.execute(
                    "INSERT INTO tbl_audit_trail (event_type, recruiter_id, demand_id, details) VALUES ('start_process', %s, %s, %s::jsonb)",
                    (recruiter_id, demand_id, json.dumps({"activity_id": activity_id}))
                )
                # Fetch settings for listener and ensure demand folder structure
                cur.execute("SELECT cv_download_path FROM tbl_recruiter_settings WHERE recruiter_id=%s", (recruiter_id,))
                row = cur.fetchone()
                cv_folder_path = row[0] if row else None
                # Ensure nested structure <recruiter_folder_path>/demand/<recruiter_id>/<demand_id>/
                try:
                    if cv_folder_path and os.path.isdir(cv_folder_path):
                        base_demand_dir = os.path.join(cv_folder_path, "demand", str(recruiter_id), str(demand_id))
                        os.makedirs(base_demand_dir, exist_ok=True)
                    else:
                        # Log safe console message when folder path missing
                        print(f"[WARN] Recruiter folder path not found for recruiter_id: {recruiter_id}")
                        # Proceed without raising to avoid blocking UI
                except Exception as e:
                    # Do not fail the API; just log
                    print(f"[WARN] Unable to create recruiter demand folder for recruiter_id={recruiter_id}, demand_id={demand_id}")
                    try:
                        traceback.print_exc()
                    except UnicodeEncodeError:
                        print(f"[WARN] Error details: {str(e)}")
                conn.commit()
        try:
            _start_listener(recruiter_id, demand_id, cv_folder_path)
        except UnicodeEncodeError:
            print(f"[WARN] Unicode error in listener start for recruiter_id={recruiter_id}, demand_id={demand_id}")
        except Exception as e:
            print(f"[WARN] Error starting listener: {str(e)}")
        return {"message": "Activity started", "activity_id": int(activity_id)}
    except Exception as e:
        try:
            error_msg = f"Failed to open demand: {e}"
        except UnicodeEncodeError:
            error_msg = f"Failed to open demand: {str(e)}"
        raise HTTPException(status_code=500, detail=error_msg)


@router.post("/{recruiter_id}/demand/{demand_id}/hold")
def hold_demand(recruiter_id: int, demand_id: int) -> Dict[str, Any]:
    """Hold a demand (move from processing to hold)"""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE tbl_recruiter_activity SET activity_status='hold', updated_at=NOW() WHERE recruiter_id=%s AND demand_id=%s AND activity_status='processing'",
                    (recruiter_id, demand_id),
                )
                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="No processing activity found for this demand")
                # Also reflect in assigned_to JSON of tbl_demand_sheet
                try:
                    cur.execute("SELECT COALESCE(assigned_to,'[]'::jsonb) FROM tbl_demand_sheet WHERE id=%s", (demand_id,))
                    row = cur.fetchone()
                    assigned = row[0] if row else []
                    import json as _json
                    data = assigned if isinstance(assigned, list) else _json.loads(assigned or "[]")
                    for item in data:
                        if item.get("recruiter_id") == int(recruiter_id):
                            item["processing"] = False
                    cur.execute(
                        "UPDATE tbl_demand_sheet SET assigned_to=%s::jsonb, updated_at=NOW() WHERE id=%s",
                        (_json.dumps(data), demand_id)
                    )
                except Exception:
                    pass
                # Audit hold
                cur.execute(
                    "INSERT INTO tbl_audit_trail (event_type, recruiter_id, demand_id) VALUES ('hold_process', %s, %s)",
                    (recruiter_id, demand_id)
                )
                conn.commit()
        _stop_listener(recruiter_id, demand_id)
        return {"message": "Demand moved to hold"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to hold demand: {e}")

@router.post("/{recruiter_id}/demand/{demand_id}/resume")
def resume_demand(recruiter_id: int, demand_id: int) -> Dict[str, Any]:
    """Resume a demand (move from hold to processing)"""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # First, move any existing processing tasks to hold
                cur.execute(
                    """
                    UPDATE tbl_recruiter_activity 
                    SET activity_status='hold', updated_at=NOW()
                    WHERE recruiter_id=%s AND activity_status='processing'
                    """,
                    (recruiter_id,)
                )
                # Then resume the specified demand
                cur.execute(
                    "UPDATE tbl_recruiter_activity SET activity_status='processing', opened_at=NOW(), closed_at=NULL, updated_at=NOW() WHERE recruiter_id=%s AND demand_id=%s AND activity_status='hold'",
                    (recruiter_id, demand_id),
                )
                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="No hold activity found for this demand")
                # Also reflect in assigned_to JSON of tbl_demand_sheet: mark only this recruiter as processing
                try:
                    cur.execute("SELECT COALESCE(assigned_to,'[]'::jsonb) FROM tbl_demand_sheet WHERE id=%s", (demand_id,))
                    row = cur.fetchone()
                    assigned = row[0] if row else []
                    import json as _json
                    data = assigned if isinstance(assigned, list) else _json.loads(assigned or "[]")
                    for item in data:
                        item["processing"] = (item.get("recruiter_id") == int(recruiter_id))
                    cur.execute(
                        "UPDATE tbl_demand_sheet SET assigned_to=%s::jsonb, status='in_progress', updated_at=NOW() WHERE id=%s",
                        (_json.dumps(data), demand_id)
                    )
                except Exception:
                    pass
                # Audit resume
                cur.execute(
                    "INSERT INTO tbl_audit_trail (event_type, recruiter_id, demand_id) VALUES ('resume_process', %s, %s)",
                    (recruiter_id, demand_id)
                )
                conn.commit()
        return {"message": "Demand resumed"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resume demand: {e}")

@router.post("/{recruiter_id}/demand/{demand_id}/close")
def close_demand(recruiter_id: int, demand_id: int) -> Dict[str, Any]:
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE tbl_recruiter_activity SET activity_status='closed', closed_at=NOW(), updated_at=NOW() WHERE recruiter_id=%s AND demand_id=%s AND activity_status='processing'",
                    (recruiter_id, demand_id),
                )
                # Audit close
                cur.execute(
                    "INSERT INTO tbl_audit_trail (event_type, recruiter_id, demand_id) VALUES ('close_process', %s, %s)",
                    (recruiter_id, demand_id)
                )
                conn.commit()
        _stop_listener(recruiter_id, demand_id)
        return {"message": "Activity closed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to close demand: {e}")


@router.get("/{recruiter_id}/activity/ai-questions")
def generate_ai_questions(recruiter_id: int, demand_id: int) -> Dict[str, Any]:
    """Generate AI questions for a demand.
    This endpoint is resilient to missing fields/tables and will
    return a reasonable default set of questions if details are unavailable.
    """
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get demand details (be tolerant of missing clients table/columns)
                try:
                    cur.execute(
                        """
                        SELECT 
                         ds.skill AS job_title,
                          ds.skill,
                          ds.skill,
                          ds.experience_level,
                          ds.location,
                          ds.salary_range,
                          COALESCE(c.client_name, '') AS client_name
                        FROM tbl_demand_sheet ds
                        LEFT JOIN tbl_clients c ON ds.client_id = c.id
                        WHERE ds.id = %s
                        """,
                        (demand_id,)
                    )
                except Exception:
                    # Fallback without clients table
                    cur.execute(
                        """
                        SELECT 
                          COALESCE(NULLIF(job_title,''), skill) AS job_title,
                          skill,
                          skill,
                          experience_level,
                          location,
                          salary_range,
                          '' as client_name
                        FROM tbl_demand_sheet
                        WHERE id = %s
                        """,
                        (demand_id,)
                    )

                row = cur.fetchone()
                if not row:
                    # Minimal defaults if demand not found
                    questions = [
                        "Describe the candidate's relevant experience.",
                        "What technologies is the candidate strongest in?",
                        "What is the candidate's current CTC and expected CTC?",
                        "What is the candidate's notice period?",
                        "Is the candidate open to relocation?",
                    ]
                    return {"questions": questions}

                job_title, job_description, skill, experience_level, location, salary_range, client_name = row

                # Normalize strings
                job_title = (job_title or '').strip() or 'the role'
                skill = (skill or '').strip() or 'the required skills'
                client_name = (client_name or '').strip()
                experience_level = (experience_level or '').strip()
                location = (location or '').strip()

                # Build a pool of question candidates centered on job_title and job_description
                jd_plain = (job_description or '').strip()
                title_fragment = job_title if job_title and job_title != 'the role' else skill

                pool: List[str] = [
                    f"Describe the candidate's most relevant projects for {title_fragment}.",
                    f"Rate the candidate's proficiency with the core technologies for {title_fragment}.",
                    f"How many years of hands-on experience does the candidate have in {title_fragment}?",
                    f"Which responsibilities in the JD can the candidate immediately own for {title_fragment}?",
                    f"What gaps versus the JD should be discussed for {title_fragment}?",
                    f"Summarize achievements that align with this role's KPIs for {title_fragment}.",
                    f"What domains or industries in the JD has the candidate worked in before?",
                    f"How does the candidate's profile align with the required tooling and environment in the JD?",
                    "What is the candidate's notice period and earliest start date?",
                    "What are the candidate's salary expectations and flexibility?",
                ]

                if jd_plain:
                    pool.extend([
                        "List keywords from the JD the candidate strongly matches.",
                        "Which JD requirements are potentially weak for this candidate?",
                        "Provide two follow-up questions to validate JD-critical experience.",
                    ])
                if client_name:
                    pool.append(f"Has the candidate worked in environments similar to {client_name}?")
                if location:
                    pool.append(f"Is the candidate able to work from/relocate to {location}?")
                if experience_level:
                    pool.append(f"Does the candidate meet the {experience_level} experience band?")

                # Ensure exactly 5 and vary per refresh
                import random
                random.shuffle(pool)
                selected = pool[:5] if len(pool) >= 5 else (pool + [
                    "Describe the candidate's relevant experience.",
                    "What technologies is the candidate strongest in?",
                    "What is the candidate's current CTC and expected CTC?",
                    "What is the candidate's notice period?",
                    "Is the candidate open to relocation?",
                ])[:5]

                return {"questions": selected}
    except HTTPException:
        raise
    except Exception as e:
        # Never 500 the UI for question generation; return defaults
        fallback = [
            "Describe the candidate's relevant experience.",
            "What technologies is the candidate strongest in?",
            "What is the candidate's current CTC and expected CTC?",
            "What is the candidate's notice period?",
            "Is the candidate open to relocation?",
        ]
        return {"questions": fallback, "warning": f"fallback_used: {str(e)[:120]}"}


@router.get("/{recruiter_id}/activity")
def recruiter_activity(recruiter_id: int) -> Optional[Dict[str, Any]]:
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT a.id, a.recruiter_id, a.demand_id, a.activity_status, a.opened_at, a.closed_at, a.cv_list,
                           ds.skill, ds.skill
                    FROM tbl_recruiter_activity a
                    LEFT JOIN tbl_demand_sheet ds ON ds.id = a.demand_id
                    WHERE a.recruiter_id=%s AND a.activity_status='processing'
                    ORDER BY a.id DESC LIMIT 1
                    """,
                    (recruiter_id,),
                )
                row = cur.fetchone()
                if not row:
                    return None
                cols = [d[0] for d in cur.description]
                result = dict(zip(cols, row))
                # normalize JSON type
                if isinstance(result.get("cv_list"), str):
                    try:
                        result["cv_list"] = json.loads(result["cv_list"])  # type: ignore
                    except Exception:
                        result["cv_list"] = []
                return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch activity: {e}")


# Dashboard API endpoints
@router.get("/{recruiter_id}/dashboard/summary")
def get_dashboard_summary(recruiter_id: int) -> Dict[str, Any]:
    """Get recruiter dashboard summary with KPIs and CV status processing"""
    _ensure_tables()
    
    if not recruiter_id or recruiter_id == 0:
        raise HTTPException(status_code=422, detail="Invalid recruiter ID provided")
    
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get activities with status in ('open', 'processing', 'hold') only
                cur.execute("""
                    SELECT 
                        ra.*,
                        ds.skill AS job_title,
                        COALESCE(c.client_name, '') AS client_name,
                        ds.skill,
                        ds.no_of_positions,
                        ds.priority,
                        ds.status AS demand_status
                    FROM tbl_recruiter_activity ra
                    LEFT JOIN tbl_demand_sheet ds ON ra.demand_id = ds.id
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    WHERE ra.recruiter_id = %s 
                    AND ra.activity_status IN ('open', 'processing', 'hold')
                    ORDER BY ra.updated_at DESC
                """, (recruiter_id,))
                
                activities = _rows_to_dicts([desc[0] for desc in cur.description], cur.fetchall())
                
                # Initialize counters
                total_demands = len(activities)
                total_cvs = 0
                approved = 0
                under_verification = 0
                rejected = 0
                
                # Process each activity's cv_list JSON
                for activity in activities:
                    cv_list = []
                    if activity.get('cv_list'):
                        try:
                            cv_list = json.loads(activity['cv_list']) if isinstance(activity['cv_list'], str) else activity['cv_list']
                        except:
                            cv_list = []
                    
                    # Count CVs by status from cv_list JSON
                    for cv in cv_list:
                        if isinstance(cv, dict) and 'status' in cv:
                            total_cvs += 1
                            status = cv.get('status')
                            if status == 1:  # approved
                                approved += 1
                            elif status == 0:  # under verification
                                under_verification += 1
                            elif status == 2:  # rejected
                                rejected += 1
                
                # Calculate approval rate
                approval_rate = round((approved / total_cvs) * 100, 1) if total_cvs > 0 else 0
                
                return {
                    "summary": {
                        "total_demands": total_demands,
                        "total_cvs": total_cvs,
                        "approved": approved,
                        "under_verification": under_verification,
                        "rejected": rejected,
                        "approval_rate": approval_rate
                    },
                    "activities": activities
                }
    except Exception as e:
        print(f"Error getting recruiter dashboard: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch dashboard summary: {e}")


# Define literal route for /recruiter/dashboard before parameterized routes
@router.get("/dashboard")
async def recruiter_dashboard_no_path_param(
    request: Request,
    recruiter_id: Optional[int] = None
) -> Dict[str, Any]:
    """Dashboard endpoint - extracts recruiter_id from multiple sources"""
    from .login import extract_recruiter_id_from_request
    
    # Debug: Log all headers
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Request headers: {dict(request.headers)}")
    
    recruiter_id = extract_recruiter_id_from_request(request, recruiter_id)
    
    if not recruiter_id:
        raise HTTPException(status_code=400, detail="recruiter_id required (query param, JWT token, or X-Recruiter-ID header)")
    
    return get_recruiter_dashboard(recruiter_id)

@router.get("/{recruiter_id}/dashboard")
def get_recruiter_dashboard(recruiter_id: int) -> Dict[str, Any]:
    """Get comprehensive recruiter dashboard data with CV statistics and visualizations"""
    _ensure_tables()
    
    if not recruiter_id or recruiter_id == 0:
        raise HTTPException(status_code=422, detail="Invalid recruiter ID provided")
    
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get all activities for the recruiter with status in ('open', 'processing', 'hold')
                cur.execute("""
                    SELECT 
                        ra.*,
                        COALESCE(c.client_name, '') AS client_name,
                        ds.skill,
                        ds.no_of_positions,
                        ds.priority,
                        ds.status as demand_status
                    FROM tbl_recruiter_activity ra
                    LEFT JOIN tbl_demand_sheet ds ON ra.demand_id = ds.id
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    WHERE ra.recruiter_id = %s 
                    AND ra.activity_status IN ('open', 'processing', 'hold')
                    ORDER BY ra.updated_at DESC
                """, (recruiter_id,))
                
                activities = _rows_to_dicts([desc[0] for desc in cur.description], cur.fetchall())
                
                # Initialize counters
                total_demands = len(activities)
                total_cvs = 0
                approved = 0
                under_verification = 0
                rejected = 0
                
                # Process each activity's cv_list
                processed_activities = []
                for activity in activities:
                    # Parse cv_list JSON
                    cv_list = []
                    if activity.get('cv_list'):
                        try:
                            cv_list = json.loads(activity['cv_list']) if isinstance(activity['cv_list'], str) else activity['cv_list']
                        except:
                            cv_list = []
                    
                    # Count CVs by status
                    activity_cv_count = 0
                    activity_approved = 0
                    activity_under_verification = 0
                    activity_rejected = 0
                    
                    for cv in cv_list:
                        if isinstance(cv, dict) and 'status' in cv:
                            total_cvs += 1
                            activity_cv_count += 1
                            
                            status = cv.get('status')
                            if status == 1:  # approved
                                approved += 1
                                activity_approved += 1
                            elif status == 0:  # under verification
                                under_verification += 1
                                activity_under_verification += 1
                            elif status == 2:  # rejected
                                rejected += 1
                                activity_rejected += 1
                    
                    # Add processed data to activity
                    activity['cv_list'] = cv_list
                    activity['cv_stats'] = {
                        'total': activity_cv_count,
                        'approved': activity_approved,
                        'under_verification': activity_under_verification,
                        'rejected': activity_rejected
                    }
                    
                    # Calculate progress percentage
                    required_count = activity.get('required_cv_count', 0)
                    uploaded_count = activity.get('uploaded_cv_count', 0)
                    progress_percentage = (uploaded_count / required_count * 100) if required_count > 0 else 0
                    activity['progress_percentage'] = round(progress_percentage, 1)
                    
                    processed_activities.append(activity)
                
                # Create summary statistics
                summary = {
                    'total_demands': total_demands,
                    'total_cvs': total_cvs,
                    'approved': approved,
                    'under_verification': under_verification,
                    'rejected': rejected
                }
                
                # Calculate approval rate
                if total_cvs > 0:
                    summary['approval_rate'] = round((approved / total_cvs) * 100, 1)
                else:
                    summary['approval_rate'] = 0
                
                # Get trend data (last 30 days)
                cur.execute("""
                    SELECT 
                        DATE(ra.updated_at) as date,
                        COUNT(*) as daily_uploads
                    FROM tbl_recruiter_activity ra
                    WHERE ra.recruiter_id = %s 
                    AND ra.updated_at >= NOW() - INTERVAL '30 days'
                    AND ra.uploaded_cv_count > 0
                    GROUP BY DATE(ra.updated_at)
                    ORDER BY date DESC
                """, (recruiter_id,))
                
                trend_data = _rows_to_dicts([desc[0] for desc in cur.description], cur.fetchall())
                
                return {
                    'summary': summary,
                    'activities': processed_activities,
                    'trend_data': trend_data
                }
                
    except Exception as e:
        print(f"Error getting recruiter dashboard: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to get dashboard data")


@router.get("/{recruiter_id}/dashboard/demands")
def get_dashboard_demands(recruiter_id: int) -> Dict[str, Any]:
    """Get detailed demand data for dashboard"""
    _ensure_tables()
    
    if not recruiter_id or recruiter_id == 0:
        raise HTTPException(status_code=422, detail="Invalid recruiter ID provided")
    
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 
                        ds.id as demand_id,
                        ds.skill as title,
                        ds.job_description,
                        COALESCE(ra.required_cv_count, 0) as required_cv_count,
                        COALESCE(ra.uploaded_cv_count, 0) as uploaded_cv_count,
                        ds.status,
                        ds.assigned_to,
                        ds.created_at as assigned_date,
                        c.client_name,
                        COUNT(CASE WHEN cv_data.status = 'approved' THEN 1 END) as approved_cv_count
                    FROM tbl_demand_sheet ds
                    LEFT JOIN tbl_clients c ON c.id = ds.client_id
                    LEFT JOIN tbl_recruiter_activity ra ON ra.demand_id = ds.id AND ra.recruiter_id = %s
                    LEFT JOIN LATERAL (
                        SELECT jsonb_array_elements(COALESCE(ra.cv_list, '[]'::jsonb)) as cv_data
                    ) cv_data ON true
                    WHERE ds.assigned_to::text LIKE %s
                    GROUP BY ds.id, ds.skill, ds.job_description, ra.required_cv_count, 
                             ra.uploaded_cv_count, ds.status, ds.assigned_to, ds.created_at, c.client_name
                    ORDER BY ds.created_at DESC
                """, (recruiter_id, f"%{recruiter_id}%"))
                
                demands = []
                for row in cur.fetchall():
                    demands.append({
                        "demand_id": row[0],
                        "title": row[1],
                        "job_description": row[2],
                        "required_cv_count": row[3],
                        "uploaded_cv_count": row[4],
                        "status": row[5],
                        "assigned_date": row[7].isoformat() if row[7] else None,
                        "client_name": row[8],
                        "approved_cv_count": row[9] or 0
                    })
                
                return {"demands": demands}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch dashboard demands: {e}")


@router.get("/{recruiter_id}/dashboard/timeseries")
def get_dashboard_timeseries(recruiter_id: int, days: int = 30) -> Dict[str, Any]:
    """Get time series data for dashboard charts"""
    _ensure_tables()
    
    if not recruiter_id or recruiter_id == 0:
        raise HTTPException(status_code=422, detail="Invalid recruiter ID provided")
    
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get daily activity data
                cur.execute("""
                    WITH date_series AS (
                        SELECT generate_series(
                            CURRENT_DATE - INTERVAL '%s days',
                            CURRENT_DATE,
                            INTERVAL '1 day'
                        )::date as date
                    ),
                    daily_activity AS (
                        SELECT 
                            DATE(ra.created_at) as activity_date,
                            COUNT(CASE WHEN ra.activity_status = 'processing' THEN 1 END) as uploads,
                            COUNT(CASE WHEN cv_data.status = 'approved' THEN 1 END) as approvals,
                            COUNT(CASE WHEN cv_data.status = 'rejected' THEN 1 END) as rejections
                        FROM tbl_recruiter_activity ra
                        LEFT JOIN LATERAL (
                            SELECT jsonb_array_elements(COALESCE(ra.cv_list, '[]'::jsonb)) as cv_data
                        ) cv_data ON true
                        WHERE ra.recruiter_id = %s
                        AND ra.created_at >= CURRENT_DATE - INTERVAL '%s days'
                        GROUP BY DATE(ra.created_at)
                    )
                    SELECT 
                        ds.date,
                        COALESCE(da.uploads, 0) as uploads,
                        COALESCE(da.approvals, 0) as approvals,
                        COALESCE(da.rejections, 0) as rejections
                    FROM date_series ds
                    LEFT JOIN daily_activity da ON ds.date = da.activity_date
                    ORDER BY ds.date
                """, (days, recruiter_id, days))
                
                time_series = []
                for row in cur.fetchall():
                    time_series.append({
                        "date": row[0].isoformat(),
                        "uploads": row[1],
                        "approvals": row[2],
                        "rejections": row[3]
                    })
                
                return {"timeSeries": time_series}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch time series data: {e}")


@router.get("/{recruiter_id}/dashboard/test")
def test_dashboard_connection(recruiter_id: int) -> Dict[str, Any]:
    """Test endpoint to verify database connection and basic data"""
    _ensure_tables()
    
    if not recruiter_id or recruiter_id == 0:
        raise HTTPException(status_code=422, detail="Invalid recruiter ID provided")
    
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Test basic connection
                cur.execute("SELECT 1 as test")
                test_result = cur.fetchone()
                
                # Check if tables exist
                cur.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name IN ('tbl_demand_sheet', 'tbl_recruiter_activity', 'tbl_clients')
                """)
                tables = [row[0] for row in cur.fetchall()]
                
                # Check demand sheet data
                cur.execute("SELECT COUNT(*) FROM tbl_demand_sheet")
                demand_count = cur.fetchone()[0]
                
                # Check recruiter activity data
                cur.execute("SELECT COUNT(*) FROM tbl_recruiter_activity WHERE recruiter_id = %s", (recruiter_id,))
                activity_count = cur.fetchone()[0]
                
                return {
                    "connection_test": test_result[0] if test_result else "failed",
                    "tables_found": tables,
                    "total_demands": demand_count,
                    "recruiter_activities": activity_count,
                    "recruiter_id": recruiter_id
                }
    except Exception as e:
        return {
            "error": str(e),
            "recruiter_id": recruiter_id
        }

@router.get("/{recruiter_id}/dashboard/enhanced")
def get_enhanced_dashboard(recruiter_id: int, days: int = 30) -> Dict[str, Any]:
    """Get enhanced recruiter dashboard data with CV JSON processing"""
    _ensure_tables()
    
    if not recruiter_id or recruiter_id == 0:
        raise HTTPException(status_code=422, detail="Invalid recruiter ID provided")
    
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                print(f"Enhanced Dashboard API - Fetching data for recruiter_id: {recruiter_id}")
                
                # Get activities with cv_list processing - only open, processing, hold statuses
                cur.execute("""
                    SELECT 
                        ra.id,
                        ra.demand_id,
                        ra.activity_status,
                        ra.required_cv_count,
                        ra.uploaded_cv_count,
                        ra.cv_list,
                        ra.opened_at,
                        ra.updated_at,
                        ds.client_name,
                        ds.skill
                    FROM tbl_recruiter_activity ra
                    LEFT JOIN tbl_demand_sheet ds ON ra.demand_id = ds.id
                    WHERE ra.recruiter_id = %s 
                    AND ra.activity_status IN ('open', 'processing', 'hold')
                    ORDER BY ra.updated_at DESC
                """, (recruiter_id,))
                
                activities = _rows_to_dicts([desc[0] for desc in cur.description], cur.fetchall())
                print(f"Found {len(activities)} activities for recruiter {recruiter_id}")
                
                # Process CV data from cv_list JSON
                total_demands = len(activities)
                total_cvs = 0
                approved = 0
                under_verification = 0
                rejected = 0
                
                processed_activities = []
                
                for activity in activities:
                    cv_list = activity.get('cv_list', [])
                    if isinstance(cv_list, str):
                        try:
                            cv_list = json.loads(cv_list)
                        except:
                            cv_list = []
                    
                    # Count CVs by status
                    activity_approved = 0
                    activity_under_verification = 0
                    activity_rejected = 0
                    
                    for cv in cv_list:
                        if isinstance(cv, dict):
                            status = cv.get('status')
                            if status is not None:
                                total_cvs += 1
                                if status == 1:
                                    approved += 1
                                    activity_approved += 1
                                elif status == 0:
                                    under_verification += 1
                                    activity_under_verification += 1
                                elif status == 2:
                                    rejected += 1
                                    activity_rejected += 1
                    
                    # Add processed data to activity
                    activity['approved_cv_count'] = activity_approved
                    activity['under_verification_cv_count'] = activity_under_verification
                    activity['rejected_cv_count'] = activity_rejected
                    activity['title'] = activity.get('job_title', f"Demand #{activity['demand_id']}")
                    activity['status'] = activity['activity_status']
                    activity['assigned_date'] = activity['opened_at']
                    
                    processed_activities.append(activity)
                
                # Get time series data for the specified period
                cur.execute("""
                    SELECT 
                        DATE(ra.updated_at) as date,
                        COUNT(*) as uploads,
                        COALESCE(
                            (SELECT COUNT(*) 
                             FROM jsonb_array_elements(ra.cv_list) as cv 
                             WHERE (cv->>'status')::int = 1), 0
                        ) as approvals,
                        COALESCE(
                            (SELECT COUNT(*) 
                             FROM jsonb_array_elements(ra.cv_list) as cv 
                             WHERE (cv->>'status')::int = 2), 0
                        ) as rejections
                    FROM tbl_recruiter_activity ra
                    WHERE ra.recruiter_id = %s
                    AND ra.updated_at >= CURRENT_DATE - INTERVAL '%s days'
                    GROUP BY DATE(ra.updated_at)
                    ORDER BY date
                """, (recruiter_id, days))
                
                time_series = _rows_to_dicts([desc[0] for desc in cur.description], cur.fetchall())
                
                return {
                    "summary": {
                        "total_demands": total_demands,
                        "total_cvs": total_cvs,
                        "approved": approved,
                        "under_verification": under_verification,
                        "rejected": rejected,
                        "open_demands": len([a for a in processed_activities if a['activity_status'] == 'open']),
                        "processing_demands": len([a for a in processed_activities if a['activity_status'] == 'processing']),
                        "hold_demands": len([a for a in processed_activities if a['activity_status'] == 'hold'])
                    },
                    "activities": processed_activities,
                    "time_series": time_series
                }
                
    except Exception as e:
        print(f"Error in get_enhanced_dashboard: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{recruiter_id}/dashboard/complete")
def get_complete_dashboard(recruiter_id: int, days: int = 30) -> Dict[str, Any]:
    """Get complete dashboard data in a single request"""
    _ensure_tables()
    
    if not recruiter_id or recruiter_id == 0:
        raise HTTPException(status_code=422, detail="Invalid recruiter ID provided")
    
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                print(f"Dashboard API Debug - Fetching data for recruiter_id: {recruiter_id}")
                
                # Simplified demand counts query
                try:
                    cur.execute("""
                        SELECT 
                            COUNT(*) as total_demands,
                            COUNT(CASE WHEN ds.status = 'open' THEN 1 END) as open_demands,
                            COUNT(CASE WHEN ds.status = 'closed' THEN 1 END) as closed_demands
                        FROM tbl_demand_sheet ds
                        WHERE ds.assigned_to::text LIKE %s
                    """, (f"%{recruiter_id}%",))
                    
                    demand_counts = cur.fetchone()
                    print(f"Demand counts: {demand_counts}")
                except Exception as e:
                    print(f"Error in demand counts query: {e}")
                    demand_counts = (0, 0, 0)
                
                # Simplified CV statistics query
                try:
                    cur.execute("""
                        SELECT 
                            COALESCE(SUM(ra.uploaded_cv_count), 0) as total_uploads,
                            COALESCE(SUM(ra.required_cv_count), 0) as total_required,
                            0 as total_approvals,
                            0 as total_rejections
                        FROM tbl_recruiter_activity ra
                        WHERE ra.recruiter_id = %s
                    """, (recruiter_id,))
                    
                    cv_stats = cur.fetchone()
                    print(f"CV stats: {cv_stats}")
                except Exception as e:
                    print(f"Error in CV stats query: {e}")
                    cv_stats = (0, 0, 0, 0)
                
                # Simplified demands query
                try:
                    cur.execute("""
                        SELECT 
                            ds.id as demand_id,
                            ds.skill as title,
                            ds.job_description,
                            COALESCE(ra.required_cv_count, 0) as required_cv_count,
                            COALESCE(ra.uploaded_cv_count, 0) as uploaded_cv_count,
                            ds.status,
                            ds.created_at as assigned_date,
                            c.client_name,
                            0 as approved_cv_count
                        FROM tbl_demand_sheet ds
                        LEFT JOIN tbl_clients c ON c.id = ds.client_id
                        LEFT JOIN tbl_recruiter_activity ra ON ra.demand_id = ds.id AND ra.recruiter_id = %s
                        WHERE ds.assigned_to::text LIKE %s
                        ORDER BY ds.created_at DESC
                        LIMIT 50
                    """, (recruiter_id, f"%{recruiter_id}%"))
                    
                    demands = []
                    for row in cur.fetchall():
                        demands.append({
                            "demand_id": row[0],
                            "title": row[1],
                            "job_description": row[2],
                            "required_cv_count": row[3],
                            "uploaded_cv_count": row[4],
                            "status": row[5],
                            "assigned_date": row[6].isoformat() if row[6] else None,
                            "client_name": row[7],
                            "approved_cv_count": row[8]
                        })
                    print(f"Found {len(demands)} demands")
                except Exception as e:
                    print(f"Error in demands query: {e}")
                    demands = []
                
                # Simplified time series - just return empty for now
                time_series = []
                for i in range(days):
                    date = datetime.now().date() - timedelta(days=i)
                    time_series.append({
                        "date": date.isoformat(),
                        "uploads": 0,
                        "approvals": 0,
                        "rejections": 0
                    })
                
                result = {
                    "summary": {
                        "openDemands": demand_counts[1] or 0,
                        "closedDemands": demand_counts[2] or 0,
                        "totalDemands": demand_counts[0] or 0,
                        "totalUploads": cv_stats[0] or 0,
                        "totalApprovals": cv_stats[2] or 0,
                        "totalRejections": cv_stats[3] or 0,
                        "totalRequired": cv_stats[1] or 0
                    },
                    "demands": demands,
                    "timeSeries": time_series
                }
                
                print(f"Dashboard result: {result}")
                return result
                
    except Exception as e:
        print(f"Dashboard API Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch complete dashboard data: {e}")


@router.post("/user/{user_id}/settings")
def save_settings(user_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    _ensure_tables()
    path = (payload.get("cv_folder_path") or "").strip()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO tbl_user_settings (user_id, cv_folder_path, updated_at)
                    VALUES (%s, %s, NOW())
                    ON CONFLICT (user_id) DO UPDATE SET cv_folder_path=EXCLUDED.cv_folder_path, updated_at=NOW()
                    """,
                    (user_id, path or None),
                )
                conn.commit()
        # Restart listener if running
        if path:
            _start_listener(user_id, path)
        return {"message": "Settings saved", "cv_folder_path": path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {e}")


@router.post("/user/{user_id}/reset-password")
def reset_recruiter_password(user_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    # Simple direct set; expect { new_password }
    new_password = (payload.get("new_password") or "").strip()
    if not new_password:
        raise HTTPException(status_code=400, detail="new_password is required")
    # Reuse hashing from login module
    try:
        from .login import _hash_password
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE tbl_users SET password_hash=%s WHERE id=%s", (_hash_password(new_password), user_id))
                conn.commit()
        return {"message": "Password reset"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset password: {e}")


# -----------------------------
# Alias endpoints per requirement
# -----------------------------

@router.post("/activity/start")
def activity_start(payload: Dict[str, Any]) -> Dict[str, Any]:
    recruiter_id = int(payload.get("recruiter_id") or 0)
    demand_id = int(payload.get("demand_id") or 0)
    if not recruiter_id or not demand_id:
        raise HTTPException(status_code=400, detail="recruiter_id and demand_id are required")
    return open_demand(recruiter_id, demand_id)


@router.post("/activity/close")
def activity_close(payload: Dict[str, Any]) -> Dict[str, Any]:
    recruiter_id = int(payload.get("recruiter_id") or 0)
    demand_id = int(payload.get("demand_id") or 0)
    if not recruiter_id or not demand_id:
        raise HTTPException(status_code=400, detail="recruiter_id and demand_id are required")
    return close_demand(recruiter_id, demand_id)


@router.post("/activity/update_cv")
def activity_update_cv(payload: Dict[str, Any]) -> Dict[str, Any]:
    recruiter_id = int(payload.get("recruiter_id") or 0)
    demand_id = int(payload.get("demand_id") or 0)
    filename = (payload.get("filename") or payload.get("file_name") or "").strip()
    file_path = (payload.get("file_path") or payload.get("path") or "").strip() or None
    timestamp = (payload.get("timestamp") or payload.get("time") or "").strip()
    if not recruiter_id or not demand_id or not filename:
        raise HTTPException(status_code=400, detail="recruiter_id, demand_id and filename are required")
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, cv_list FROM tbl_recruiter_activity WHERE recruiter_id=%s AND demand_id=%s AND activity_status='processing' ORDER BY id DESC LIMIT 1",
                    (recruiter_id, demand_id),
                )
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="No active activity found")
                activity_id, cv_list = row
                try:
                    current = cv_list if isinstance(cv_list, list) else json.loads(cv_list or "[]")
                except Exception:
                    current = []
                entry = {"file": filename, "time": timestamp or None}
                if file_path:
                    entry["path"] = file_path
                # Add recruiter_date field for date filtering (use current date if timestamp not provided)
                if timestamp:
                    try:
                        # Try to extract date from timestamp
                        from datetime import datetime
                        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                        entry["recruiter_date"] = dt.date().isoformat()
                    except:
                        # Fallback to current date
                        from datetime import date
                        entry["recruiter_date"] = date.today().isoformat()
                else:
                    from datetime import date
                    entry["recruiter_date"] = date.today().isoformat()
                current.append(entry)
                cur.execute(
                    "UPDATE tbl_recruiter_activity SET cv_list = %s::jsonb, updated_at = NOW() WHERE id=%s",
                    (json.dumps(current), activity_id),
                )
                # Note: CV count is now managed by update-cv-count-and-check endpoint
                # _sync_uploaded_cv_count_across_demand(demand_id, cur)
                # audit downloaded/uploaded
                event_type = (payload.get("event_type") or "downloaded").strip()
                if event_type == "uploaded":
                    event_type = "upload_manual"
                cur.execute(
                    "INSERT INTO tbl_audit_trail (event_type, recruiter_id, demand_id, file_name, file_path, details) VALUES (%s, %s, %s, %s, %s, %s::jsonb)",
                    (event_type, recruiter_id, demand_id, filename, file_path, json.dumps({"time": timestamp or None}))
                )
                conn.commit()
        return {"message": "CV list updated", "filename": filename}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update cv list: {e}")


# New: Update entire cv_list payload (to match frontend save call)
@router.post("/activity/update_cv_list")
def activity_update_cv_list(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Replace activity cv_list with provided array for a recruiter/activity.
    Expected payload: { recruiter_id, activity_id, cv_list: [] }
    """
    recruiter_id = int(payload.get("recruiter_id") or 0)
    activity_id = int(payload.get("activity_id") or 0)
    cv_list = payload.get("cv_list") or []
    if not recruiter_id or not activity_id or not isinstance(cv_list, list):
        raise HTTPException(status_code=400, detail="recruiter_id, activity_id and cv_list[] are required")
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Ensure activity exists and belongs to recruiter, get demand_id
                cur.execute(
                    "SELECT id, demand_id FROM tbl_recruiter_activity WHERE id=%s AND recruiter_id=%s",
                    (activity_id, recruiter_id)
                )
                result = cur.fetchone()
                if result is None:
                    raise HTTPException(status_code=404, detail="Activity not found")
                _, demand_id = result
                # Ensure all CV entries have recruiter_date field
                from datetime import date
                updated_cv_list = []
                for cv_entry in cv_list:
                    if isinstance(cv_entry, dict):
                        # If recruiter_date doesn't exist, add it (set when recruiter uploads profile)
                        if 'recruiter_date' not in cv_entry or not cv_entry.get('recruiter_date'):
                            # Try to extract from timestamp if available
                            timestamp = cv_entry.get('time') or cv_entry.get('timestamp')
                            if timestamp:
                                try:
                                    from datetime import datetime
                                    dt = datetime.fromisoformat(str(timestamp).replace('Z', '+00:00'))
                                    cv_entry['recruiter_date'] = dt.date().isoformat()
                                except:
                                    cv_entry['recruiter_date'] = date.today().isoformat()
                            else:
                                cv_entry['recruiter_date'] = date.today().isoformat()
                        updated_cv_list.append(cv_entry)
                    else:
                        updated_cv_list.append(cv_entry)
                
                # Ensure all CV entries have recruiter_date field
                from datetime import date
                updated_cv_list = []
                for cv_entry in cv_list:
                    if isinstance(cv_entry, dict):
                        # If recruiter_date doesn't exist, add it
                        if 'recruiter_date' not in cv_entry or not cv_entry.get('recruiter_date'):
                            # Try to extract from timestamp if available
                            timestamp = cv_entry.get('time') or cv_entry.get('timestamp')
                            if timestamp:
                                try:
                                    from datetime import datetime
                                    dt = datetime.fromisoformat(str(timestamp).replace('Z', '+00:00'))
                                    cv_entry['recruiter_date'] = dt.date().isoformat()
                                except:
                                    cv_entry['recruiter_date'] = date.today().isoformat()
                            else:
                                cv_entry['recruiter_date'] = date.today().isoformat()
                        updated_cv_list.append(cv_entry)
                    else:
                        updated_cv_list.append(cv_entry)
                
                # Persist list
                # Replace cv_list with entries that have recruiter_date
                cur.execute(
                    "UPDATE tbl_recruiter_activity SET cv_list=%s::jsonb, updated_at=NOW() WHERE id=%s",
                    (json.dumps(updated_cv_list), activity_id)
                )
                # Note: CV count is now managed by update-cv-count-and-check endpoint
                # _sync_uploaded_cv_count_across_demand(demand_id, cur)
                conn.commit()
                
        return {"message": "cv_list updated", "activity_id": int(activity_id), "cv_list": updated_cv_list}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update cv_list: {e}")


# New: Unified resumes endpoint (GET list from local folder, POST to upsert details)
@router.get("/{recruiter_id}/{demand_id}/resumes")
def list_resumes(recruiter_id: int, demand_id: int) -> Dict[str, Any]:
    """Return merged resume list from local folder and stored cv_list details."""
    _ensure_tables()
    # Base local list
    local = get_local_cv_list(recruiter_id, demand_id).get("cvList", [])  # type: ignore
    
    # Get DB status for all files to filter out submitted/rejected
    db_status_map = {}
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT filename, status, candidate_details
                    FROM tbl_cv_downloads
                    WHERE recruiter_id=%s AND demand_id=%s
                    """,
                    (recruiter_id, demand_id)
                )
                for row in cur.fetchall():
                    db_status_map[row[0]] = {
                        "status": row[1],
                        "candidate_details": row[2]
                    }
    except Exception:
        pass
    
    # Load stored details from current processing activity
    stored: List[Dict[str, Any]] = []
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT cv_list FROM tbl_recruiter_activity
                    WHERE recruiter_id=%s AND demand_id=%s AND activity_status='processing'
                    ORDER BY id DESC LIMIT 1
                    """,
                    (recruiter_id, demand_id)
                )
                row = cur.fetchone()
                if row and row[0]:
                    try:
                        stored = row[0] if isinstance(row[0], list) else json.loads(row[0] or "[]")
                    except Exception:
                        stored = []
    except Exception:
        stored = []

    # Merge by file_name (and timestamp if present)
    key = lambda item: (str(item.get("file_name") or item.get("file") or "").lower(), str(item.get("timestamp") or item.get("time") or ""))
    stored_map = {key(i): i for i in stored}
    merged: List[Dict[str, Any]] = []
    for item in local:
        filename = item.get("file_name") or item.get("file") or ""
        
        # Filter out submitted/rejected/discard CVs based on DB status
        # Only show resumes with NULL, empty, or 'hold' status
        if filename in db_status_map:
            db_status_raw = db_status_map[filename].get("status")
            if db_status_raw:
                db_status = str(db_status_raw).strip().lower()
                # Exclude submitted, rejected, discard, and numeric status '1' (submitted)
                if db_status in ["submitted", "rejected", "discard", "1"]:
                    continue  # Skip this CV
                # Only include if status is 'hold' or 'on_hold'
                if db_status not in ["hold", "on_hold", ""]:
                    continue  # Skip any other non-null, non-hold status
        
        filename = item.get("file_name") or item.get("file") or ""
        
        # Filter out submitted/rejected CVs based on DB status
        if filename in db_status_map:
            db_status = db_status_map[filename].get("status", "").lower() if db_status_map[filename].get("status") else ""
            if db_status in ["submitted", "rejected"]:
                continue  # Skip this CV
        
        k = key(item)
        if k in stored_map:
            merged_item = {**item, **stored_map[k]}
            # Normalize field names
            if "file" in merged_item and not merged_item.get("file_name"):
                merged_item["file_name"] = merged_item.pop("file")
            if "time" in merged_item and not merged_item.get("timestamp"):
                merged_item["timestamp"] = merged_item.pop("time")
            merged.append(merged_item)
        else:
            merged.append(item)
    return {"cvList": merged}


@router.post("/{recruiter_id}/{demand_id}/resumes")
def upsert_resume_details(recruiter_id: int, demand_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Upsert candidate details/status for a single resume into cv_list JSON for the active activity."""
    filename = (payload.get("file_name") or payload.get("file") or "").strip()
    time_str = payload.get("timestamp") or payload.get("time") or None
    candidate_name = (payload.get("candidate_name") or "").strip() or None
    candidate_email = (payload.get("email") or payload.get("candidate_email") or "").strip() or None
    candidate_phone = (payload.get("phone") or payload.get("candidate_phone") or "").strip() or None
    remarks = (payload.get("remarks") or "").strip() or None
    status = (payload.get("status") or "").strip() or None
    if not recruiter_id or not demand_id or not filename:
        raise HTTPException(status_code=400, detail="recruiter_id, demand_id and file_name are required")
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, cv_list FROM tbl_recruiter_activity
                    WHERE recruiter_id=%s AND demand_id=%s AND activity_status='processing'
                    ORDER BY id DESC LIMIT 1
                    """,
                    (recruiter_id, demand_id)
                )
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="No active activity found")
                activity_id, cv_list = row
                try:
                    current: List[Dict[str, Any]] = cv_list if isinstance(cv_list, list) else json.loads(cv_list or "[]")
                except Exception:
                    current = []
                # find entry by filename and time
                idx = -1
                for i, it in enumerate(current):
                    if (it.get("file") or it.get("file_name")) == filename and (not time_str or (it.get("time") or it.get("timestamp")) == time_str):
                        idx = i
                        break
                if idx == -1:
                    entry = {"file": filename, "time": time_str}
                    # Add recruiter_date when creating new entry (set when recruiter uploads profile)
                    from datetime import date
                    if time_str:
                        try:
                            from datetime import datetime
                            dt = datetime.fromisoformat(str(time_str).replace('Z', '+00:00'))
                            entry['recruiter_date'] = dt.date().isoformat()
                        except:
                            entry['recruiter_date'] = date.today().isoformat()
                    else:
                        entry['recruiter_date'] = date.today().isoformat()
                    # Add recruiter_date when creating new entry
                    from datetime import date
                    if time_str:
                        try:
                            from datetime import datetime
                            dt = datetime.fromisoformat(str(time_str).replace('Z', '+00:00'))
                            entry['recruiter_date'] = dt.date().isoformat()
                        except:
                            entry['recruiter_date'] = date.today().isoformat()
                    else:
                        entry['recruiter_date'] = date.today().isoformat()
                    current.append(entry)
                    idx = len(current) - 1
                # capture previous status (normalized) to compute submitted delta later
                prev_status_raw = current[idx].get("status")
                prev_status_norm = prev_status_raw.lower().replace(" ", "_") if isinstance(prev_status_raw, str) and prev_status_raw else None

                # update fields
                current[idx]["candidate_name"] = candidate_name
                current[idx]["candidate_email"] = candidate_email
                current[idx]["candidate_phone"] = candidate_phone
                current[idx]["remarks"] = remarks
                if status:
                    # Map UI statuses
                    normalized = status.lower().replace(" ", "_")
                    if normalized in ("shortlisted", "selected"): normalized = "selected"
                    elif normalized in ("rejected",): normalized = "rejected"
                    elif normalized in ("on_hold", "hold"): normalized = "on_hold"
                    current[idx]["status"] = normalized
                
                # Ensure recruiter_date exists (set when recruiter uploads profile)
                if 'recruiter_date' not in current[idx] or not current[idx].get('recruiter_date'):
                    from datetime import date
                    timestamp = current[idx].get('time') or current[idx].get('timestamp')
                    if timestamp:
                        try:
                            from datetime import datetime
                            dt = datetime.fromisoformat(str(timestamp).replace('Z', '+00:00'))
                            current[idx]['recruiter_date'] = dt.date().isoformat()
                        except:
                            current[idx]['recruiter_date'] = date.today().isoformat()
                    else:
                        current[idx]['recruiter_date'] = date.today().isoformat()
                
                # Ensure recruiter_date exists
                if 'recruiter_date' not in current[idx] or not current[idx].get('recruiter_date'):
                    from datetime import date
                    timestamp = current[idx].get('time') or current[idx].get('timestamp')
                    if timestamp:
                        try:
                            from datetime import datetime
                            dt = datetime.fromisoformat(str(timestamp).replace('Z', '+00:00'))
                            current[idx]['recruiter_date'] = dt.date().isoformat()
                        except:
                            current[idx]['recruiter_date'] = date.today().isoformat()
                    else:
                        current[idx]['recruiter_date'] = date.today().isoformat()
                cur.execute(
                    "UPDATE tbl_recruiter_activity SET cv_list=%s::jsonb, updated_at=NOW() WHERE id=%s",
                    (json.dumps(current), activity_id)
                )
                conn.commit()
                # Note: Count updates are handled explicitly by frontend via
                # POST /recruiter/update-cv-count-and-check when status === 'submitted'.
        return {"message": "Resume details saved", "file_name": filename}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save resume details: {e}")

@router.post("/activity/submit_selected_cvs")
def submit_selected_cvs(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Update selected CV entries with candidate fields and persist submissions."""
    recruiter_id = int(payload.get("recruiter_id") or 0)
    activity_id = int(payload.get("activity_id") or 0)
    selections = payload.get("selections") or []
    if not recruiter_id or not activity_id or not isinstance(selections, list) or not selections:
        raise HTTPException(status_code=400, detail="recruiter_id, activity_id and selections are required")

    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Load activity and demand context
                cur.execute("SELECT id, recruiter_id, demand_id, cv_list FROM tbl_recruiter_activity WHERE id=%s AND recruiter_id=%s",
                            (activity_id, recruiter_id))
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="Activity not found")
                _, rid, demand_id, cv_list = row
                try:
                    current = cv_list if isinstance(cv_list, list) else json.loads(cv_list or "[]")
                except Exception:
                    current = []

                # Ensure candidate submissions table exists per spec
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS tbl_candidate_submissions (
                      id SERIAL PRIMARY KEY,
                      demand_id INTEGER REFERENCES tbl_demand_sheet(id),
                      recruiter_id INTEGER REFERENCES users(id),
                      file_name TEXT,
                      file_time TIMESTAMP,
                      candidate_name VARCHAR(255),
                      candidate_email VARCHAR(255),
                      candidate_phone VARCHAR(50),
                      remarks TEXT,
                      verified_status VARCHAR(32) DEFAULT 'under_verification',
                      created_at TIMESTAMP DEFAULT now(),
                      updated_at TIMESTAMP DEFAULT now()
                    )
                    """
                )

                # Process selections
                for sel in selections:
                    file = (sel.get("file") or sel.get("file_name") or "").strip()
                    time_str = (sel.get("time") or sel.get("timestamp") or None)
                    candidate_name = (sel.get("candidate_name") or "").strip() or None
                    candidate_email = (sel.get("candidate_email") or "").strip() or None
                    candidate_phone = (sel.get("candidate_phone") or "").strip() or None
                    remarks = (sel.get("remarks") or "").strip() or None

                    # Update cv_list entry by matching file+time
                    for item in current:
                        if item.get("file") == file and (not time_str or item.get("time") == time_str):
                            item["candidate_name"] = candidate_name
                            item["candidate_email"] = candidate_email
                            item["candidate_phone"] = candidate_phone
                            item["remarks"] = remarks
                            item["verified_status"] = "under_verification"
                            item["demand_id"] = demand_id
                            item["recruiter_id"] = rid
                            # Ensure recruiter_date exists (set when recruiter uploads profile)
                            if 'recruiter_date' not in item or not item.get('recruiter_date'):
                                from datetime import date
                                if time_str:
                                    try:
                                        from datetime import datetime
                                        dt = datetime.fromisoformat(str(time_str).replace('Z', '+00:00'))
                                        item['recruiter_date'] = dt.date().isoformat()
                                    except:
                                        item['recruiter_date'] = date.today().isoformat()
                                else:
                                    item['recruiter_date'] = date.today().isoformat()
                            # Ensure recruiter_date exists
                            if 'recruiter_date' not in item or not item.get('recruiter_date'):
                                from datetime import date
                                if time_str:
                                    try:
                                        from datetime import datetime
                                        dt = datetime.fromisoformat(str(time_str).replace('Z', '+00:00'))
                                        item['recruiter_date'] = dt.date().isoformat()
                                    except:
                                        item['recruiter_date'] = date.today().isoformat()
                                else:
                                    item['recruiter_date'] = date.today().isoformat()
                            break

                    # Insert submission row
                    cur.execute(
                        """
                        INSERT INTO tbl_candidate_submissions (demand_id, recruiter_id, file_name, file_time, candidate_name, candidate_email, candidate_phone, remarks, verified_status)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'under_verification')
                        RETURNING id
                        """,
                        (demand_id, rid, file, time_str, candidate_name, candidate_email, candidate_phone, remarks)
                    )
                    submission_id = cur.fetchone()[0]

                    # Audit submit
                    cur.execute(
                        """
                        INSERT INTO tbl_audit_trail (event_type, recruiter_id, demand_id, file_name, details)
                        VALUES ('submit_profile', %s, %s, %s, %s::jsonb)
                        """,
                        (rid, demand_id, file, json.dumps({"submission_id": submission_id, "candidate_name": candidate_name}))
                    )

                # Persist updated cv_list
                cur.execute("UPDATE tbl_recruiter_activity SET cv_list=%s::jsonb, updated_at=NOW() WHERE id=%s",
                            (json.dumps(current), activity_id))
                # Note: CV count is now managed by update-cv-count-and-check endpoint
                # _sync_uploaded_cv_count_across_demand(demand_id, cur)
                conn.commit()

                return {"message": "Selections submitted", "activity_id": activity_id, "cv_list": current}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit selected CVs: {e}")


@router.get("/settings")
def get_settings(recruiter_id: int) -> Dict[str, Any]:
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT cv_download_path, folder_locked FROM tbl_recruiter_settings WHERE recruiter_id=%s", (recruiter_id,))
                row = cur.fetchone()
                return {"recruiter_id": recruiter_id, "cv_download_path": row[0] if row else None, "folder_locked": row[1] if row else False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get settings: {e}")


@router.post("/settings")
def update_settings(payload: Dict[str, Any]) -> Dict[str, Any]:
    recruiter_id = int(payload.get("recruiter_id") or 0)
    cv_download_path = (payload.get("cv_download_path") or "").strip() or None
    if not recruiter_id:
        raise HTTPException(status_code=400, detail="recruiter_id is required")
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Create default if none provided
                if not cv_download_path:
                    cv_download_path = f"/data/cv_downloads/{recruiter_id}"
                os.makedirs(cv_download_path, exist_ok=True)
                cur.execute(
                    """
                    INSERT INTO tbl_recruiter_settings (recruiter_id, cv_download_path, updated_at)
                    VALUES (%s, %s, NOW())
                    ON CONFLICT (recruiter_id) DO UPDATE SET cv_download_path=EXCLUDED.cv_download_path, updated_at=NOW()
                    """,
                    (recruiter_id, cv_download_path),
                )
                conn.commit()
        return {"message": "Settings saved", "cv_download_path": cv_download_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {e}")


@router.post("/upload-cv")
def upload_cv(
    file: UploadFile = File(...),
    demand_id: int = Form(...),
    recruiter_id: int = Form(...)
) -> Dict[str, Any]:
    """Upload CV file for a demand"""
    
    _ensure_tables()
    try:
        # Create upload directory structure
        import os
        # Get the correct path to cv_uploads directory
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        upload_dir = os.path.join(project_root, "src", "assets", "cv_uploads", str(recruiter_id), str(demand_id))
        os.makedirs(upload_dir, exist_ok=True)
        
        # Save file
        file_path = os.path.join(upload_dir, file.filename)
        with open(file_path, "wb") as buffer:
            content = file.file.read()
            buffer.write(content)
        
        # Store in database
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO tbl_cv_uploads (recruiter_id, demand_id, filename, file_path, uploaded_at)
                    VALUES (%s, %s, %s, %s, NOW())
                    RETURNING id
                    """,
                    (recruiter_id, demand_id, file.filename, file_path)
                )
                cv_id = cur.fetchone()[0]
                
                # Update the cv_list in recruiter activity and sync count
                cur.execute(
                    "SELECT id, cv_list FROM tbl_recruiter_activity WHERE recruiter_id=%s AND demand_id=%s AND activity_status='processing' ORDER BY id DESC LIMIT 1",
                    (recruiter_id, demand_id),
                )
                row = cur.fetchone()
                if row:
                    activity_id, cv_list = row
                    try:
                        current = cv_list if isinstance(cv_list, list) else json.loads(cv_list or "[]")
                    except Exception:
                        current = []
                    from datetime import date
                    from datetime import date
                    entry = {"file": file.filename, "time": datetime.now().isoformat()}
                    entry["recruiter_date"] = date.today().isoformat()  # Add recruiter_date when recruiter uploads profile
                    entry["recruiter_date"] = date.today().isoformat()  # Add recruiter_date for date filtering
                    current.append(entry)
                    cur.execute(
                        "UPDATE tbl_recruiter_activity SET cv_list = %s::jsonb, updated_at = NOW() WHERE id=%s",
                        (json.dumps(current), activity_id),
                    )
                    # Note: CV count is now managed by update-cv-count-and-check endpoint
                    # _sync_uploaded_cv_count_across_demand(demand_id, cur)
                
                conn.commit()
        
        # Audit uploaded
        try:
            with psycopg.connect(DATABASE_DSN) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO tbl_audit_trail (event_type, recruiter_id, demand_id, file_name, details) VALUES ('uploaded', %s, %s, %s, %s::jsonb)",
                        (recruiter_id, demand_id, file.filename, json.dumps({"path": file_path}))
                    )
                    conn.commit()
        except Exception:
            pass
        return {"message": "CV uploaded successfully", "id": cv_id, "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload CV: {e}")


# New unified endpoints as requested
@router.post("/upload-resume")
def upload_resume(
    file: UploadFile = File(...),
    demand_id: int = Form(...),
    recruiter_id: int = Form(...)
) -> Dict[str, Any]:
    """Upload resume to src/assets/cv_uploads/<recruiter_id>/<demand_id> and insert into tbl_cv_downloads."""
    _ensure_tables()
    try:
        # Get the correct path to cv_uploads directory
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        base_dir = os.path.join(project_root, "src", "assets", "cv_uploads", str(recruiter_id), str(demand_id))
        os.makedirs(base_dir, exist_ok=True)
        file_path = os.path.join(base_dir, file.filename)
        # Write file content
        content = file.file.read()
        with open(file_path, "wb") as out:
            out.write(content)

        normalized_path = file_path.replace('\\', '/')

        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO tbl_cv_downloads (recruiter_id, demand_id, filename, file_path)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id, created_at
                    """,
                    (recruiter_id, demand_id, file.filename, normalized_path),
                )
                row = cur.fetchone()
                conn.commit()
        created_at_val = row[1].isoformat() if row and row[1] else None
        return {"message": "Resume uploaded", "id": int(row[0]), "created_at": created_at_val, "filename": file.filename, "file_path": normalized_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload resume: {e}")


@router.post("/upload_resume/{recruiter_id}/{demand_id}")
def upload_resume_path(
    recruiter_id: int,
    demand_id: int,
    file: UploadFile = File(...),
) -> Dict[str, Any]:
    """Spec-compliant upload endpoint with path params and extension guard.
    Saves into src/assets/cv_uploads/<recruiter_id>/<demand_id> and upserts into tbl_cv_downloads.
    """
    _ensure_tables()
    try:
        name_lower = (file.filename or "").lower()
        if not (name_lower.endswith(".pdf") or name_lower.endswith(".docx")):
            return {"success": False, "message": "Only .pdf and .docx files are allowed"}

        # Get the correct path to cv_uploads directory
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        base_dir = os.path.join(project_root, "src", "assets", "cv_uploads", str(recruiter_id), str(demand_id))
        os.makedirs(base_dir, exist_ok=True)
        file_path = os.path.join(base_dir, file.filename)

        # Overwrite if exists
        content = file.file.read()
        with open(file_path, "wb") as out:
            out.write(content)

        normalized_path = file_path.replace('\\', '/')

        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Try update existing record by unique tuple (recruiter_id, demand_id, filename)
                cur.execute(
                    """
                    UPDATE tbl_cv_downloads
                    SET file_path=%s, created_at=NOW()
                    WHERE recruiter_id=%s AND demand_id=%s AND filename=%s
                    RETURNING id
                    """,
                    (normalized_path, recruiter_id, demand_id, file.filename),
                )
                row = cur.fetchone()
                if row is None:
                    cur.execute(
                        """
                        INSERT INTO tbl_cv_downloads (recruiter_id, demand_id, filename, file_path)
                        VALUES (%s, %s, %s, %s)
                        RETURNING id
                        """,
                        (recruiter_id, demand_id, file.filename, normalized_path),
                    )
                    row = cur.fetchone()
                conn.commit()

        return {"success": True, "message": "Resume uploaded successfully", "id": int(row[0]), "filename": file.filename, "file_path": normalized_path}
    except Exception as e:
        # Log and return friendly error
        print(f"Upload error: {e}")
        return {"success": False, "message": "File save failed"}


@router.get("/resumes/{recruiter_id}/{demand_id}")
def fetch_all_resumes(recruiter_id: int, demand_id: int) -> Dict[str, Any]:
    """Return all resumes from tbl_cv_downloads for recruiter and demand, latest first.
    Only returns resumes with NULL status or 'hold' status. Excludes 'submitted' and 'rejected'."""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, recruiter_id, demand_id, filename, file_path, created_at, status, candidate_details
                    FROM tbl_cv_downloads
                    WHERE recruiter_id=%s AND demand_id=%s
                    AND (
                        status IS NULL 
                        OR status = '' 
                        OR LOWER(TRIM(COALESCE(status, ''))) = 'hold' 
                        OR LOWER(TRIM(COALESCE(status, ''))) = 'on_hold'
                    )
                    AND COALESCE(LOWER(TRIM(status)), '') NOT IN ('submitted', 'rejected', 'discard', '1')
                    AND (status IS NULL OR LOWER(status) = 'hold')
                    AND (status IS NULL OR LOWER(status) NOT IN ('submitted', 'rejected'))
                    ORDER BY created_at DESC NULLS LAST, id DESC
                    """,
                    (recruiter_id, demand_id),
                )
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description]
                items = _rows_to_dicts(cols, rows)
        return {"success": True, "items": items}
    except Exception as e:
        print(f"Fetch resumes error: {e}")
        return {"success": False, "message": "Failed to fetch resumes"}


@router.put("/update_resume_status/{cv_id}")
def update_resume_status(cv_id: int, payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Update tbl_cv_downloads.status and candidate_details; append to recruiter_activity.cv_list if Submitted."""
    _ensure_tables()
    try:
        candidate_name = (payload.get("candidate_name") or "").strip() or None
        email = (payload.get("email") or "").strip() or None
        phone = (payload.get("phone") or "").strip() or None
        remarks = (payload.get("remarks") or "").strip() or None
        status_in = (payload.get("status") or "").strip()

        # Normalize status to spec Titlecase mapping to internal lowercase if needed later
        status_map = {
            "Submitted": "submitted",
            "Hold": "hold",
            "Discard": "rejected",
        }
        normalized = status_map.get(status_in, status_in.lower()) if status_in else None

        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Load the row context
                cur.execute(
                    "SELECT recruiter_id, demand_id, filename, file_path FROM tbl_cv_downloads WHERE id=%s",
                    (cv_id,),
                )
                row = cur.fetchone()
                if not row:
                    return {"success": False, "message": "Resume not found"}
                recruiter_id, demand_id, filename, file_path = int(row[0]), int(row[1]), str(row[2]), str(row[3])

                details_obj = {
                    "candidate_id": None,
                    "candidate_name": candidate_name,
                    "email": email,
                    "phone": phone,
                    "remarks": remarks,
                    "status": normalized or None,
                }

                cur.execute(
                    """
                    UPDATE tbl_cv_downloads
                    SET status=%s, candidate_details=%s::jsonb
                    WHERE id=%s
                    """,
                    (normalized, json.dumps(details_obj), cv_id),
                )
                if cur.rowcount != 1:
                    conn.rollback()
                    return {"success": False, "message": "Failed to update resume (not found or unchanged)"}

                # If Submitted, also append to tbl_recruiter_activity.cv_list
                if normalized == "submitted":
                    cur.execute(
                        """
                        SELECT id, cv_list FROM tbl_recruiter_activity
                        WHERE recruiter_id=%s AND demand_id=%s AND activity_status='processing'
                        ORDER BY id DESC LIMIT 1
                        """,
                        (recruiter_id, demand_id),
                    )
                    act = cur.fetchone()
                    if act:
                        activity_id, cv_list = act
                        try:
                            current = cv_list if isinstance(cv_list, list) else json.loads(cv_list or "[]")
                        except Exception:
                            current = []

                        # Determine next candidate_id
                        max_id = 0
                        for it in current:
                            cid = it.get("candidate_id") or it.get("candidate", {}).get("candidate_id")
                            try:
                                if cid is not None:
                                    max_id = max(max_id, int(cid))
                            except Exception:
                                pass
                        next_id = max_id + 1

                        from datetime import date
                        new_entry = {
                            "candidate_id": next_id,
                            "candidate_name": candidate_name,
                            "email": email,
                            "phone": phone,
                            "remarks": remarks,
                            "filename": filename,
                            "file_path": file_path,
                            "status": 0,
                            "recruiter_date": date.today().isoformat(),  # Add recruiter_date when recruiter uploads profile
                            "recruiter_date": date.today().isoformat(),  # Add recruiter_date for date filtering
                        }

                        # Push into flat list per spec
                        current.append(new_entry)
                        cur.execute(
                            "UPDATE tbl_recruiter_activity SET cv_list=%s::jsonb, updated_at=NOW() WHERE id=%s",
                            (json.dumps(current), activity_id),
                        )
                        # Note: CV count is now managed by update-cv-count-and-check endpoint
                        # _sync_uploaded_cv_count_across_demand(demand_id, cur)

                conn.commit()
        return {"success": True, "message": "Resume status updated"}
    except Exception as e:
        print(f"Update status error: {e}")
        return {"success": False, "message": "Failed to update resume status"}

@router.post("/update-candidate")
def update_candidate(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Update tbl_cv_downloads status and candidate_details JSON; append to tbl_recruiter_activity.cv_list when submitted."""
    recruiter_id = int(payload.get("recruiter_id") or 0)
    demand_id = int(payload.get("demand_id") or 0)
    filename = (payload.get("filename") or payload.get("file_name") or "").strip()
    email = (payload.get("email") or payload.get("candidate_email") or "").strip() or None
    phone = (payload.get("phone") or payload.get("candidate_phone") or "").strip() or None
    candidate_name = (payload.get("candidate_name") or "").strip() or None
    status_in = (payload.get("status") or "").strip().lower() or None
    if not recruiter_id or not demand_id or not filename:
        raise HTTPException(status_code=400, detail="recruiter_id, demand_id, filename are required")

    # Map UI statuses
    status_map = {
        "discard": "rejected",
        "rejected": "rejected",
        "hold": "hold",
        "on_hold": "hold",
        "submitted": "submitted",
    }
    normalized_status = status_map.get(status_in or "", status_in) if status_in else None

    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Update tbl_cv_downloads
                details_obj = {
                    "candidate_id": None,  # can be filled later by sequence if needed
                    "candidate_name": candidate_name,
                    "email": email,
                    "phone": phone,
                    "status": normalized_status,
                }
                cur.execute(
                    """
                    UPDATE tbl_cv_downloads
                    SET status = %s, candidate_details = %s::jsonb
                    WHERE recruiter_id=%s AND demand_id=%s AND filename=%s
                    RETURNING id
                    """,
                    (normalized_status, json.dumps(details_obj), recruiter_id, demand_id, filename),
                )
                row = cur.fetchone()
                if row is None:
                    # File record should exist from when file was opened. If not found, return error.
                    conn.rollback()
                    raise HTTPException(status_code=404, detail=f"CV file '{filename}' not found for this demand. Please refresh and try again.")

                # Update tbl_recruiter_activity.cv_list
                cur.execute(
                    """
                    SELECT id, cv_list FROM tbl_recruiter_activity
                    WHERE recruiter_id=%s AND demand_id=%s AND activity_status='processing'
                    ORDER BY id DESC LIMIT 1
                    """,
                    (recruiter_id, demand_id),
                )
                act = cur.fetchone()
                if act:
                    activity_id, cv_list = act
                    try:
                        current: List[Dict[str, Any]] = cv_list if isinstance(cv_list, list) else json.loads(cv_list or "[]")
                    except Exception:
                        current = []
                    # Upsert entry by filename
                    idx = next((i for i, it in enumerate(current) if (it.get("file") or it.get("file_name")) == filename), -1)
                    candidate_json = {
                        "candidate_id": None,
                        "candidate_name": candidate_name,
                        "email": email,
                        "phone": phone,
                        "status": normalized_status,
                    }
                    from datetime import date
                    if idx == -1:
                        new_entry = {"file": filename, "candidate": candidate_json}
                        new_entry["recruiter_date"] = date.today().isoformat()  # Add recruiter_date when recruiter uploads profile
                        current.append(new_entry)
                    else:
                        current[idx]["candidate"] = candidate_json
                        # Ensure recruiter_date exists when updating (set to current date if missing)
                        if 'recruiter_date' not in current[idx] or not current[idx].get('recruiter_date'):
                            current[idx]["recruiter_date"] = date.today().isoformat()
                        # Ensure recruiter_date exists when updating
                        if 'recruiter_date' not in current[idx] or not current[idx].get('recruiter_date'):
                            current[idx]["recruiter_date"] = date.today().isoformat()

                    # Only append to activity list if status is submitted
                    if normalized_status == "submitted":
                        # Ensure it's represented clearly in list for submissions
                        pass

                    cur.execute(
                        "UPDATE tbl_recruiter_activity SET cv_list=%s::jsonb, updated_at=NOW() WHERE id=%s",
                        (json.dumps(current), activity_id),
                    )
                    # Note: CV count is now managed by update-cv-count-and-check endpoint
                    # _sync_uploaded_cv_count_across_demand(demand_id, cur)
                conn.commit()
        return {"message": "Candidate updated", "id": int(row[0])}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update candidate: {e}")


@router.get("/{recruiter_id}/{demand_id}/resumes-db")
def list_resumes_db(recruiter_id: int, demand_id: int) -> List[Dict[str, Any]]:
    """List resumes from tbl_cv_downloads for given recruiter and demand.
    Only returns resumes with NULL status or 'hold' status. Excludes 'submitted' and 'rejected'."""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, filename, file_path, created_at, status, candidate_details
                    FROM tbl_cv_downloads
                    WHERE recruiter_id=%s AND demand_id=%s
                    AND (
                        status IS NULL 
                        OR status = '' 
                        OR LOWER(TRIM(COALESCE(status, ''))) = 'hold' 
                        OR LOWER(TRIM(COALESCE(status, ''))) = 'on_hold'
                    )
                    AND COALESCE(LOWER(TRIM(status)), '') NOT IN ('submitted', 'rejected', 'discard', '1')
                    AND (status IS NULL OR LOWER(status) = 'hold')
                    AND (status IS NULL OR LOWER(status) NOT IN ('submitted', 'rejected'))
                    ORDER BY created_at DESC
                    """,
                    (recruiter_id, demand_id),
                )
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description]
                items = _rows_to_dicts(cols, rows)
                return items
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list resumes: {e}")


@router.get("/file/{recruiter_id}/{demand_id}/{filename:path}")
def serve_resume_file(recruiter_id: int, demand_id: int, filename: str):
    """Stream a resume file from known asset roots so the frontend can iframe it reliably during dev.
    Checks both src/assets and backend/src/assets locations.
    """
    try:
        # Get the correct path to cv_uploads directory
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        candidate_paths = [
            os.path.join(project_root, "src", "assets", "cv_uploads", str(recruiter_id), str(demand_id), filename),
            os.path.join("src", "assets", "cv_uploads", str(recruiter_id), str(demand_id), filename),
            os.path.join("backend", "src", "assets", "cv_uploads", str(recruiter_id), str(demand_id), filename),
        ]
        for p in candidate_paths:
            if os.path.isfile(p):
                lower = p.lower()
                media = None
                if lower.endswith('.pdf'):
                    media = 'application/pdf'
                elif lower.endswith('.docx'):
                    media = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                headers = {"Content-Disposition": "inline"}
                # Upsert a row into tbl_cv_downloads when a file is opened, so UI lists always reflect openings
                try:
                    normalized_path = p.replace('\\', '/')
                    with psycopg.connect(DATABASE_DSN) as conn:
                        with conn.cursor() as cur:
                            cur.execute(
                                """
                                INSERT INTO tbl_cv_downloads (recruiter_id, demand_id, filename, file_path)
                                VALUES (%s, %s, %s, %s)
                                ON CONFLICT DO NOTHING
                                """,
                                (recruiter_id, demand_id, os.path.basename(p), normalized_path)
                            )
                        conn.commit()
                except Exception:
                    # Non-fatal; still serve the file
                    pass
                return FileResponse(p, media_type=media, headers=headers)
        raise HTTPException(status_code=404, detail="File not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {e}")

@router.get("/{recruiter_id}/demand/{demand_id}/cvs")
def get_demand_cvs(recruiter_id: int, demand_id: int) -> List[Dict[str, Any]]:
    """Get CVs uploaded for a specific demand"""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, filename, file_path, uploaded_at
                    FROM tbl_cv_uploads
                    WHERE recruiter_id = %s AND demand_id = %s
                    ORDER BY uploaded_at DESC
                    """,
                    (recruiter_id, demand_id)
                )
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description]
                return _rows_to_dicts(cols, rows)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch CVs: {e}")


# New: List local CV files under recruiter_files/demand/<recruiter_id>/<demand_id>
@router.get("/{recruiter_id}/{demand_id}/cv-list")
def get_local_cv_list(recruiter_id: int, demand_id: int) -> Dict[str, Any]:
    """Return list of PDF/DOC/DOCX files from local directory for the recruiter/demand.
    Primary path: <cv_download_path or recruiter_files>/demand/<recruiter_id>/<demand_id>/
    Fallback path: <project_root>/src/assets/cv_uploads/<recruiter_id>/<demand_id>/
    """
    import os
    try:
        # Prefer recruiter-specific configured folder
        folder_path: Optional[str] = None
        try:
            with psycopg.connect(DATABASE_DSN) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT cv_download_path FROM tbl_recruiter_settings WHERE recruiter_id=%s", (recruiter_id,))
                    row = cur.fetchone()
                    folder_path = row[0] if row else None
        except Exception:
            folder_path = None

        if folder_path:
            base_dir = folder_path
        else:
            base_dir = os.getenv("RECRUITER_FILES_BASE", "recruiter_files")
        target_dir = os.path.join(base_dir, "demand", str(recruiter_id), str(demand_id))
        if not os.path.isdir(target_dir):
            # Fallback to src/assets/cv_uploads/<rid>/<did>
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            alt_dir = os.path.join(project_root, "src", "assets", "cv_uploads", str(recruiter_id), str(demand_id))
            if os.path.isdir(alt_dir):
                target_dir = alt_dir
            else:
                # Return folderPath for UI display even if empty
                return {"cvList": [], "folderPath": base_dir, "message": "[WARN] No resumes found for this demand."}

        items: List[Dict[str, Any]] = []
        allowed_exts = (".pdf", ".docx", ".doc")
        for name in sorted(os.listdir(target_dir)):
            lower = name.lower()
            if not any(lower.endswith(ext) for ext in allowed_exts):
                continue
            file_path = os.path.join(target_dir, name)
            try:
                stat = os.stat(file_path)
                created_iso = datetime.fromtimestamp(stat.st_mtime).isoformat()
            except Exception:
                created_iso = None
            # default status Under Verification unless enriched later (client merges stored cv_list)
            items.append({
                "filename": name,
                "path": file_path.replace("\\", "/"),
                "created_at": created_iso,
                "status": "Under Verification"
            })
        # Upsert discovered files into tbl_cv_downloads so UI can strictly read from DB if needed
        try:
            with psycopg.connect(DATABASE_DSN) as conn:
                with conn.cursor() as cur:
                    for it in items:
                        cur.execute(
                            """
                            INSERT INTO tbl_cv_downloads (recruiter_id, demand_id, filename, file_path)
                            VALUES (%s, %s, %s, %s)
                            ON CONFLICT DO NOTHING
                            """,
                            (recruiter_id, demand_id, it["filename"], it["path"]) 
                        )
                conn.commit()
        except Exception:
            # non-fatal: listing should still work even if DB upsert fails
            pass
        return {"cvList": items, "folderPath": base_dir}
    except Exception as e:
        # Graceful error message for UI
        raise HTTPException(status_code=500, detail=f"Unable to read resume folder: {str(e)}")


@router.get("/audit/recruiter/{recruiter_id}")
def get_audit_events(recruiter_id: int, demand_id: Optional[int] = None, limit: int = 25) -> Dict[str, Any]:
    """Get recent audit events for a recruiter, optionally filtered by demand"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                if demand_id:
                    cur.execute(
                        """
                        SELECT id, event_type, recruiter_id, demand_id, file_name, details, created_at
                        FROM tbl_audit_trail
                        WHERE recruiter_id = %s AND demand_id = %s
                        ORDER BY created_at DESC
                        LIMIT %s
                        """,
                        (recruiter_id, demand_id, limit)
                    )
                else:
                    cur.execute(
                        """
                        SELECT id, event_type, recruiter_id, demand_id, file_name, details, created_at
                        FROM tbl_audit_trail
                        WHERE recruiter_id = %s
                        ORDER BY created_at DESC
                        LIMIT %s
                        """,
                        (recruiter_id, limit)
                    )
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description]
                return {"items": [dict(zip(cols, r)) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch audit events: {e}")


@router.get("/{recruiter_id}/submissions")
def get_recruiter_submissions(recruiter_id: int, page: int = 1, size: int = 10) -> Dict[str, Any]:
    """Get all submissions by a recruiter"""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Count total
                cur.execute(
                    "SELECT COUNT(*) FROM tbl_recruiter_submissions WHERE recruiter_id = %s",
                    (recruiter_id,)
                )
                total = int(cur.fetchone()[0])
                
                # Get submissions with demand info
                cur.execute(
                    """
                    SELECT 
                        rs.id, rs.recruiter_id, rs.demand_id, rs.candidate_name, 
                        rs.candidate_email, rs.candidate_phone, rs.notes, 
                        rs.cv_ids, rs.status, rs.submitted_at, rs.created_at,
                        ds.skill as job_title, c.client_name
                    FROM tbl_recruiter_submissions rs
                    LEFT JOIN tbl_demand_sheet ds ON rs.demand_id = ds.id
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    WHERE rs.recruiter_id = %s
                    ORDER BY rs.submitted_at DESC
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
        raise HTTPException(status_code=500, detail=f"Failed to fetch submissions: {e}")


@router.get("/{recruiter_id}/submission-stats")
def get_recruiter_submission_stats(recruiter_id: int) -> Dict[str, int]:
    """Return submission counts for the recruiter: today, this_week, total."""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Total submissions
                cur.execute(
                    "SELECT COUNT(*) FROM tbl_recruiter_submissions WHERE recruiter_id = %s",
                    (recruiter_id,)
                )
                total = int(cur.fetchone()[0])

                # Today's submissions
                cur.execute(
                    """
                    SELECT COUNT(*) 
                    FROM tbl_recruiter_submissions 
                    WHERE recruiter_id = %s AND DATE(submitted_at) = CURRENT_DATE
                    """,
                    (recruiter_id,)
                )
                today = int(cur.fetchone()[0])

                # This week's submissions (ISO week)
                cur.execute(
                    """
                    SELECT COUNT(*)
                    FROM tbl_recruiter_submissions
                    WHERE recruiter_id = %s
                    AND DATE_TRUNC('week', submitted_at) = DATE_TRUNC('week', CURRENT_DATE::timestamp)
                    """,
                    (recruiter_id,)
                )
                this_week = int(cur.fetchone()[0])

                return {"today": today, "this_week": this_week, "total": total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch submission stats: {e}")


@router.get("/submissions/all")
def get_all_submissions(page: int = 1, size: int = 10, status: Optional[str] = None) -> Dict[str, Any]:
    """Get all submissions (for TL/Manager/SuperAdmin)"""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Build where clause
                where_clause = ""
                params = []
                if status:
                    where_clause = "WHERE rs.status = %s"
                    params.append(status)
                
                # Count total
                cur.execute(f"""
                    SELECT COUNT(*) FROM tbl_recruiter_submissions rs
                    LEFT JOIN tbl_demand_sheet ds ON rs.demand_id = ds.id
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    {where_clause}
                """, params)
                total = int(cur.fetchone()[0])
                
                # Get submissions with demand info
                cur.execute(f"""
                    SELECT 
                        rs.id, rs.recruiter_id, rs.demand_id, rs.candidate_name, 
                        rs.candidate_email, rs.candidate_phone, rs.notes, 
                        rs.cv_ids, rs.status, rs.submitted_at, rs.created_at,
                        ds.skill as job_title, c.client_name,
                        u.display_name as recruiter_name
                    FROM tbl_recruiter_submissions rs
                    LEFT JOIN tbl_demand_sheet ds ON rs.demand_id = ds.id
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    LEFT JOIN tbl_users u ON rs.recruiter_id = u.id
                    {where_clause}
                    ORDER BY rs.submitted_at DESC
                    LIMIT %s OFFSET %s
                """, params + [size, (page - 1) * size])
                
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
        raise HTTPException(status_code=500, detail=f"Failed to fetch submissions: {e}")

@router.patch("/submission/{submission_id}/status")
def update_submission_status(submission_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Update submission status (for TL/Manager validation)"""
    _ensure_tables()
    try:
        new_status = payload.get("status")
        if not new_status:
            raise HTTPException(status_code=400, detail="status is required")
        
        valid_statuses = ["submitted", "under_verification", "rejected", "selected"]
        if new_status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Update submission status
                cur.execute("""
                    UPDATE tbl_recruiter_submissions 
                    SET status = %s, updated_at = NOW()
                    WHERE id = %s
                    RETURNING id
                """, (new_status, submission_id))
                
                if cur.fetchone() is None:
                    raise HTTPException(status_code=404, detail="Submission not found")
                
                # If status is "selected", create interview record
                if new_status == "selected":
                    cur.execute("""
                        SELECT recruiter_id, demand_id, candidate_name, candidate_email
                        FROM tbl_recruiter_submissions 
                        WHERE id = %s
                    """, (submission_id,))
                    
                    submission_data = cur.fetchone()
                    if submission_data:
                        recruiter_id, demand_id, candidate_name, candidate_email = submission_data
                        
                        # Create interview record
                        cur.execute("""
                            INSERT INTO tbl_interviews 
                            (submission_id, recruiter_id, interview_date, mode, status)
                            VALUES (%s, %s, NOW() + INTERVAL '7 days', 'online', 'scheduled')
                            RETURNING id
                        """, (submission_id, recruiter_id))
                        
                        interview_id = cur.fetchone()[0]
                        print(f"Created interview {interview_id} for submission {submission_id}")
                
                conn.commit()
                
                return {
                    "message": "Submission status updated successfully",
                    "submission_id": submission_id,
                    "status": new_status
                }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update submission status: {e}")

@router.post("/submission/submit")
def submit_profile(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Submit candidate profile for a demand"""
    _ensure_tables()
    try:
        print(f"Submission Debug - Received payload: {payload}")
        
        # Validate required fields
        recruiter_id = payload.get("recruiter_id")
        demand_id = payload.get("demandId")
        candidate_name = payload.get("candidateName")
        candidate_email = payload.get("email")
        
        if not recruiter_id:
            raise HTTPException(status_code=400, detail="recruiter_id is required")
        if not demand_id:
            raise HTTPException(status_code=400, detail="demandId is required")
        if not candidate_name:
            raise HTTPException(status_code=400, detail="candidateName is required")
        if not candidate_email:
            raise HTTPException(status_code=400, detail="email is required")
        
        print(f"Submission Debug - Validated data: recruiter_id={recruiter_id}, demand_id={demand_id}, candidate_name={candidate_name}, email={candidate_email}")
        
        # Ensure submissions table exists
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
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
                      submitted_at TIMESTAMPTZ DEFAULT NOW(),
                      created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                    """
                )
                
                # Insert submission
                cur.execute(
                    """
                    INSERT INTO tbl_recruiter_submissions 
                    (recruiter_id, demand_id, candidate_name, candidate_email, candidate_phone, notes, cv_ids)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        int(recruiter_id),
                        int(demand_id),
                        str(candidate_name),
                        str(candidate_email),
                        payload.get("phone", ""),
                        payload.get("notes", ""),
                        json.dumps(payload.get("cvIds", []))
                    )
                )
                submission_id = cur.fetchone()[0]
                print(f"Submission Debug - Created submission with ID: {submission_id}")
                
                # Check if uploaded_cv_count equals required_cv_count and close if needed
                _check_and_close_activity_on_submission(demand_id, cur)
                
                conn.commit()
        
        return {"message": "Profile submitted successfully", "submission_id": submission_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Submission Debug - Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to submit profile: {e}")


# ------------------------
# Process Tracking APIs
# ------------------------

@router.get("/{recruiter_id}/process-count")
def get_recruiter_process_count(recruiter_id: int) -> Dict[str, Any]:
    """Get process count for a recruiter"""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                        # Try JSON format first (new format) - check for recruiter_id in array
                        try:
                            cur.execute(
                                "SELECT COUNT(*) FROM tbl_demand_sheet WHERE assigned_to::text LIKE %s",
                                (f"%{recruiter_id}%",)
                            )
                            total_assigned = int(cur.fetchone()[0])
                    
                            # Count current processes (processing activities)
                            cur.execute(
                                """
                                SELECT COUNT(*) FROM tbl_recruiter_activity 
                                WHERE recruiter_id = %s 
                                AND activity_status = 'processing'
                                """,
                                (recruiter_id,)
                            )
                            current_processes = int(cur.fetchone()[0])
                    
                            # Count completed processes (use 'closed' instead of 'completed')
                            cur.execute(
                                """
                                SELECT COUNT(*) FROM tbl_demand_sheet 
                                WHERE assigned_to::text LIKE %s 
                                AND status = 'closed'
                                """,
                                (f"%{recruiter_id}%",)
                            )
                            completed_processes = int(cur.fetchone()[0])
                            
                        except Exception as json_error:
                            print(f"Process count JSON query failed: {json_error}")
                            # Try array format (old format)
                            try:
                                cur.execute(
                                    "SELECT COUNT(*) FROM tbl_demand_sheet WHERE %s = ANY(assigned_to)",
                                    (recruiter_id,)
                                )
                                total_assigned = int(cur.fetchone()[0])
                                
                                # Count current processes (processing activities)
                                cur.execute(
                                    """
                                    SELECT COUNT(*) FROM tbl_recruiter_activity 
                                    WHERE recruiter_id = %s 
                                    AND activity_status = 'processing'
                                    """,
                                    (recruiter_id,)
                                )
                                current_processes = int(cur.fetchone()[0])
                                
                                # Count completed processes (use 'closed' instead of 'completed')
                                cur.execute(
                                    """
                                    SELECT COUNT(*) FROM tbl_demand_sheet 
                                    WHERE %s = ANY(assigned_to) 
                                    AND status = 'closed'
                                    """,
                                    (recruiter_id,)
                                )
                                completed_processes = int(cur.fetchone()[0])
                                
                            except Exception as array_error:
                                print(f"Process count array query failed: {array_error}")
                                # Fallback to simple counts
                                total_assigned = 0
                                current_processes = 0
                                completed_processes = 0
                        
                        return {
                            "count": current_processes,
                            "total_assigned": total_assigned,
                            "current_processes": current_processes,
                            "completed_processes": completed_processes
                        }
    except Exception as e:
        print(f"Error getting process count: {e}")
        # Return safe defaults instead of throwing error
        return {
            "count": 0,
            "total_assigned": 0,
            "current_processes": 0,
            "completed_processes": 0
        }


@router.get("/debug/assigned-data/{recruiter_id}")
def debug_assigned_data(recruiter_id: int) -> Dict[str, Any]:
    """Debug endpoint to check assigned_to data format in database"""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get all demands with assigned_to data
                cur.execute("""
                    SELECT id, assigned_to, status, client_id 
                    FROM tbl_demand_sheet 
                    WHERE assigned_to IS NOT NULL 
                    ORDER BY id DESC 
                    LIMIT 10
                """)
                all_demands = cur.fetchall()
                
                # Try to find demands assigned to this recruiter using different methods
                results = {
                    "all_demands_sample": [
                        {
                            "id": row[0], 
                            "assigned_to": str(row[1]), 
                            "status": row[2],
                            "client_id": row[3]
                        } 
                        for row in all_demands
                    ],
                    "json_query_result": 0,
                    "array_query_result": 0,
                    "recruiter_id": recruiter_id
                }
                
                # Try JSON query
                try:
                    cur.execute(
                        "SELECT COUNT(*) FROM tbl_demand_sheet WHERE assigned_to::text LIKE %s",
                        (f"%{recruiter_id}%",)
                    )
                    results["json_query_result"] = int(cur.fetchone()[0])
                except Exception as e:
                    results["json_error"] = str(e)
                
                # Try array query
                try:
                    cur.execute(
                        "SELECT COUNT(*) FROM tbl_demand_sheet WHERE %s = ANY(assigned_to)",
                        (recruiter_id,)
                    )
                    results["array_query_result"] = int(cur.fetchone()[0])
                except Exception as e:
                    results["array_error"] = str(e)
                
                return results
    except Exception as e:
        return {"error": str(e)}

@router.get("/debug/cv-count/{demand_id}")
def debug_cv_count(demand_id: int, recruiter_id: Optional[int] = None) -> Dict[str, Any]:
    """Debug endpoint to check cv_list and uploaded_cv_count calculation"""
    if not recruiter_id:
        raise HTTPException(status_code=400, detail="recruiter_id is required")
    
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, cv_list, uploaded_cv_count
                    FROM tbl_recruiter_activity 
                    WHERE recruiter_id=%s AND demand_id=%s AND activity_status='processing'
                    ORDER BY id DESC LIMIT 1
                    """,
                    (recruiter_id, demand_id)
                )
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="No active activity found")
                
                activity_id, cv_list, current_count = row
                try:
                    parsed_cv_list = cv_list if isinstance(cv_list, list) else json.loads(cv_list or "[]")
                except Exception:
                    parsed_cv_list = []
                
                # Calculate expected count
                expected_count = 0
                for it in parsed_cv_list:
                    try:
                        has_id = it.get("candidate_id") is not None
                        status_val = it.get("status")
                        is_rejected = (int(status_val) == 2) if status_val is not None else False
                        if has_id and not is_rejected:
                            expected_count += 1
                    except Exception:
                        continue
                
                return {
                    "activity_id": activity_id,
                    "current_uploaded_cv_count": current_count,
                    "expected_uploaded_cv_count": expected_count,
                    "cv_list": parsed_cv_list,
                    "count_matches": current_count == expected_count
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to debug cv count: {e}")

@router.get("/{recruiter_id}/assigned-demands")
def get_recruiter_assigned_demands(recruiter_id: int, page: int = 1, size: int = 10) -> Dict[str, Any]:
    """Get assigned demands for a recruiter with pagination"""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Count total using JSONB
                search_json = json.dumps([{"recruiter_id": int(recruiter_id)}])
                cur.execute(
                    """
                    SELECT COUNT(*) 
                    FROM tbl_demand_sheet ds
                    LEFT JOIN tbl_recruiter_activity ra ON ra.demand_id = ds.id AND ra.recruiter_id = %s
                    WHERE COALESCE(ds.assigned_to,'[]'::jsonb) @> %s::jsonb
                    AND (ra.activity_status IS NULL OR ra.activity_status != 'closed')
                    """,
                    (recruiter_id, search_json)
                )
                total = int(cur.fetchone()[0])
                
                # Get demands with client info and activity_status
                cur.execute(
                    """
                    SELECT 
                        ds.id, ds.client_id, ds.skill, ds.skill as job_title, ds.no_of_positions,
                        ds.priority, ds.status, ds.created_at, ds.updated_at,
                        c.client_name, COALESCE(ds.assigned_to,'[]'::jsonb) as assigned_to,
                        COALESCE(ra.activity_status, 'open') AS activity_status
                    FROM tbl_demand_sheet ds
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    LEFT JOIN tbl_recruiter_activity ra ON ra.demand_id = ds.id AND ra.recruiter_id = %s
                    WHERE COALESCE(ds.assigned_to,'[]'::jsonb) @> %s::jsonb
                    AND (ra.activity_status IS NULL OR ra.activity_status != 'closed')
                    ORDER BY ds.updated_at DESC
                    LIMIT %s OFFSET %s
                    """,
                    (recruiter_id, search_json, size, (page - 1) * size)
                )
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description]
                demands = [dict(zip(cols, row)) for row in rows]
                
                # Format the response
                for demand in demands:
                    demand['assigned_date'] = demand.get('updated_at') or demand.get('created_at')
                
                return {
                    "items": demands,
                    "total": total,
                    "page": page,
                    "size": size
                }
    except Exception as e:
        print(f"Error getting assigned demands: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get assigned demands: {e}")


@router.patch("/close-process")
def close_recruiter_process(recruiter_id: int, demand_id: int) -> Dict[str, Any]:
    """Close a recruiter's current process"""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Check if demand is assigned to this recruiter using JSONB
                search_json = json.dumps([{"recruiter_id": int(recruiter_id)}])
                cur.execute(
                    """
                    SELECT id, status FROM tbl_demand_sheet 
                    WHERE id = %s AND COALESCE(assigned_to,'[]'::jsonb) @> %s::jsonb
                    """,
                    (demand_id, search_json)
                )
                demand = cur.fetchone()
                
                if not demand:
                    raise HTTPException(status_code=404, detail="Demand not found or not assigned to this recruiter")
                
                # Check if demand is in progress or processing
                if demand[1] not in ['in_progress', 'processing']:
                    raise HTTPException(status_code=400, detail="Demand is not currently in progress")
                
                # Update demand status to closed
                cur.execute(
                    "UPDATE tbl_demand_sheet SET status = 'closed', updated_at = NOW() WHERE id = %s",
                    (demand_id,)
                )
                
                # Update any related recruiter activity
                cur.execute(
                    """
                    UPDATE tbl_recruiter_activity 
                    SET activity_status = 'closed', closed_at = NOW(), updated_at = NOW()
                    WHERE demand_id = %s AND recruiter_id = %s AND activity_status = 'processing'
                    """,
                    (demand_id, recruiter_id)
                )
                
                conn.commit()
                
                return {"message": "Process closed successfully", "demand_id": demand_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error closing process: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to close process: {e}")


@router.patch("/move-process")
def move_recruiter_process(recruiter_id: int, from_demand_id: int, to_demand_id: int) -> Dict[str, Any]:
    """Move recruiter's current process from one demand to another.
    Relax validation to depend on recruiter_activity instead of demand_sheet.status.
    """
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Ensure target demand is assigned to this recruiter
                search_json = json.dumps([{"recruiter_id": int(recruiter_id)}])
                cur.execute(
                    """
                    SELECT id FROM tbl_demand_sheet 
                    WHERE id = %s AND COALESCE(assigned_to,'[]'::jsonb) @> %s::jsonb
                    """,
                    (to_demand_id, search_json)
                )
                if cur.fetchone() is None:
                    raise HTTPException(status_code=404, detail="Target demand not found or not assigned to this recruiter")

                # Close any current processing activity for the recruiter (optionally matching from_demand_id)
                cur.execute(
                    """
                    UPDATE tbl_recruiter_activity 
                    SET activity_status = 'closed', closed_at = NOW(), updated_at = NOW()
                    WHERE recruiter_id = %s AND activity_status = 'processing'
                    AND (%s IS NULL OR demand_id = %s)
                    RETURNING demand_id
                    """,
                    (recruiter_id, from_demand_id, from_demand_id)
                )
                # Ignore result; proceed to start new activity

                # Ensure there is no existing processing activity for the target
                cur.execute(
                    """
                    SELECT id FROM tbl_recruiter_activity
                    WHERE recruiter_id=%s AND demand_id=%s AND activity_status='processing'
                    ORDER BY id DESC LIMIT 1
                    """,
                    (recruiter_id, to_demand_id)
                )
                already = cur.fetchone()
                if already:
                    # Nothing to do
                    conn.commit()
                    return {
                        "message": "Already processing target demand",
                        "to_demand_id": to_demand_id
                    }

                # Start new processing activity for target
                cur.execute(
                    """
                    INSERT INTO tbl_recruiter_activity (recruiter_id, demand_id, activity_status, opened_at)
                    VALUES (%s, %s, 'processing', NOW())
                    RETURNING id
                    """,
                    (recruiter_id, to_demand_id)
                )
                new_id = cur.fetchone()[0]

                # Audit move
                try:
                    cur.execute(
                        """
                        INSERT INTO tbl_audit_trail (event_type, recruiter_id, demand_id, details)
                        VALUES ('move_process', %s, %s, %s::jsonb)
                        """,
                        (recruiter_id, to_demand_id, json.dumps({"from_demand_id": from_demand_id, "new_activity_id": new_id}))
                    )
                except Exception:
                    pass

                conn.commit()
                return {
                    "message": "Process moved successfully",
                    "from_demand_id": from_demand_id,
                    "to_demand_id": to_demand_id,
                    "activity_id": int(new_id)
                }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error moving process: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to move process: {e}")


@router.post("/close-activity-complete")
def close_activity_complete(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Automatically close activity and demand when required CV count is reached"""
    try:
        activity_id = payload.get("activity_id")
        demand_id = payload.get("demand_id")
        recruiter_id = payload.get("recruiter_id")
        
        print(f"🔍 Auto-close request received: activity_id={activity_id}, demand_id={demand_id}, recruiter_id={recruiter_id}")
        
        if not all([activity_id, demand_id, recruiter_id]):
            raise HTTPException(status_code=400, detail="Missing required parameters")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Update tbl_recruiter_activity status to 'closed'
                print(f"🔄 Updating tbl_recruiter_activity status to 'closed' for activity_id={activity_id}")
                cur.execute(
                    """
                    UPDATE tbl_recruiter_activity 
                    SET activity_status = 'closed', updated_at = NOW()
                    WHERE id = %s AND recruiter_id = %s
                    """,
                    (activity_id, recruiter_id)
                )
                
                print(f"📊 Updated {cur.rowcount} rows in tbl_recruiter_activity")
                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="Activity not found")
                
                # Update tbl_demand_sheet status to 'closed'
                print(f"🔄 Updating tbl_demand_sheet status to 'closed' for demand_id={demand_id}")
                cur.execute(
                    """
                    UPDATE tbl_demand_sheet 
                    SET status = 'closed', updated_at = NOW()
                    WHERE id = %s
                    """,
                    (demand_id,)
                )
                
                print(f"📊 Updated {cur.rowcount} rows in tbl_demand_sheet")
                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="Demand not found")
                
                # Log the automatic closure
                try:
                    cur.execute(
                        """
                        INSERT INTO tbl_audit_trail (event_type, recruiter_id, demand_id, details)
                        VALUES ('auto_close_complete', %s, %s, %s::jsonb)
                        """,
                        (recruiter_id, demand_id, json.dumps({
                            "reason": "required_cv_count_reached",
                            "activity_id": activity_id
                        }))
                    )
                except Exception:
                    pass  # Don't fail if audit trail fails
                
                conn.commit()
                
                return {
                    "success": True,
                    "message": "Activity and demand closed automatically",
                    "activity_id": activity_id,
                    "demand_id": demand_id
                }
                
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error auto-closing activity: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to auto-close activity: {e}")


@router.post("/check-quota-before-submission")
def check_quota_before_submission(request: Dict[str, Any]) -> Dict[str, Any]:
    """Check if quota is already met before allowing submission"""
    try:
        demand_id = request.get("demand_id")
        recruiter_id = request.get("recruiter_id")
        
        if not all([demand_id, recruiter_id]):
            print(f"❌ Missing parameters: demand_id={demand_id}, recruiter_id={recruiter_id}")
            raise HTTPException(status_code=400, detail="Missing required parameters")
        
        # Convert to int if needed
        try:
            demand_id = int(demand_id)
            recruiter_id = int(recruiter_id)
        except (ValueError, TypeError) as e:
            print(f"❌ Error converting IDs to int: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid ID format: {e}")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get current counts for the recruiter
                cur.execute(
                    """
                    SELECT uploaded_cv_count, required_cv_count, activity_status
                    FROM tbl_recruiter_activity 
                    WHERE demand_id = %s AND recruiter_id = %s
                    """,
                    (demand_id, recruiter_id)
                )
                
                result = cur.fetchone()
                if not result:
                    raise HTTPException(status_code=404, detail="Activity not found")
                
                uploaded_count, required_count, current_status = result
                
                # Handle None values - convert to 0 if None
                uploaded_count = uploaded_count if uploaded_count is not None else 0
                required_count = required_count if required_count is not None else 0
                
                # Check if quota is already met
                quota_met = uploaded_count >= required_count and required_count > 0
                
                # If quota is met, update activity_status to 'closed'
                if quota_met and current_status != 'closed':
                    try:
                        cur.execute(
                            """
                            UPDATE tbl_recruiter_activity 
                            SET activity_status = 'closed', updated_at = NOW()
                            WHERE demand_id = %s AND recruiter_id = %s
                            """,
                            (demand_id, recruiter_id)
                        )
                        conn.commit()
                    except Exception as e:
                        print(f"Warning: Failed to update activity_status: {e}")
                
                return {
                    "success": True,
                    "quota_met": quota_met,
                    "uploaded_count": uploaded_count,
                    "required_count": required_count,
                    "can_submit": not quota_met,
                    "message": "All required profiles have already been submitted for this demand." if quota_met else "Submission allowed"
                }
                
    except Exception as e:
        print(f"❌ Error checking quota: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check quota: {e}")


@router.post("/check-quota-and-update-status")
def check_quota_and_update_status(request: Dict[str, Any]) -> Dict[str, Any]:
    """Enhanced quota check that immediately updates DB status to closed when quota is met"""
    _ensure_tables()
    try:
        demand_id = request.get("demand_id")
        recruiter_id = request.get("recruiter_id")
        
        if not all([demand_id, recruiter_id]):
            print(f"❌ Missing parameters: demand_id={demand_id}, recruiter_id={recruiter_id}")
            raise HTTPException(status_code=400, detail="Missing required parameters")
        
        # Convert to int if needed
        try:
            demand_id = int(demand_id)
            recruiter_id = int(recruiter_id)
        except (ValueError, TypeError) as e:
            print(f"❌ Error converting IDs to int: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid ID format: {e}")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get current counts for the recruiter
                cur.execute(
                    """
                    SELECT uploaded_cv_count, required_cv_count, activity_status, activity_status
                    FROM tbl_recruiter_activity 
                    WHERE demand_id = %s AND recruiter_id = %s
                    """,
                    (demand_id, recruiter_id)
                )
                
                result = cur.fetchone()
                if not result:
                    raise HTTPException(status_code=404, detail="Activity not found")
                
                uploaded_count, required_count, current_status, activity_status = result
                
                # Handle None values - convert to 0 if None
                uploaded_count = uploaded_count if uploaded_count is not None else 0
                required_count = required_count if required_count is not None else 0
                
                # Check if quota is already met
                quota_met = uploaded_count >= required_count and required_count > 0
                
                # If quota is met, immediately update activity_status to 'closed' and close the demand
                if quota_met and current_status != 'closed':
                    try:
                        cur.execute(
                            """
                            UPDATE tbl_recruiter_activity 
                            SET activity_status = 'closed', 
                                updated_at = NOW()
                            WHERE demand_id = %s AND recruiter_id = %s
                            """,
                            (demand_id, recruiter_id)
                        )
                        # Also close the demand itself
                        cur.execute(
                            """
                            UPDATE tbl_demand_sheet
                            SET status = 'closed', updated_at = NOW()
                            WHERE id = %s
                            """,
                            (demand_id,)
                        )
                        conn.commit()
                        print(f"✅ Updated activity status to closed for demand {demand_id}, recruiter {recruiter_id}")
                    except Exception as e:
                        print(f"Warning: Failed to update activity status: {e}")
                
                return {
                    "success": True,
                    "quota_met": quota_met,
                    "uploaded_count": uploaded_count,
                    "required_count": required_count,
                    "activity_status": current_status,
                    "activity_status": activity_status,
                    "can_submit": not quota_met,
                    "message": "All required profiles have already been submitted for this demand." if quota_met else "Submission allowed"
                }
                
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error checking quota: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check quota: {e}")


@router.post("/check-quota-before-submission-legacy")
def check_quota_before_submission_legacy(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Legacy endpoint for quota checking with Dict format"""
    try:
        print(f"🔍 Legacy endpoint - Received payload: {payload}")
        demand_id = payload.get("demand_id")
        recruiter_id = payload.get("recruiter_id")
        print(f"🔍 Legacy endpoint - Parsed values: demand_id={demand_id}, recruiter_id={recruiter_id}")
        
        if not all([demand_id, recruiter_id]):
            print(f"❌ Legacy endpoint - Missing required parameters: demand_id={demand_id}, recruiter_id={recruiter_id}")
            raise HTTPException(status_code=400, detail="Missing required parameters")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get current counts for the recruiter
                cur.execute(
                    """
                    SELECT uploaded_cv_count, required_cv_count, activity_status
                    FROM tbl_recruiter_activity 
                    WHERE demand_id = %s AND recruiter_id = %s
                    """,
                    (demand_id, recruiter_id)
                )
                
                result = cur.fetchone()
                if not result:
                    raise HTTPException(status_code=404, detail="Activity not found")
                
                uploaded_count, required_count, current_status = result
                
                # Handle None values - convert to 0 if None
                uploaded_count = uploaded_count if uploaded_count is not None else 0
                required_count = required_count if required_count is not None else 0
                
                # Check if quota is already met
                quota_met = uploaded_count >= required_count and required_count > 0
                
                # If quota is met, update activity_status to 'closed'
                if quota_met and current_status != 'closed':
                    try:
                        cur.execute(
                            """
                            UPDATE tbl_recruiter_activity 
                            SET activity_status = 'closed', updated_at = NOW()
                            WHERE demand_id = %s AND recruiter_id = %s
                            """,
                            (demand_id, recruiter_id)
                        )
                        conn.commit()
                    except Exception as e:
                        print(f"Warning: Failed to update activity_status: {e}")
                
                return {
                    "success": True,
                    "quota_met": quota_met,
                    "uploaded_count": uploaded_count,
                    "required_count": required_count,
                    "can_submit": not quota_met,
                    "message": "All required profiles have already been submitted for this demand." if quota_met else "Submission allowed"
                }
                
    except Exception as e:
        print(f"❌ Error checking quota (legacy): {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check quota: {e}")


@router.post("/update-cv-count-and-check")
def update_cv_count_and_check(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Update CV count for all recruiters with same demand_id and check for auto-close"""
    try:
        print(f"🔍 Received payload: {payload}")
        demand_id = payload.get("demand_id")
        recruiter_id = payload.get("recruiter_id")
        increment = payload.get("increment", 1)  # 1 for submit, -1 for reject
        
        print(f"🔍 Parsed values: demand_id={demand_id}, recruiter_id={recruiter_id}, increment={increment}")
        
        if not all([demand_id, recruiter_id]):
            print(f"❌ Missing required parameters: demand_id={demand_id}, recruiter_id={recruiter_id}")
            raise HTTPException(status_code=400, detail="Missing required parameters")
        
        print(f"🔄 Updating CV count for demand_id={demand_id}, increment={increment}")
        print(f"🔍 Database DSN: {DATABASE_DSN}")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Ensure the uploaded_cv_count column exists and has proper default
                try:
                    # First, ensure the column exists
                    cur.execute("""
                        ALTER TABLE tbl_recruiter_activity 
                        ADD COLUMN IF NOT EXISTS uploaded_cv_count INTEGER DEFAULT 0
                    """)
                    
                    # Then set the default value
                    cur.execute("""
                        ALTER TABLE tbl_recruiter_activity 
                        ALTER COLUMN uploaded_cv_count SET DEFAULT 0
                    """)
                    
                    # Update any NULL values to 0
                    cur.execute("""
                        UPDATE tbl_recruiter_activity 
                        SET uploaded_cv_count = 0 
                        WHERE uploaded_cv_count IS NULL
                    """)
                    
                    print("✅ Ensured uploaded_cv_count column exists with default value 0")
                except Exception as e:
                    print(f"⚠️ Column setup warning: {e}")
                
                # Recalculate uploaded_cv_count from cv_list for all recruiters with same demand_id
                # This ensures accuracy by counting actual CVs instead of using increment/decrement
                try:
                    # Calculate the actual count from cv_list (excluding rejected CVs with status = 2)
                    cur.execute(
                        """
                        SELECT COALESCE(SUM(
                            (SELECT COUNT(*) 
                             FROM jsonb_array_elements(ra.cv_list) AS cv 
                             WHERE (cv->>'status')::int != 2)
                        ), 0) as total_cv_count
                        FROM tbl_recruiter_activity ra
                        WHERE ra.demand_id = %s
                        AND ra.cv_list IS NOT NULL
                        AND jsonb_array_length(ra.cv_list) > 0
                        """,
                        (demand_id,)
                    )
                    
                    calculated_count_result = cur.fetchone()
                    calculated_count = calculated_count_result[0] if calculated_count_result else 0
                    
                    print(f"🔍 Recalculated count from cv_list: {calculated_count}")
                    
                    # Update all recruiter activities with the recalculated count
                    cur.execute(
                        """
                        UPDATE tbl_recruiter_activity 
                        SET uploaded_cv_count = %s, updated_at = NOW()
                        WHERE demand_id = %s
                        """,
                        (calculated_count, demand_id)
                    )
                    
                    print(f"📊 Updated {cur.rowcount} recruiter activities with recalculated count: {calculated_count}")
                except Exception as e:
                    print(f"❌ Error updating recruiter activities: {e}")
                    raise HTTPException(status_code=500, detail=f"Database error: {e}")
                
                # Get the updated count and required count for the current recruiter
                try:
                    cur.execute(
                        """
                        SELECT uploaded_cv_count, required_cv_count, activity_status
                        FROM tbl_recruiter_activity 
                        WHERE demand_id = %s AND recruiter_id = %s
                        """,
                        (demand_id, recruiter_id)
                    )
                    
                    result = cur.fetchone()
                    if not result:
                        print(f"❌ Activity not found for demand_id={demand_id}, recruiter_id={recruiter_id}")
                        raise HTTPException(status_code=404, detail="Activity not found")
                    
                    print(f"🔍 Raw database result: {result}")
                except Exception as e:
                    print(f"❌ Error fetching activity data: {e}")
                    raise HTTPException(status_code=500, detail=f"Database error: {e}")
                
                uploaded_count, required_count, current_status = result
                
                # Handle None values - convert to 0 if None
                uploaded_count = uploaded_count if uploaded_count is not None else 0
                required_count = required_count if required_count is not None else 0
                
                print(f"📊 Current counts: uploaded={uploaded_count}, required={required_count}, status={current_status}")
                print(f"🔍 Count types: uploaded={type(uploaded_count)}, required={type(required_count)}")
                
                # Check if we need to close or reopen based on increment
                should_close = increment > 0 and uploaded_count >= required_count and required_count > 0
                should_reopen = increment < 0 and current_status == 'closed'
                
                if should_close:
                    print("✅ Auto-closing activity and demand")
                    # Close activity and demand
                    cur.execute(
                        """
                        UPDATE tbl_recruiter_activity 
                        SET activity_status = 'closed', updated_at = NOW()
                        WHERE demand_id = %s
                        """,
                        (demand_id,)
                    )
                    
                    cur.execute(
                        """
                        UPDATE tbl_demand_sheet 
                        SET status = 'closed', updated_at = NOW()
                        WHERE id = %s
                        """,
                        (demand_id,)
                    )
                    
                    # Log the closure
                    try:
                        cur.execute(
                            """
                            INSERT INTO tbl_audit_trail (event_type, recruiter_id, demand_id, details)
                            VALUES ('auto_close_complete', %s, %s, %s::jsonb)
                            """,
                            (recruiter_id, demand_id, json.dumps({
                                "reason": "required_cv_count_reached",
                                "uploaded_count": uploaded_count,
                                "required_count": required_count
                            }))
                        )
                    except Exception:
                        pass
                    
                    conn.commit()
                    
                    return {
                        "success": True,
                        "closed": True,
                        "message": "Activity and demand closed automatically",
                        "uploaded_count": uploaded_count,
                        "required_count": required_count
                    }
                
                elif should_reopen:
                    print("🔄 Reopening activity and demand")
                    # Reopen activity and demand
                    cur.execute(
                        """
                        UPDATE tbl_recruiter_activity 
                        SET activity_status = 'processing', updated_at = NOW()
                        WHERE demand_id = %s
                        """,
                        (demand_id,)
                    )
                    
                    cur.execute(
                        """
                        UPDATE tbl_demand_sheet 
                        SET status = 'processing', updated_at = NOW()
                        WHERE id = %s
                        """,
                        (demand_id,)
                    )
                    
                    # Log the reopening
                    try:
                        cur.execute(
                            """
                            INSERT INTO tbl_audit_trail (event_type, recruiter_id, demand_id, details)
                            VALUES ('auto_reopen', %s, %s, %s::jsonb)
                            """,
                            (recruiter_id, demand_id, json.dumps({
                                "reason": "cv_rejected",
                                "uploaded_count": uploaded_count,
                                "required_count": required_count
                            }))
                        )
                    except Exception:
                        pass
                    
                    conn.commit()
                    
                    return {
                        "success": True,
                        "reopened": True,
                        "message": "Activity and demand reopened",
                        "uploaded_count": uploaded_count,
                        "required_count": required_count
                    }
                
                else:
                    conn.commit()
                    return {
                        "success": True,
                        "closed": False,
                        "reopened": False,
                        "message": "Count updated successfully",
                        "uploaded_count": uploaded_count,
                        "required_count": required_count
                    }
                
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating CV count: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update CV count: {e}")


@router.get("/activity/{recruiter_id}/{demand_id}")
def get_activity_status(recruiter_id: int, demand_id: int) -> Dict[str, Any]:
    """Get activity status and CV counts for auto-close logic"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 
                        id,
                        activity_status,
                        required_cv_count,
                        uploaded_cv_count,
                        cv_list
                    FROM tbl_recruiter_activity 
                    WHERE recruiter_id = %s AND demand_id = %s 
                    ORDER BY id DESC LIMIT 1
                """, (recruiter_id, demand_id))
                
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="Activity not found")
                
                activity_id, activity_status, required_cv_count, uploaded_cv_count, cv_list = row
                
                # Count actual CVs in cv_list if it exists
                actual_cv_count = 0
                if cv_list:
                    try:
                        if isinstance(cv_list, list):
                            actual_cv_count = len(cv_list)
                        else:
                            import json
                            cv_data = json.loads(cv_list) if isinstance(cv_list, str) else cv_list
                            actual_cv_count = len(cv_data) if isinstance(cv_data, list) else 0
                    except Exception:
                        actual_cv_count = 0
                
                return {
                    "id": activity_id,
                    "activity_status": activity_status,
                    "required_cv_count": required_cv_count or 0,
                    "uploaded_cv_count": actual_cv_count,
                    "can_auto_close": (required_cv_count or 0) == actual_cv_count
                }
                
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting activity status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get activity status: {e}")


@router.post("/close-activity")
def close_activity(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Auto-close activity when required CV count is met"""
    try:
        recruiter_id = payload.get("recruiter_id")
        demand_id = payload.get("demand_id")
        
        if not recruiter_id or not demand_id:
            raise HTTPException(status_code=400, detail="recruiter_id and demand_id are required")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Update activity status to closed
                cur.execute("""
                    UPDATE tbl_recruiter_activity 
                    SET activity_status = 'closed', updated_at = NOW()
                    WHERE recruiter_id = %s AND demand_id = %s
                """, (recruiter_id, demand_id))
                
                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="Activity not found")
                
                conn.commit()
                
                return {
                    "success": True,
                    "message": "Activity closed successfully",
                    "activity_status": "closed"
                }
                
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error closing activity: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to close activity: {e}")


