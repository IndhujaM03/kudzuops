import os
import json
from datetime import datetime, date
from typing import Any, Dict, List, Optional

import psycopg
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import FileResponse

try:
    from ..login import get_current_user
except ImportError:
    async def get_current_user():
        return {"uid": 1, "role": "team_leader"}

try:
    from ..config import settings
    DATABASE_DSN = settings.database_url
    API_BASE_URL = settings.api_base_url or os.getenv("API_BASE_URL", "")
except Exception:
    DATABASE_DSN = os.getenv("DATABASE_URL", "")
    API_BASE_URL = os.getenv("API_BASE_URL", "")


router = APIRouter(prefix="/api", tags=["demand"])


def _rows_to_dicts(columns: List[str], rows: List[tuple]) -> List[Dict[str, Any]]:
    return [dict(zip(columns, row)) for row in rows]


def _get_tl_demand_and_recruiter_ids(cur, team_leader_id: int) -> tuple[List[int], List[int]]:
    """
    Get demand_ids created by the TL and recruiter_ids assigned to those demands.
    This is the correct filtering logic: based on tl_id in tbl_demand_sheet, not reporting_to.
    
    Returns:
        tuple: (demand_ids list, recruiter_ids list)
    """
    try:
        # Step 1: Get all demand_ids where tl_id = team_leader_id
        cur.execute("""
            SELECT id FROM tbl_demand_sheet 
            WHERE tl_id = %s
        """, (team_leader_id,))
        demand_rows = cur.fetchall()
        demand_ids = [row[0] for row in demand_rows] if demand_rows else []
        
        if not demand_ids:
            return ([], [])
        
        # Step 2: Get all recruiter_ids assigned to those demands from tbl_recruiter_activity
        cur.execute("""
            SELECT DISTINCT recruiter_id 
            FROM tbl_recruiter_activity 
            WHERE demand_id = ANY(%s)
        """, (demand_ids,))
        recruiter_rows = cur.fetchall()
        recruiter_ids = [row[0] for row in recruiter_rows] if recruiter_rows else []
        
        return (demand_ids, recruiter_ids)
    except Exception as e:
        print(f"Error in _get_tl_demand_and_recruiter_ids: {e}")
        return ([], [])


def _get_team_leader_id(cur) -> Optional[int]:
    """Fetch the Team Leader's user ID from tbl_users table based on role."""
    try:
        # Get the first active team leader (role = 'team_leader' or 'tl')
        cur.execute("""
            SELECT id FROM tbl_users 
            WHERE role IN ('team_leader', 'tl') 
            AND is_active = TRUE 
            AND approval_status = TRUE
            ORDER BY id ASC 
            LIMIT 1
        """)
        result = cur.fetchone()
        if result:
            return result[0]
        return None
    except Exception as e:
        print(f"Error fetching team leader ID: {e}")
        return None


def _check_and_update_demand_status(demand_id: int, cur) -> None:
    """Check if demand should be closed or opened based on CV count and update status accordingly"""
    try:
        # Get total uploaded CV count across all recruiters for this demand
        # Only count CVs that are not rejected (status != 2)
        cur.execute("""
            SELECT COALESCE(SUM(
                (SELECT COUNT(*) 
                 FROM jsonb_array_elements(ra.cv_list) AS cv 
                 WHERE (cv->>'status')::int != 2)
            ), 0) as total_cv_count
            FROM tbl_recruiter_activity ra
            WHERE ra.demand_id = %s
            AND ra.cv_list IS NOT NULL
            AND jsonb_array_length(ra.cv_list) > 0
        """, (demand_id,))
        
        result = cur.fetchone()
        total_uploaded = result[0] if result else 0
        
        # Get required CV count for this demand
        cur.execute("""
            SELECT required_cv_count FROM tbl_demand_sheet WHERE id = %s
        """, (demand_id,))
        
        result = cur.fetchone()
        required_count = result[0] if result else 0
        
        # Update all recruiter activities with the same count
        cur.execute("""
            UPDATE tbl_recruiter_activity 
            SET uploaded_cv_count = %s, updated_at = NOW()
            WHERE demand_id = %s
        """, (total_uploaded, demand_id))
        
        # Determine if demand should be closed or opened
        if total_uploaded >= required_count and required_count > 0:
            # Close all activities and demand
            cur.execute("""
                UPDATE tbl_recruiter_activity 
                SET activity_status = 'closed', updated_at = NOW()
                WHERE demand_id = %s
            """, (demand_id,))
            
            cur.execute("""
                UPDATE tbl_demand_sheet 
                SET status = 'closed', updated_at = NOW()
                WHERE id = %s
            """, (demand_id,))
        else:
            # Open all activities and demand
            cur.execute("""
                UPDATE tbl_recruiter_activity 
                SET activity_status = 'processing', updated_at = NOW()
                WHERE demand_id = %s
            """, (demand_id,))
            
            cur.execute("""
                UPDATE tbl_demand_sheet 
                SET status = 'open', updated_at = NOW()
                WHERE id = %s
            """, (demand_id,))
            
    except Exception as e:
        print(f"Error checking demand status for demand {demand_id}: {e}")
        pass


@router.get("/clients")
def list_clients() -> List[Dict[str, Any]]:
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Prefer tbl_clients; if that table doesn't exist, fall back to tbl_client
                try:
                    cur.execute("SELECT * FROM tbl_clients ORDER BY id ASC")
                except Exception:
                    cur.execute("SELECT * FROM tbl_client ORDER BY id ASC")
                rows = cur.fetchall()
                columns = [desc[0] for desc in cur.description]
                return _rows_to_dicts(columns, rows)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch clients: {e}")


@router.get("/clients/{client_id}/spoc")
def list_spocs(client_id: int) -> List[Dict[str, Any]]:
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM tbl_client_spocs WHERE client_id = %s ORDER BY id ASC",
                    (client_id,),
                )
                rows = cur.fetchall()
                columns = [desc[0] for desc in cur.description]
                return _rows_to_dicts(columns, rows)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch SPOCs: {e}")


@router.post("/demand/create")
def create_demand(payload: Dict[str, Any]) -> Dict[str, Any]:
    required_fields = ["client_id", "spoc_id", "required_cv_count"]
    for field in required_fields:
        if payload.get(field) in (None, ""):
            raise HTTPException(status_code=400, detail=f"{field} is required")

    client_id: int = int(payload["client_id"])  # type: ignore
    spoc_id: int = int(payload["spoc_id"])  # type: ignore
    required_cv_count: int = int(payload["required_cv_count"])  # type: ignore
    skills: Optional[str] = payload.get("skills") or payload.get("skill")
    no_of_positions: Optional[int] = payload.get("no_of_positions")
    priority: Optional[str] = payload.get("priority")
    job_description_url: Optional[str] = payload.get("job_description_url")
    remarks: Optional[str] = payload.get("remarks")
    
    # Normalize to supported enum values
    status: Optional[str] = (payload.get("status") or "open").strip().lower()
    if status not in {"open", "in_progress", "closed", "on_hold"}:
        status = "open"
    
    # Handle assigned_to field
    assigned_to = payload.get("assigned_to")
    if assigned_to is None:
        assigned_to = "[]"  # Default to empty JSON array
    elif isinstance(assigned_to, (list, dict)):
        assigned_to = json.dumps(assigned_to)
    # If it's already a string, use as is

    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Fetch Team Leader ID
                tl_id = _get_team_leader_id(cur)
                
                cur.execute(
                    """
                    INSERT INTO tbl_demand_sheet 
                    (demand_date, client_id, spoc_id, skill, no_of_positions, 
                     required_cv_count, priority, job_description_url, remarks, status, assigned_to, tl_id, created_at)
                    VALUES (CURRENT_DATE, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, NOW())
                    RETURNING id
                    """,
                    (
                        client_id,
                        spoc_id,
                        skills,
                        no_of_positions,
                        required_cv_count,
                        (priority or None).lower() if priority else None,
                        job_description_url,
                        remarks,
                        status,
                        assigned_to,
                        tl_id,
                    ),
                )
                new_id = cur.fetchone()[0]
                conn.commit()

                return {"message": "Demand Sheet Created Successfully", "id": new_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create demand: {e}")



@router.post("/demand/seed-demo")
def seed_demo() -> Dict[str, Any]:
    """Create a demo client and SPOC for quick testing."""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Ensure demo client
                cur.execute("SELECT id FROM tbl_clients WHERE client_name=%s", ("Demo Client",))
                row = cur.fetchone()
                if row:
                    client_id = row[0]
                else:
                    cur.execute("INSERT INTO tbl_clients (client_name) VALUES (%s) RETURNING id", ("Demo Client",))
                    client_id = cur.fetchone()[0]

                # Ensure demo spoc
                cur.execute(
                    "SELECT id FROM tbl_client_spocs WHERE client_id=%s AND spoc_name=%s",
                    (client_id, "Demo SPOC"),
                )
                row = cur.fetchone()
                if row:
                    spoc_id = row[0]
                else:
                    cur.execute(
                        "INSERT INTO tbl_client_spocs (client_id, spoc_name, email, is_primary) VALUES (%s, %s, %s, %s) RETURNING id",
                        (client_id, "Demo SPOC", "demo.spoc@example.com", True),
                    )
                    spoc_id = cur.fetchone()[0]
                conn.commit()
                return {"message": "Demo data ready", "client_id": client_id, "spoc_id": spoc_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to seed demo: {e}")


@router.post("/clients/add")
def add_client_and_spoc(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Create a client and optionally a SPOC in one call.

    Body: { client_name: str, spoc_name?: str, email?: str, is_primary?: bool }
    Returns: { client_id, spoc_id }
    """
    client_name = (payload.get("client_name") or "").strip()
    if not client_name:
        raise HTTPException(status_code=400, detail="client_name is required")
    spoc_name = (payload.get("spoc_name") or "").strip() or None
    email = (payload.get("email") or "").strip() or None
    is_primary = bool(payload.get("is_primary", True))

    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # upsert-ish for client by name
                cur.execute("SELECT id FROM tbl_clients WHERE client_name=%s", (client_name,))
                row = cur.fetchone()
                if row:
                    client_id = row[0]
                else:
                    cur.execute("INSERT INTO tbl_clients (client_name) VALUES (%s) RETURNING id", (client_name,))
                    client_id = cur.fetchone()[0]

                spoc_id: Optional[int] = None
                if spoc_name:
                    cur.execute(
                        "SELECT id FROM tbl_client_spocs WHERE client_id=%s AND spoc_name=%s",
                        (client_id, spoc_name),
                    )
                    row = cur.fetchone()
                    if row:
                        spoc_id = row[0]
                    else:
                        cur.execute(
                            "INSERT INTO tbl_client_spocs (client_id, spoc_name, email, is_primary) VALUES (%s,%s,%s,%s) RETURNING id",
                            (client_id, spoc_name, email, is_primary),
                        )
                        spoc_id = cur.fetchone()[0]
                conn.commit()
                return {"client_id": client_id, "spoc_id": spoc_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add client/spoc: {e}")


# New listing endpoints for TL tabs
@router.get("/demand/unassigned")
async def list_unassigned(current_user: Dict[str, Any] = Depends(get_current_user)) -> List[Dict[str, Any]]:
    """Demand sheets where assigned_to IS NULL or empty JSON array, filtered by logged-in TL's tl_id."""
    try:
        team_leader_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not team_leader_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT d.*, c.client_name, s.spoc_name 
                    FROM tbl_demand_sheet d 
                    LEFT JOIN tbl_clients c ON c.id = d.client_id 
                    LEFT JOIN tbl_client_spocs s ON s.id = d.spoc_id 
                    WHERE d.tl_id = %s
                      AND (d.assigned_to IS NULL 
                       OR d.assigned_to = '[]'::jsonb 
                       OR d.assigned_to = 'null'::jsonb
                       OR jsonb_array_length(COALESCE(d.assigned_to, '[]'::jsonb)) = 0)
                    ORDER BY d.id DESC
                    """,
                    (team_leader_id,)
                )
                rows = cur.fetchall()
                columns = [desc[0] for desc in cur.description]
                return _rows_to_dicts(columns, rows)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch unassigned demands: {e}")


@router.get("/demand/assigned")
async def list_assigned(recruiter_id: Optional[int] = None, current_user: Dict[str, Any] = Depends(get_current_user)) -> List[Dict[str, Any]]:
    """Demand sheets where assigned_to contains recruiter assignments, filtered by logged-in TL's tl_id."""
    try:
        team_leader_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not team_leader_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                if recruiter_id:
                    # Get demands assigned to specific recruiter, filtered by TL
                    cur.execute(
                        """
                        SELECT d.*, c.client_name, s.spoc_name
                        FROM tbl_demand_sheet d 
                        LEFT JOIN tbl_clients c ON c.id = d.client_id 
                        LEFT JOIN tbl_client_spocs s ON s.id = d.spoc_id 
                        WHERE d.tl_id = %s
                          AND d.assigned_to::text LIKE %s
                        ORDER BY d.id DESC
                        """,
                        (team_leader_id, f"%{recruiter_id}%")
                    )
                else:
                    # Get all assigned demands with aggregated CV counts, filtered by TL
                    cur.execute(
                        """
                        SELECT 
                            d.*, 
                            c.client_name, 
                            s.spoc_name,
                            COALESCE(SUM(ra.uploaded_cv_count), 0) as total_uploaded_cv_count,
                            COALESCE(MAX(ra.required_cv_count), 0) as required_cv_count
                        FROM tbl_demand_sheet d 
                        LEFT JOIN tbl_clients c ON c.id = d.client_id 
                        LEFT JOIN tbl_client_spocs s ON s.id = d.spoc_id 
                        LEFT JOIN tbl_recruiter_activity ra ON ra.demand_id = d.id
                        WHERE d.tl_id = %s
                          AND d.assigned_to IS NOT NULL 
                           AND d.assigned_to != '[]'::jsonb 
                           AND d.assigned_to != 'null'::jsonb
                           AND jsonb_array_length(COALESCE(d.assigned_to, '[]'::jsonb)) > 0
                        GROUP BY d.id, d.demand_date, d.client_id, d.spoc_id, d.skill, d.no_of_positions, d.status, d.priority, d.job_description_url, d.remarks, d.created_at, d.updated_at, d.required_cv_count, d.assigned_to, c.client_name, s.spoc_name
                        ORDER BY d.id DESC
                        """,
                        (team_leader_id,)
                    )
                rows = cur.fetchall()
                columns = [desc[0] for desc in cur.description]
                result = _rows_to_dicts(columns, rows)
                
                # Log CV count values for each demand
                print(f"[INFO] Found {len(result)} assigned demands")
                for demand in result:
                    demand_id = demand.get('id')
                    uploaded_count = demand.get('total_uploaded_cv_count', 0)
                    required_count = demand.get('required_cv_count', 0)
                    print(f"[CV_COUNT] Demand ID {demand_id}: {uploaded_count}/{required_count}")
                
                # For each demand, fetch the assigned recruiter names from JSON
                for demand in result:
                    if demand.get('assigned_to'):
                        try:
                            assigned_data = demand['assigned_to']
                            print(f"[DEBUG] Demand ID {demand.get('id')} - assigned_to raw: {assigned_data}, type: {type(assigned_data)}")
                            if isinstance(assigned_data, str):
                                import json
                                assigned_data = json.loads(assigned_data)
                            
                            if isinstance(assigned_data, list):
                                recruiter_ids = []
                                for item in assigned_data:
                                    if isinstance(item, dict) and 'recruiter_id' in item:
                                        recruiter_ids.append(item['recruiter_id'])
                                    elif isinstance(item, int):
                                        recruiter_ids.append(item)
                                
                                print(f"[DEBUG] Demand ID {demand.get('id')} - recruiter_ids: {recruiter_ids}")
                                if recruiter_ids:
                                    # Fetch recruiter names
                                    placeholders = ','.join(['%s'] * len(recruiter_ids))
                                    cur.execute(
                                        f"SELECT id, first_name, last_name FROM tbl_users WHERE id IN ({placeholders}) ORDER BY first_name",
                                        recruiter_ids
                                    )
                                    recruiter_info = cur.fetchall()
                                    print(f"[DEBUG] Demand ID {demand.get('id')} - recruiter_info from DB: {recruiter_info}")
                                    demand['assigned_recruiter_names'] = [f"{row[1]} {row[2]}" for row in recruiter_info]
                                    print(f"[DEBUG] Demand ID {demand.get('id')} - assigned_recruiter_names: {demand['assigned_recruiter_names']}")
                                else:
                                    demand['assigned_recruiter_names'] = []
                            else:
                                demand['assigned_recruiter_names'] = []
                        except Exception as e:
                            print(f"Error parsing assigned_to for demand {demand.get('id')}: {e}")
                            import traceback
                            traceback.print_exc()
                            demand['assigned_recruiter_names'] = []
                    else:
                        demand['assigned_recruiter_names'] = []
                
                return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch assigned demands: {e}")


@router.post("/demand/assign")
def assign_demand_to_recruiter(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Assign a demand to one or more recruiters."""
    try:
        demand_id = payload.get('demand_id')
        recruiter_ids = payload.get('recruiter_ids', [])
        
        if not demand_id:
            raise HTTPException(status_code=400, detail="demand_id is required")
        if not recruiter_ids or not isinstance(recruiter_ids, list):
            raise HTTPException(status_code=400, detail="recruiter_ids must be a non-empty list")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Create assignment data in the format: [{"recruiter_id": 1, "assigned_date": "2025-01-01"}]
                assignment_data = []
                for recruiter_id in recruiter_ids:
                    # Ensure recruiter_id is properly converted to int
                    try:
                        recruiter_id_int = int(recruiter_id)
                        assignment_data.append({
                            "recruiter_id": recruiter_id_int,
                            "assigned_date": datetime.now().strftime("%Y-%m-%d")
                        })
                    except (ValueError, TypeError) as e:
                        print(f"❌ Invalid recruiter_id: {recruiter_id}, error: {e}")
                        continue
                
                if not assignment_data:
                    raise HTTPException(status_code=400, detail="No valid recruiter IDs provided")
                
                # Debug: Print the JSON being sent
                json_data = json.dumps(assignment_data)
                print(f"🔍 JSON data being sent: {json_data}")
                
                # Update the assigned_to column with the new assignment data
                cur.execute(
                    """
                    UPDATE tbl_demand_sheet 
                    SET assigned_to = %s::jsonb, updated_at = NOW()
                    WHERE id = %s
                    """,
                    (json_data, demand_id)
                )
                
                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="Demand not found")
                
                # Fetch required_cv_count for the demand to seed activity rows
                required_count: Optional[int] = None
                try:
                    cur.execute("SELECT required_cv_count FROM tbl_demand_sheet WHERE id=%s", (demand_id,))
                    row = cur.fetchone()
                    required_count = int(row[0]) if row and row[0] is not None else 0
                except Exception:
                    required_count = 0

                # Auto-insert recruiter activity rows for each assigned recruiter (dedupe-safe)
                for item in assignment_data:
                    rid = int(item.get("recruiter_id"))
                    # Skip if an activity already exists for this recruiter+demand
                    cur.execute(
                        """
                        SELECT id FROM tbl_recruiter_activity 
                        WHERE recruiter_id=%s AND demand_id=%s
                        LIMIT 1
                        """,
                        (rid, demand_id)
                    )
                    exists = cur.fetchone()
                    if exists:
                        continue

                    cur.execute(
                        """
                        INSERT INTO tbl_recruiter_activity 
                            (recruiter_id, demand_id, activity_status, uploaded_cv_count, required_cv_count, cv_list, created_at)
                        VALUES 
                            (%s, %s, 'open', 0, %s, '[]'::jsonb, NOW())
                        """,
                        (rid, demand_id, required_count)
                    )

                conn.commit()
                
                return {
                    "success": True,
                    "message": f"Demand {demand_id} assigned to {len(recruiter_ids)} recruiter(s)",
                    "assigned_to": assignment_data
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to assign demand: {e}")


@router.get("/demand/submitted")
async def list_submitted(current_user: Dict[str, Any] = Depends(get_current_user)) -> List[Dict[str, Any]]:
    """Submitted demand sheets with profile count from tbl_recruiter_activity, filtered by logged-in TL's tl_id."""
    try:
        team_leader_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not team_leader_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    (
                        "SELECT d.*, c.client_name, s.spoc_name, "
                        "COUNT(ra.id) as profile_count "
                        "FROM tbl_demand_sheet d "
                        "LEFT JOIN tbl_clients c ON c.id = d.client_id "
                        "LEFT JOIN tbl_client_spocs s ON s.id = d.spoc_id "
                        "LEFT JOIN tbl_recruiter_activity ra ON ra.demand_id = d.id "
                        "WHERE d.tl_id = %s "
                        "  AND d.assigned_to IS NOT NULL "
                        "GROUP BY d.id, c.client_name, s.spoc_name "
                        "HAVING COUNT(ra.id) > 0 "
                        "ORDER BY d.id DESC"
                    ),
                    (team_leader_id,)
                )
                rows = cur.fetchall()
                columns = [desc[0] for desc in cur.description]
                return _rows_to_dicts(columns, rows)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch submitted demands: {e}")

@router.get("/demand/submitted/{demand_id}/profiles")
def list_submitted_profiles(demand_id: int) -> List[Dict[str, Any]]:
    """Get submitted profiles for a specific demand."""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    (
                        "SELECT ra.*, u.name as recruiter_name, u.email as recruiter_email "
                        "FROM tbl_recruiter_activity ra "
                        "LEFT JOIN tbl_users u ON u.id = ra.recruiter_id "
                        "WHERE ra.demand_id = %s AND ra.status = 'submitted' "
                        "ORDER BY ra.submitted_at DESC"
                    ),
                    (demand_id,)
                )
                rows = cur.fetchall()
                columns = [desc[0] for desc in cur.description]
                return _rows_to_dicts(columns, rows)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch submitted profiles: {e}")

@router.post("/demand/submitted/{demand_id}/action")
def submit_tl_action(demand_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Submit TL action (Accepted/Rejected) for a demand."""
    action = payload.get("action")  # "accepted" or "rejected"
    if action not in ["accepted", "rejected"]:
        raise HTTPException(status_code=400, detail="Action must be 'accepted' or 'rejected'")
    
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get demand details to extract spoc_id and skill
                cur.execute("""
                    SELECT spoc_id, skill 
                    FROM tbl_demand_sheet 
                    WHERE id = %s
                """, (demand_id,))
                demand_row = cur.fetchone()
                
                if not demand_row:
                    raise HTTPException(status_code=404, detail="Demand not found")
                
                spoc_id = demand_row[0]
                skill = demand_row[1]
                
                # Calculate submission week (week of year)
                today = date.today()
                submission_week = today.isocalendar()[1]
                
                # Set shortlisted based on action (1 for accepted, 0 for rejected)
                shortlisted = 1 if action == "accepted" else 0
                
                # Insert into tbl_submissions with correct schema
                cur.execute("""
                    INSERT INTO tbl_submissions 
                    (demand_id, spoc_id, skill, shortlisted, feedback, submission_date, submission_week, 
                     no_of_submissions, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 1, NOW(), NOW())
                """, (
                    demand_id,
                    spoc_id,
                    skill,
                    shortlisted,
                    f"Demand {action} by Team Leader",
                    today,
                    submission_week
                ))
                
                # Count only accepted submissions (shortlisted = 1) for this demand_id and update all records
                cur.execute("""
                    SELECT COUNT(*) 
                    FROM tbl_submissions 
                    WHERE demand_id = %s AND shortlisted = 1
                """, (demand_id,))
                total_submissions = cur.fetchone()[0]
                
                # Update all records for this demand_id with the same no_of_submissions value
                # This ensures all records (accepted and rejected) show the count of accepted submissions
                cur.execute("""
                    UPDATE tbl_submissions 
                    SET no_of_submissions = %s,
                        updated_at = NOW()
                    WHERE demand_id = %s
                """, (total_submissions, demand_id))
                
                conn.commit()
                return {"message": f"Demand {action} successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit TL action: {e}")


@router.post("/demand/assign")
def assign_recruiter(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Assign a recruiter to a demand by updating assigned_to and recruiter_id in tbl_demand_sheet."""
    demand_id = payload.get("demand_id")
    recruiter_id = payload.get("recruiter_id")
    if not demand_id or not recruiter_id:
        raise HTTPException(status_code=400, detail="demand_id and recruiter_id are required")

    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Update tbl_demand_sheet with assigned_to
                cur.execute(
                    "UPDATE tbl_demand_sheet SET assigned_to=%s WHERE id=%s",
                    (recruiter_id, demand_id),
                )
                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="Demand not found")
                conn.commit()
                return {"message": "Recruiter assigned"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to assign recruiter: {e}")

@router.post("/demand/assign/bulk")
def assign_recruiters_bulk(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Assign multiple recruiters to a demand."""
    demand_id = payload.get("demand_id")
    recruiters = payload.get("recruiters", [])
    if not demand_id or not recruiters:
        raise HTTPException(status_code=400, detail="demand_id and recruiters are required")

    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Create assignment data in JSON format for assigned_to column
                assignment_data = []
                for recruiter_id in recruiters:
                    try:
                        recruiter_id_int = int(recruiter_id)
                        assignment_data.append({
                            "recruiter_id": recruiter_id_int,
                            "assigned_date": datetime.now().strftime("%Y-%m-%d")
                        })
                    except (ValueError, TypeError) as e:
                        print(f"❌ Invalid recruiter_id: {recruiter_id}, error: {e}")
                        continue
                
                if not assignment_data:
                    raise HTTPException(status_code=400, detail="No valid recruiter IDs provided")
                
                # Debug: Print the JSON being sent
                json_data = json.dumps(assignment_data)
                print(f"🔍 Updating demand {demand_id} with assigned_to JSON: {json_data}")
                
                cur.execute(
                    "UPDATE tbl_demand_sheet SET assigned_to=%s::jsonb WHERE id=%s",
                    (json_data, demand_id),
                )
                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="Demand not found")
                
                # Fetch required_cv_count
                required_count: Optional[int] = None
                try:
                    cur.execute("SELECT required_cv_count FROM tbl_demand_sheet WHERE id=%s", (demand_id,))
                    row = cur.fetchone()
                    required_count = int(row[0]) if row and row[0] is not None else 0
                except Exception:
                    required_count = 0

                # Insert recruiter activity rows if missing
                for item in assignment_data:
                    rid = int(item.get("recruiter_id"))
                    cur.execute(
                        """
                        SELECT id FROM tbl_recruiter_activity 
                        WHERE recruiter_id=%s AND demand_id=%s
                        LIMIT 1
                        """,
                        (rid, demand_id)
                    )
                    if cur.fetchone():
                        continue
                    cur.execute(
                        """
                        INSERT INTO tbl_recruiter_activity 
                            (recruiter_id, demand_id, activity_status, uploaded_cv_count, required_cv_count, cv_list, created_at)
                        VALUES 
                            (%s, %s, 'open', 0, %s, '[]'::jsonb, NOW())
                        """,
                        (rid, demand_id, required_count)
                    )

                conn.commit()
                print(f"✅ Successfully updated demand {demand_id}")
                return {"message": "Recruiters assigned successfully"}
    except Exception as e:
        print(f"❌ Error assigning recruiters: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to assign recruiters: {e}")

@router.get("/test-teamleaders")
def test_team_leaders() -> Dict[str, Any]:
    """Test endpoint for team leaders."""
    return {"message": "Test endpoint working", "data": []}

@router.get("/teamleaders")
def list_team_leaders() -> List[Dict[str, Any]]:
    """Get all team leaders from tbl_users where role = team_leader."""
    try:
        print(f"[INFO] Fetching team leaders from database")
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get users with role = 'team_leader' or 'tl'
                cur.execute(
                    "SELECT id, first_name, last_name, email, role FROM tbl_users WHERE role IN ('team_leader', 'tl') ORDER BY first_name"
                )
                rows = cur.fetchall()
                print(f"[INFO] Found {len(rows)} team leaders with role='team_leader'")
                
                # If no team leaders found, get all users (for testing)
                if not rows:
                    print("[WARN] No team leaders found, fetching all users")
                    cur.execute(
                        "SELECT id, first_name, last_name, email, role FROM tbl_users ORDER BY first_name"
                    )
                    rows = cur.fetchall()
                    print(f"[INFO] Found {len(rows)} total users")
                
                # Convert rows to dictionaries manually
                result = []
                for row in rows:
                    result.append({
                        "id": row[0],
                        "first_name": row[1],
                        "last_name": row[2],
                        "email": row[3],
                        "role": row[4]
                    })
                
                print(f"[INFO] Returning {len(result)} team leaders/users")
                return result
    except Exception as e:
        print(f"[ERROR] Error fetching team leaders: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch team leaders: {e}")

@router.get("/teamleaders/{team_leader_id}/recruiters")
def list_recruiters_by_team_leader(team_leader_id: int) -> List[Dict[str, Any]]:
    """Get recruiters for a specific team leader based on reporting_to field."""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get recruiters that report to this team leader
                # Filter by reporting_to and only show approved recruiters
                cur.execute(
                    "SELECT id, first_name, last_name, email, role, reporting_to FROM tbl_users WHERE role = 'recruiter' AND reporting_to = %s AND approval_status = TRUE ORDER BY first_name",
                    (team_leader_id,)
                )
                rows = cur.fetchall()
                columns = [desc[0] for desc in cur.description]
                result = _rows_to_dicts(columns, rows)
                # Add name field for consistency
                for recruiter in result:
                    name = f"{recruiter.get('first_name', '')} {recruiter.get('last_name', '')}".strip()
                    recruiter['name'] = name if name else recruiter.get('email', 'Unknown')
                return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch recruiters: {e}")

@router.get("/users")
def list_users_by_role(role: str = None) -> List[Dict[str, Any]]:
    """Get users by role."""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                if role:
                    cur.execute(
                        "SELECT id, first_name, last_name, email, role FROM tbl_users WHERE role = %s ORDER BY first_name",
                        (role,)
                    )
                else:
                    cur.execute(
                        "SELECT id, first_name, last_name, email, role FROM tbl_users ORDER BY first_name"
                    )
                rows = cur.fetchall()
                columns = [desc[0] for desc in cur.description]
                return _rows_to_dicts(columns, rows)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {e}")


@router.get("/cv-received")
async def get_cv_received(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get CVs waiting for approval (status = 0) from tbl_recruiter_activity with aggregated CV counts, filtered by Team Leader's tl_id"""
    try:
        team_leader_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not team_leader_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Query to get CVs with status = 0 (waiting for approval) with aggregated CV counts
                # Filter by tl_id in demand sheet to ensure only this TL's demands are shown
                query = """
                    SELECT 
                        ra.id,
                        ra.recruiter_id,
                        ra.demand_id,
                        ra.uploaded_cv_count,
                        ra.required_cv_count,
                        ra.cv_list,
                        ra.activity_status,
                        ra.created_at,
                        ra.updated_at,
                        COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.first_name, u.last_name, u.email) as recruiter_name,
                        u.email as recruiter_email,
                        ds.skill,
                        ds.no_of_positions,
                        ds.status as demand_status,
                        ds.priority,
                        ds.job_description_url AS job_description_url,
                        c.client_name,
                        cs.spoc_name,
                        (
                            SELECT COALESCE(SUM(jsonb_array_length(ra_all.cv_list)), 0)
                            FROM tbl_recruiter_activity ra_all
                            WHERE ra_all.demand_id = ra.demand_id
                            AND ra_all.cv_list IS NOT NULL
                            AND jsonb_array_length(ra_all.cv_list) > 0
                        ) as total_uploaded_cv_count
                    FROM tbl_recruiter_activity ra
                    LEFT JOIN tbl_users u ON ra.recruiter_id = u.id
                    LEFT JOIN tbl_demand_sheet ds ON ra.demand_id = ds.id
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    LEFT JOIN tbl_client_spocs cs ON ds.spoc_id = cs.id
                    WHERE ds.tl_id = %s
                    AND ra.cv_list IS NOT NULL 
                    AND jsonb_array_length(ra.cv_list) > 0
                    AND EXISTS (
                        SELECT 1 FROM jsonb_array_elements(ra.cv_list) AS cv
                        WHERE cv->>'status' = '0'
                    )
                    ORDER BY ra.created_at DESC
                """
                cur.execute(query, (team_leader_id,))
                rows = cur.fetchall()
                columns = [desc[0] for desc in cur.description]
                result = _rows_to_dicts(columns, rows)
                
                # Update CV URLs in the cv_list to use proper file paths
                for row in result:
                    if row.get('cv_list'):
                        cv_list = row['cv_list']
                        if isinstance(cv_list, str):
                            try:
                                cv_list = json.loads(cv_list)
                            except:
                                cv_list = []
                        
                        if isinstance(cv_list, list):
                            for cv in cv_list:
                                if cv.get('cv_url') and not cv['cv_url'].startswith('http'):
                                    # Extract just the filename from the cv_url path
                                    original_url = cv['cv_url']
                                    if original_url.startswith("src/assets/cv_uploads/"):
                                        # Extract just the filename from the full path
                                        filename = os.path.basename(original_url)
                                    else:
                                        # It's already just a filename
                                        filename = original_url
                                    
                                    # URL encode the filename to handle spaces and special characters
                                    import urllib.parse
                                    encoded_filename = urllib.parse.quote(filename)
                                    cv['cv_url'] = f"{API_BASE_URL}/cv-file/{row['recruiter_id']}/{row['demand_id']}/{encoded_filename}" if API_BASE_URL else None
                                    # Add file availability check
                                    cv['cv_available'] = True
                                elif not cv.get('cv_url'):
                                    # If no cv_url, mark as not available
                                    cv['cv_url'] = None
                                    cv['cv_available'] = False
                                else:
                                    # Already has full URL, assume available
                                    cv['cv_available'] = True
                        
                        row['cv_list'] = cv_list
                
                return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch CV received data: {e}")


@router.post("/cv-approve/{activity_id}")
async def approve_cv(activity_id: int, request: Request, cv_index: Optional[int] = None, cv_id: Optional[str] = None):
    """Approve a CV (change status from 0 to 1) and implement enhanced Accept flow"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Start transaction
                conn.autocommit = False
                
                # Get current cv_list and activity data
                cur.execute("""
                    SELECT cv_list, demand_id, uploaded_cv_count, required_cv_count, recruiter_id
                    FROM tbl_recruiter_activity 
                    WHERE id = %s
                """, (activity_id,))
                result = cur.fetchone()
                
                if not result:
                    raise HTTPException(status_code=404, detail="Activity not found")
                
                cv_list, demand_id, uploaded_cv_count, required_cv_count, recruiter_id = result
                # Normalize cv_list
                if isinstance(cv_list, (bytes, bytearray)):
                    cv_list = cv_list.decode("utf-8")
                if isinstance(cv_list, str):
                    try:
                        cv_list = json.loads(cv_list)
                    except Exception:
                        cv_list = []
                if not isinstance(cv_list, list):
                    cv_list = []
                
                # Find target CV either by cv_id or index
                target_index: Optional[int] = None
                if cv_id is not None:
                    for i, cv in enumerate(cv_list):
                        try:
                            if str(cv.get('candidate_id')) == str(cv_id):
                                target_index = i
                                break
                        except Exception:
                            continue
                # Fallback to body if query missing
                if target_index is None and cv_index is None:
                    try:
                        body = await request.json()
                        body_idx = body.get('cv_index') if isinstance(body, dict) else None
                        if body_idx is not None:
                            cv_index = int(body_idx)
                    except Exception:
                        pass
                if target_index is None and cv_index is not None:
                    target_index = cv_index
                if target_index is None or target_index < 0 or target_index >= len(cv_list):
                    raise HTTPException(status_code=404, detail="CV not found for update")

                # Step 1: Update JSON Field (cv_list) - Update status to 1
                updated_cv_list = []
                for i, cv in enumerate(cv_list):
                    cv_dict = dict(cv)
                    if i == target_index:
                        cv_dict['status'] = 1
                        # Set Team Leader action date (tl_date) when status changes to 1 (submitted)
                        from datetime import date
                        cv_dict['tl_date'] = date.today().isoformat()
                        # Set Team Leader action date (tl_date) when status changes to 1 (submitted)
                        from datetime import date
                        cv_dict['tl_date'] = date.today().isoformat()
                    updated_cv_list.append(cv_dict)
                
                # Update the cv_list for the current activity
                cur.execute("""
                    UPDATE tbl_recruiter_activity 
                    SET cv_list = %s, updated_at = now()
                    WHERE id = %s AND recruiter_id = %s
                """, (json.dumps(updated_cv_list), activity_id, recruiter_id))
                
                # Step 2: Increase approved_cv_count by 1 for all recruiters with same demand_id
                cur.execute("""
                    UPDATE tbl_recruiter_activity
                    SET approved_cv_count = COALESCE(approved_cv_count, 0) + 1, updated_at = now()
                    WHERE demand_id = %s
                """, (demand_id,))
                
                # Step 3: Auto Close Demand (if complete)
                # Check if approved_cv_count >= required_cv_count
                # Get the current approved_cv_count from tbl_recruiter_activity
                cur.execute("""
                    SELECT approved_cv_count, required_cv_count
                    FROM tbl_recruiter_activity 
                    WHERE demand_id = %s
                    ORDER BY id DESC LIMIT 1
                """, (demand_id,))
                
                activity_result = cur.fetchone()
                if activity_result:
                    approved_count, required_count = activity_result
                    if approved_count and required_count and approved_count >= required_count:
                        # Update demand status to 'closed'
                        cur.execute("""
                            UPDATE tbl_demand_sheet
                            SET status = 'closed', updated_at = now()
                            WHERE id = %s
                        """, (demand_id,))
                        
                        # Also update activity_status to 'closed' for all recruiters
                        cur.execute("""
                            UPDATE tbl_recruiter_activity
                            SET activity_status = 'closed', updated_at = now()
                            WHERE demand_id = %s
                        """, (demand_id,))
                
                conn.commit()
                return {
                    "message": "CV approved successfully",
                    "demand_id": demand_id,
                    "approved_count": approved_count if activity_result else 0,
                    "required_count": required_count if activity_result else 0,
                    "demand_closed": activity_result and approved_count and required_count and approved_count >= required_count
                }
                
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to approve CV: {e}")


@router.post("/cv-reject/{activity_id}")
async def reject_cv(activity_id: int, request: Request, cv_index: Optional[int] = None, cv_id: Optional[str] = None):
    """Reject a CV (change status from 0 to 2) and implement enhanced Reject flow"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Start transaction
                conn.autocommit = False
                
                # Get current cv_list and activity data
                cur.execute("""
                    SELECT cv_list, demand_id, uploaded_cv_count, required_cv_count, recruiter_id, activity_status
                    FROM tbl_recruiter_activity 
                    WHERE id = %s
                """, (activity_id,))
                result = cur.fetchone()
                
                if not result:
                    raise HTTPException(status_code=404, detail="Activity not found")
                
                cv_list, demand_id, uploaded_cv_count, required_cv_count, recruiter_id, activity_status = result
                # Normalize cv_list
                if isinstance(cv_list, (bytes, bytearray)):
                    cv_list = cv_list.decode("utf-8")
                if isinstance(cv_list, str):
                    try:
                        cv_list = json.loads(cv_list)
                    except Exception:
                        cv_list = []
                if not isinstance(cv_list, list):
                    cv_list = []
                
                # Find target CV either by cv_id or index
                target_index: Optional[int] = None
                if cv_id is not None:
                    for i, cv in enumerate(cv_list):
                        try:
                            if str(cv.get('candidate_id')) == str(cv_id):
                                target_index = i
                                break
                        except Exception:
                            continue
                # Fallback to body if query missing
                if target_index is None and cv_index is None:
                    try:
                        body = await request.json()
                        body_idx = body.get('cv_index') if isinstance(body, dict) else None
                        if body_idx is not None:
                            cv_index = int(body_idx)
                    except Exception:
                        pass
                if target_index is None and cv_index is not None:
                    target_index = cv_index
                if target_index is None or target_index < 0 or target_index >= len(cv_list):
                    raise HTTPException(status_code=404, detail="CV not found for update")

                # Step 1: Update JSON Field (cv_list) - Update status to 2
                updated_cv_list = []
                for i, cv in enumerate(cv_list):
                    cv_dict = dict(cv)
                    if i == target_index:
                        cv_dict['status'] = 2
                    updated_cv_list.append(cv_dict)
                
                # Update the cv_list for the current activity
                cur.execute("""
                    UPDATE tbl_recruiter_activity 
                    SET cv_list = %s, updated_at = now()
                    WHERE id = %s AND recruiter_id = %s
                """, (json.dumps(updated_cv_list), activity_id, recruiter_id))

                # Step 2: Decrease uploaded_cv_count by 1 for all recruiters with same demand_id
                cur.execute("""
                    UPDATE tbl_recruiter_activity
                    SET uploaded_cv_count = GREATEST(COALESCE(uploaded_cv_count, 0) - 1, 0), updated_at = now()
                    WHERE demand_id = %s
                """, (demand_id,))
                
                # Step 3: Update Recruiter Activity Status (if needed)
                # Check if uploaded_cv_count < required_cv_count after decrease
                cur.execute("""
                    SELECT uploaded_cv_count, required_cv_count
                    FROM tbl_recruiter_activity 
                    WHERE demand_id = %s
                    ORDER BY id DESC LIMIT 1
                """, (demand_id,))
                
                result = cur.fetchone()
                if result:
                    current_uploaded, current_required = result
                    if current_uploaded and current_required and current_uploaded < current_required:
                        # Update activity_status to 'hold' for all recruiters of this demand
                        cur.execute("""
                            UPDATE tbl_recruiter_activity
                            SET activity_status = 'hold', updated_at = now()
                            WHERE demand_id = %s
                        """, (demand_id,))
                        
                        # Update demand status to 'open'
                        cur.execute("""
                            UPDATE tbl_demand_sheet
                            SET status = 'open', updated_at = now()
                            WHERE id = %s
                        """, (demand_id,))
                
                conn.commit()
                return {
                    "message": "CV rejected successfully",
                    "demand_id": demand_id,
                    "uploaded_count": current_uploaded if result else 0,
                    "required_count": current_required if result else 0,
                    "activity_status_updated": result and current_uploaded and current_required and current_uploaded < current_required
                }
                
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to reject CV: {e}")


@router.get("/recruiter-activity/{activity_id}/profiles")
async def get_activity_profiles(activity_id: int):
    """Get CV profiles for a specific recruiter activity"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 
                        ra.id,
                        ra.recruiter_id,
                        ra.demand_id,
                        ra.cv_list,
                        ra.uploaded_cv_count,
                        ra.required_cv_count,
                        COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.first_name, u.last_name, u.email) as recruiter_name,
                        u.email as recruiter_email,
                        ds.skill,
                        c.client_name,
                        cs.spoc_name
                    FROM tbl_recruiter_activity ra
                    LEFT JOIN tbl_users u ON ra.recruiter_id = u.id
                    LEFT JOIN tbl_demand_sheet ds ON ra.demand_id = ds.id
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    LEFT JOIN tbl_client_spocs cs ON ds.spoc_id = cs.id
                    WHERE ra.id = %s
                """, (activity_id,))
                
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="Activity not found")
                
                columns = [desc[0] for desc in cur.description]
                result = dict(zip(columns, row))
                
                # Parse cv_list if it's a string
                cv_list = result.get('cv_list', [])
                if isinstance(cv_list, str):
                    try:
                        cv_list = json.loads(cv_list)
                    except:
                        cv_list = []
                elif cv_list is None:
                    cv_list = []
                
                # Transform cv_list to match frontend expectations
                profiles = []
                for cv in cv_list:
                    # Check if there's a nested 'candidate' object
                    candidate_obj = cv.get('candidate', {})
                    if not isinstance(candidate_obj, dict):
                        candidate_obj = {}
                    
                    # Handle both 'remark' and 'remarks' (some entries use plural)
                    remark = (cv.get('remark') or 
                             cv.get('remarks') or 
                             candidate_obj.get('remark') or 
                             candidate_obj.get('remarks') or 
                             '')
                    
                    # Handle different field names for CV URL
                    # Check multiple possible field names for file/URL
                    cv_url = (cv.get('cv_url') or 
                             cv.get('file_path') or 
                             cv.get('path') or 
                             cv.get('file') or 
                             cv.get('file_name') or '')
                    
                    # Build file path if we have file info but no URL
                    if not cv_url.startswith('http') and not cv_url.startswith('/'):
                        filename = cv.get('file') or cv.get('file_name') or ''
                        if filename:
                            import urllib.parse
                            # Ensure filename doesn't have path separators
                            filename = os.path.basename(filename)
                            encoded_filename = urllib.parse.quote(filename, safe='')
                            # Router prefix is /api, so endpoint is /api/cv-file/...
                            cv_url = f"{API_BASE_URL}/api/cv-file/{result['recruiter_id']}/{result['demand_id']}/{encoded_filename}" if API_BASE_URL else None
                    
                    # Get candidate info from multiple possible locations
                    candidate_name = (cv.get('candidate_name') or 
                                    candidate_obj.get('candidate_name') or 
                                    candidate_obj.get('name') or
                                    cv.get('file') or 
                                    cv.get('file_name') or 
                                    'Unknown')
                    
                    candidate_email = (cv.get('candidate_email') or 
                                      cv.get('email') or
                                      candidate_obj.get('candidate_email') or 
                                      candidate_obj.get('email') or 
                                      '')
                    
                    candidate_phone = (cv.get('candidate_phone') or 
                                      cv.get('phone') or
                                      candidate_obj.get('candidate_phone') or 
                                      candidate_obj.get('phone') or 
                                      '')
                    
                    profile = {
                        'recruiter_name': result.get('recruiter_name', ''),
                        'recruiter_email': result.get('recruiter_email', ''),
                        'profile_name': candidate_name,
                        'candidate_name': candidate_name,
                        'candidate_email': candidate_email,
                        'candidate_phone': candidate_phone,
                        'remark': remark,
                        'cv_url': cv_url,
                        'status': cv.get('status') or candidate_obj.get('status') or 0,
                        'upload_date': cv.get('upload_date') or cv.get('uploaded_at') or cv.get('time') or cv.get('timestamp', '')
                    }
                    
                    # Update CV URLs to use proper file paths (if not already set above)
                    if profile['cv_url'] and not profile['cv_url'].startswith('http') and not profile['cv_url'].startswith('/'):
                        original_url = profile['cv_url']
                        if original_url.startswith("src/assets/cv_uploads/"):
                            filename = os.path.basename(original_url)
                        else:
                            filename = original_url
                        
                        import urllib.parse
                        # Ensure filename doesn't have path separators
                        filename = os.path.basename(filename)
                        encoded_filename = urllib.parse.quote(filename, safe='')
                        # Router prefix is /api, so endpoint is /api/cv-file/...
                        profile['cv_url'] = f"{API_BASE_URL}/api/cv-file/{result['recruiter_id']}/{result['demand_id']}/{encoded_filename}" if API_BASE_URL else None
                    
                    profiles.append(profile)
                
                # Return profiles array with recruiter info included
                return profiles
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch activity profiles: {e}")


@router.get("/recruiter-activity/{activity_id}/profiles")
async def get_activity_profiles(activity_id: int):
    """Get CV profiles for a specific recruiter activity"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 
                        ra.id,
                        ra.recruiter_id,
                        ra.demand_id,
                        ra.cv_list,
                        ra.uploaded_cv_count,
                        ra.required_cv_count,
                        COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.first_name, u.last_name, u.email) as recruiter_name,
                        u.email as recruiter_email,
                        ds.skill,
                        c.client_name,
                        cs.spoc_name
                    FROM tbl_recruiter_activity ra
                    LEFT JOIN tbl_users u ON ra.recruiter_id = u.id
                    LEFT JOIN tbl_demand_sheet ds ON ra.demand_id = ds.id
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    LEFT JOIN tbl_client_spocs cs ON ds.spoc_id = cs.id
                    WHERE ra.id = %s
                """, (activity_id,))
                
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="Activity not found")
                
                columns = [desc[0] for desc in cur.description]
                result = dict(zip(columns, row))
                
                # Parse cv_list if it's a string
                cv_list = result.get('cv_list', [])
                if isinstance(cv_list, str):
                    try:
                        cv_list = json.loads(cv_list)
                    except:
                        cv_list = []
                elif cv_list is None:
                    cv_list = []
                
                # Transform cv_list to match frontend expectations
                profiles = []
                for cv in cv_list:
                    # Check if there's a nested 'candidate' object
                    candidate_obj = cv.get('candidate', {})
                    if not isinstance(candidate_obj, dict):
                        candidate_obj = {}
                    
                    # Handle both 'remark' and 'remarks' (some entries use plural)
                    remark = (cv.get('remark') or 
                             cv.get('remarks') or 
                             candidate_obj.get('remark') or 
                             candidate_obj.get('remarks') or 
                             '')
                    
                    # Handle different field names for CV URL
                    # Check multiple possible field names for file/URL
                    cv_url = (cv.get('cv_url') or 
                             cv.get('file_path') or 
                             cv.get('path') or 
                             cv.get('file') or 
                             cv.get('file_name') or '')
                    
                    # Build file path if we have file info but no URL
                    if not cv_url.startswith('http') and not cv_url.startswith('/'):
                        filename = cv.get('file') or cv.get('file_name') or ''
                        if filename:
                            import urllib.parse
                            # Ensure filename doesn't have path separators
                            filename = os.path.basename(filename)
                            encoded_filename = urllib.parse.quote(filename, safe='')
                            # Router prefix is /api, so endpoint is /api/cv-file/...
                            cv_url = f"{API_BASE_URL}/api/cv-file/{result['recruiter_id']}/{result['demand_id']}/{encoded_filename}" if API_BASE_URL else None
                    
                    # Get candidate info from multiple possible locations
                    candidate_name = (cv.get('candidate_name') or 
                                    candidate_obj.get('candidate_name') or 
                                    candidate_obj.get('name') or
                                    cv.get('file') or 
                                    cv.get('file_name') or 
                                    'Unknown')
                    
                    candidate_email = (cv.get('candidate_email') or 
                                      cv.get('email') or
                                      candidate_obj.get('candidate_email') or 
                                      candidate_obj.get('email') or 
                                      '')
                    
                    candidate_phone = (cv.get('candidate_phone') or 
                                      cv.get('phone') or
                                      candidate_obj.get('candidate_phone') or 
                                      candidate_obj.get('phone') or 
                                      '')
                    
                    profile = {
                        'recruiter_name': result.get('recruiter_name', ''),
                        'recruiter_email': result.get('recruiter_email', ''),
                        'profile_name': candidate_name,
                        'candidate_name': candidate_name,
                        'candidate_email': candidate_email,
                        'candidate_phone': candidate_phone,
                        'remark': remark,
                        'cv_url': cv_url,
                        'status': cv.get('status') or candidate_obj.get('status') or 0,
                        'upload_date': cv.get('upload_date') or cv.get('uploaded_at') or cv.get('time') or cv.get('timestamp', '')
                    }
                    
                    # Update CV URLs to use proper file paths (if not already set above)
                    if profile['cv_url'] and not profile['cv_url'].startswith('http') and not profile['cv_url'].startswith('/'):
                        original_url = profile['cv_url']
                        if original_url.startswith("src/assets/cv_uploads/"):
                            filename = os.path.basename(original_url)
                        else:
                            filename = original_url
                        
                        import urllib.parse
                        # Ensure filename doesn't have path separators
                        filename = os.path.basename(filename)
                        encoded_filename = urllib.parse.quote(filename, safe='')
                        # Router prefix is /api, so endpoint is /api/cv-file/...
                        profile['cv_url'] = f"{API_BASE_URL}/api/cv-file/{result['recruiter_id']}/{result['demand_id']}/{encoded_filename}" if API_BASE_URL else None
                    
                    profiles.append(profile)
                
                # Return profiles array with recruiter info included
                return profiles
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch activity profiles: {e}")


@router.get("/cv-submitted")
async def get_cv_submitted(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Get submitted CVs (status = 1) for the Submitted tab, filtered by Team Leader.
    
    Requirements:
    - Fetch from tbl_recruiter_activity
    - Only records where cv_list status key = 1 (submitted CVs)
    - Join with tbl_demand_sheet using demand_id
    - Filter using tl_id = logged_in_tl_id
    """
    try:
        team_leader_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not team_leader_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Query to get submitted CVs (status = 1) from tbl_recruiter_activity
                # Join with tbl_demand_sheet using demand_id
                # Filter by tl_id = logged_in_tl_id
                # Only include records where cv_list contains at least one CV with status = 1
                cur.execute("""
                    SELECT 
                        ra.id,
                        ra.recruiter_id,
                        ra.demand_id,
                        ra.uploaded_cv_count,
                        ra.required_cv_count,
                        ra.cv_list,
                        ra.activity_status,
                        ra.created_at,
                        ra.updated_at,
                        COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.first_name, u.last_name, u.email) as recruiter_name,
                        u.email as recruiter_email,
                        ds.skill,
                        ds.no_of_positions,
                        ds.status as demand_status,
                        ds.priority,
                        ds.job_description_url AS job_description_url,
                        c.client_name,
                        cs.spoc_name,
                        (
                            SELECT COALESCE(SUM(jsonb_array_length(ra_all.cv_list)), 0)
                            FROM tbl_recruiter_activity ra_all
                            WHERE ra_all.demand_id = ra.demand_id
                            AND ra_all.cv_list IS NOT NULL
                            AND jsonb_array_length(ra_all.cv_list) > 0
                        ) as total_uploaded_cv_count
                    FROM tbl_recruiter_activity ra
                    INNER JOIN tbl_demand_sheet ds ON ra.demand_id = ds.id
                    LEFT JOIN tbl_users u ON ra.recruiter_id = u.id
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    LEFT JOIN tbl_client_spocs cs ON ds.spoc_id = cs.id
                    WHERE ds.tl_id = %s
                    AND ra.cv_list IS NOT NULL 
                    AND jsonb_array_length(ra.cv_list) > 0
                    AND EXISTS (
                        SELECT 1 FROM jsonb_array_elements(ra.cv_list) AS cv
                        WHERE cv->>'status' = '1'
                    )
                    ORDER BY ra.updated_at DESC
                """, (team_leader_id,))
                rows = cur.fetchall()
                columns = [desc[0] for desc in cur.description]
                result = _rows_to_dicts(columns, rows)
                
                # Update CV URLs in the cv_list and filter to only show CVs with status = 1
                # Note: We show ALL submitted CVs (status = 1), regardless of whether they're in tbl_submissions
                # The Submitted tab should display all submitted profiles
                filtered_result = []
                for row in result:
                    if row.get('cv_list'):
                        cv_list = row['cv_list']
                        if isinstance(cv_list, str):
                            try:
                                cv_list = json.loads(cv_list)
                            except:
                                cv_list = []
                        
                        if isinstance(cv_list, list):
                            filtered_cv_list = []
                            for cv in cv_list:
                                # Only include CVs with status = 1 (submitted CVs)
                                if cv.get('status') == 1 or cv.get('status') == '1':
                                    # Update CV URL if needed
                                    if cv.get('cv_url') and not cv['cv_url'].startswith('http'):
                                        # Extract just the filename from the cv_url path
                                        original_url = cv['cv_url']
                                        if original_url.startswith("src/assets/cv_uploads/"):
                                            # Extract just the filename from the full path
                                            filename = os.path.basename(original_url)
                                        else:
                                            # It's already just a filename
                                            filename = original_url
                                        
                                        # URL encode the filename to handle spaces and special characters
                                        import urllib.parse
                                        encoded_filename = urllib.parse.quote(filename)
                                        cv['cv_url'] = f"{API_BASE_URL}/cv-file/{row['recruiter_id']}/{row['demand_id']}/{encoded_filename}" if API_BASE_URL else None
                                        # Add file availability check
                                        cv['cv_available'] = True
                                    elif not cv.get('cv_url'):
                                        # If no cv_url, mark as not available
                                        cv['cv_url'] = None
                                        cv['cv_available'] = False
                                    else:
                                        # Already has full URL, assume available
                                        cv['cv_available'] = True
                                    
                                    filtered_cv_list.append(cv)
                            
                            # Only include the row if there are submitted CVs (status = 1)
                            if filtered_cv_list:
                                row['cv_list'] = filtered_cv_list
                                filtered_result.append(row)
                    else:
                        # No cv_list, skip this row
                        pass
                
                return filtered_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch submitted CVs: {e}")


@router.get("/cv-file/{recruiter_id}/{demand_id}/{filename:path}")
async def get_cv_file(recruiter_id: int, demand_id: int, filename: str):
    """Serve CV files with proper error handling"""
    try:
        # Construct the file path - fix the path construction
        # Go up from backend/app/routes to project root, then to src/assets/cv_uploads
        cv_uploads_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "src", "assets", "cv_uploads")
        
        # Alternative path construction for better reliability
        alt_cv_uploads_path = os.path.join(os.path.dirname(__file__), "..", "..", "src", "assets", "cv_uploads")
        
        # Use the path that actually exists
        if os.path.exists(cv_uploads_path):
            base_path = cv_uploads_path
        elif os.path.exists(alt_cv_uploads_path):
            base_path = alt_cv_uploads_path
        else:
            # Try absolute path construction
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
            base_path = os.path.join(project_root, "src", "assets", "cv_uploads")
        
        # Check if filename already contains the full path
        if filename.startswith("src/assets/cv_uploads/"):
            # Extract just the filename from the full path
            filename = os.path.basename(filename)
        
        file_path = os.path.join(base_path, str(recruiter_id), str(demand_id), filename)
        
        # Debug: Print paths for troubleshooting
        print(f"[INFO] CV File Request Debug:")
        print(f"   Recruiter ID: {recruiter_id}")
        print(f"   Demand ID: {demand_id}")
        print(f"   Filename: {filename}")
        print(f"   Base CV Uploads Path: {base_path}")
        print(f"   Full File Path: {file_path}")
        print(f"   Base Path Exists: {os.path.exists(base_path)}")
        print(f"   File Exists: {os.path.exists(file_path)}")
        
        # Check if CV uploads directory exists
        if not os.path.exists(base_path):
            print(f"[ERROR] CV uploads directory not found: {base_path}")
            raise HTTPException(status_code=404, detail=f"CV uploads directory not found: {base_path}")
        
        # Check if file exists
        if not os.path.exists(file_path):
            print(f"[ERROR] CV file not found: {file_path}")
            raise HTTPException(status_code=404, detail=f"CV file not found: {file_path}")
        
        # Check if it's a file (not a directory)
        if not os.path.isfile(file_path):
            print(f"[ERROR] Path is not a file: {file_path}")
            raise HTTPException(status_code=404, detail="CV file not found")
        
        # Determine content type based on file extension
        file_extension = os.path.splitext(filename)[1].lower()
        if file_extension == ".pdf":
            media_type = "application/pdf"
        elif file_extension in [".doc", ".docx"]:
            media_type = "application/msword"
        else:
            media_type = "application/octet-stream"
        
        print(f"[INFO] Serving CV file: {file_path}")
        return FileResponse(
            path=file_path,
            media_type=media_type,
            filename=filename,
            headers={"Content-Disposition": f"inline; filename={filename}"}
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Error serving CV file: {e}")
        raise HTTPException(status_code=500, detail=f"Error serving CV file: {e}")


@router.post("/demand/{demand_id}/status")
async def update_demand_status(
    demand_id: int,
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Update demand status and spoc_remark - accessible by Team Leaders"""
    try:
        status = payload.get("status")
        spoc_remark = payload.get("spoc_remark")
        
        if not status:
            raise HTTPException(status_code=400, detail="Status is required")
        
        # Map UI status to database status
        status_map = {
            'open': 'open',
            'hold': 'on_hold',
            'close': 'closed',
            'cancel': 'rejected'
        }
        db_status = status_map.get(status.lower(), status.lower())
        
        if db_status not in ['open', 'in_progress', 'closed', 'on_hold', 'rejected']:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Check if demand exists
                cur.execute("SELECT id FROM tbl_demand_sheet WHERE id = %s", (demand_id,))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Demand not found")
                
                # Build update query
                update_fields = ["status = %s", "updated_at = NOW()"]
                params = [db_status]
                
                if spoc_remark is not None:
                    update_fields.append("spoc_remark = %s")
                    params.append(spoc_remark)
                
                params.append(demand_id)
                
                update_query = f"""
                    UPDATE tbl_demand_sheet SET 
                        {', '.join(update_fields)}
                    WHERE id = %s
                """
                
                cur.execute(update_query, params)
                
                # Update activity_status in tbl_recruiter_activity based on status
                if db_status.lower() == 'open':
                    cur.execute("""
                        UPDATE tbl_recruiter_activity 
                        SET activity_status = 'open', updated_at = NOW()
                        WHERE demand_id = %s
                    """, (demand_id,))
                else:
                    cur.execute("""
                        UPDATE tbl_recruiter_activity 
                        SET activity_status = 'closed', updated_at = NOW()
                        WHERE demand_id = %s
                    """, (demand_id,))
                
                conn.commit()
                
                return {"message": "Demand status updated successfully"}
                
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"Failed to update demand status: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR in update_demand_status: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Failed to update demand status: {str(e)}")


@router.get("/cv-files-list")
async def list_cv_files():
    """List available CV files for debugging"""
    try:
        # Try multiple path constructions
        cv_uploads_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "src", "assets", "cv_uploads")
        alt_cv_uploads_path = os.path.join(os.path.dirname(__file__), "..", "..", "src", "assets", "cv_uploads")
        
        # Use the path that actually exists
        if os.path.exists(cv_uploads_path):
            base_path = cv_uploads_path
        elif os.path.exists(alt_cv_uploads_path):
            base_path = alt_cv_uploads_path
        else:
            # Try absolute path construction
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
            base_path = os.path.join(project_root, "src", "assets", "cv_uploads")
        
        if not os.path.exists(base_path):
            return {"error": f"CV uploads directory not found: {base_path}"}
        
        files_list = []
        for root, dirs, files in os.walk(base_path):
            for file in files:
                rel_path = os.path.relpath(os.path.join(root, file), base_path)
                files_list.append({
                    "path": rel_path,
                    "full_path": os.path.join(root, file),
                    "exists": os.path.exists(os.path.join(root, file))
                })
        
        return {
            "cv_uploads_path": base_path,
            "files": files_list,
            "total_files": len(files_list)
        }
        
    except Exception as e:
        return {"error": f"Error listing CV files: {e}"}


@router.get("/cv-file-exists/{recruiter_id}/{demand_id}/{filename:path}")
async def check_cv_file_exists(recruiter_id: int, demand_id: int, filename: str):
    """Check if a CV file exists without serving it"""
    try:
        # Construct the file path - same logic as get_cv_file
        cv_uploads_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "src", "assets", "cv_uploads")
        alt_cv_uploads_path = os.path.join(os.path.dirname(__file__), "..", "..", "src", "assets", "cv_uploads")
        
        # Use the path that actually exists
        if os.path.exists(cv_uploads_path):
            base_path = cv_uploads_path
        elif os.path.exists(alt_cv_uploads_path):
            base_path = alt_cv_uploads_path
        else:
            # Try absolute path construction
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
            base_path = os.path.join(project_root, "src", "assets", "cv_uploads")
        
        # Check if filename already contains the full path
        if filename.startswith("src/assets/cv_uploads/"):
            # Extract just the filename from the full path
            filename = os.path.basename(filename)
        
        file_path = os.path.join(base_path, str(recruiter_id), str(demand_id), filename)
        
        # Check if CV uploads directory exists
        if not os.path.exists(base_path):
            return {"exists": False, "error": f"CV uploads directory not found: {base_path}"}
        
        # Check if file exists and is a file
        file_exists = os.path.exists(file_path) and os.path.isfile(file_path)
        
        return {
            "exists": file_exists,
            "recruiter_id": recruiter_id,
            "demand_id": demand_id,
            "filename": filename,
            "file_path": file_path
        }
        
    except Exception as e:
        return {"exists": False, "error": f"Error checking CV file: {e}"}


# ============================================
# Team Leader Dashboard Endpoints
# ============================================

@router.get("/teamleader/dashboard/key-highlights")
async def get_key_highlights(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get key highlights: Total Submissions and Current Demand count with optional date filtering
    Date filter applies to CV entries based on recruiter_date field (fallback to legacy cv_date) in cv_list, or falls back to activity updated_at
    """
    try:
        team_leader_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not team_leader_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        # Build date filter conditions - use recruiter_date (or legacy cv_date) if available, otherwise fallback to updated_at
        date_filter = ""
        date_params = []
        if start_date and end_date:
            date_filter = """
                AND (
                    (NULLIF(COALESCE(cv->>'recruiter_date', cv->>'cv_date'), '') IS NOT NULL 
                     AND (COALESCE(cv->>'recruiter_date', cv->>'cv_date')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' 
                     AND (COALESCE(cv->>'recruiter_date', cv->>'cv_date'))::date BETWEEN %s AND %s)
                    OR 
                    (NULLIF(COALESCE(cv->>'recruiter_date', cv->>'cv_date'), '') IS NULL 
                     AND DATE(ra.updated_at) BETWEEN %s AND %s)
                )
            """
            date_params = [start_date, end_date, start_date, end_date]
        elif start_date:
            date_filter = """
                AND (
                    (NULLIF(COALESCE(cv->>'recruiter_date', cv->>'cv_date'), '') IS NOT NULL 
                     AND (COALESCE(cv->>'recruiter_date', cv->>'cv_date')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' 
                     AND (COALESCE(cv->>'recruiter_date', cv->>'cv_date'))::date >= %s)
                    OR 
                    (NULLIF(COALESCE(cv->>'recruiter_date', cv->>'cv_date'), '') IS NULL 
                     AND DATE(ra.updated_at) >= %s)
                )
            """
            date_params = [start_date, start_date]
        elif end_date:
            date_filter = """
                AND (
                    (NULLIF(COALESCE(cv->>'recruiter_date', cv->>'cv_date'), '') IS NOT NULL 
                     AND (COALESCE(cv->>'recruiter_date', cv->>'cv_date')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' 
                     AND (COALESCE(cv->>'recruiter_date', cv->>'cv_date'))::date <= %s)
                    OR 
                    (NULLIF(COALESCE(cv->>'recruiter_date', cv->>'cv_date'), '') IS NULL 
                     AND DATE(ra.updated_at) <= %s)
                )
            """
            date_params = [end_date, end_date]
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get demand_ids and recruiter_ids based on tl_id (not reporting_to)
                demand_ids, recruiter_ids = _get_tl_demand_and_recruiter_ids(cur, team_leader_id)
                
                print(f"DEBUG: Team leader ID: {team_leader_id}, Found {len(demand_ids)} demands, {len(recruiter_ids)} recruiters")
                
                # Total Submissions: Count total number of CVs with status = 1 (submitted) within date range
                total_submissions = 0
                if recruiter_ids and demand_ids:
                    # Build the query with proper parameter handling
                    # Check for status = 1 (can be stored as integer 1 or string '1')
                    # Handle both integer and string representations safely
                    if date_params:
                        query = f"""
                            SELECT COALESCE(SUM(
                                (SELECT COUNT(*) 
                                 FROM jsonb_array_elements(ra.cv_list) AS cv
                                 WHERE (
                                     cv->>'status' = '1' 
                                     OR (cv->>'status') ~ '^[0-9]+$' AND (cv->>'status')::int = 1
                                 )
                                 {date_filter}) 
                            ), 0) as total_count
                            FROM tbl_recruiter_activity ra
                            WHERE ra.recruiter_id = ANY(%s)
                            AND ra.demand_id = ANY(%s)
                            AND ra.cv_list IS NOT NULL
                            AND jsonb_array_length(ra.cv_list) > 0
                        """
                        params = [recruiter_ids, demand_ids] + date_params
                    else:
                        query = """
                            SELECT COALESCE(SUM(
                                (SELECT COUNT(*) 
                                 FROM jsonb_array_elements(ra.cv_list) AS cv
                                 WHERE (
                                     cv->>'status' = '1' 
                                     OR (cv->>'status') ~ '^[0-9]+$' AND (cv->>'status')::int = 1
                                 ))
                            ), 0) as total_count
                            FROM tbl_recruiter_activity ra
                            WHERE ra.recruiter_id = ANY(%s)
                            AND ra.demand_id = ANY(%s)
                            AND ra.cv_list IS NOT NULL
                            AND jsonb_array_length(ra.cv_list) > 0
                        """
                        params = [recruiter_ids, demand_ids]
                    cur.execute(query, params)
                    result = cur.fetchone()
                    total_submissions = result[0] if result else 0
                    print(f"DEBUG: Total submissions query result: {total_submissions}")
                else:
                    print("DEBUG: No recruiters found, total_submissions will be 0")
                
                # Current Demand: Count distinct demands created by this TL
                # Note: Current demand count doesn't use date filtering as it's a snapshot of active demands
                current_demand = len(demand_ids) if demand_ids else 0
                print(f"DEBUG: Current demand count: {current_demand}")
                
                # Number of Recruiters: Count recruiters reporting to this team leader (based on reporting_to, not demand assignment)
                cur.execute("""
                    SELECT COUNT(*) FROM tbl_users 
                    WHERE role = 'recruiter' AND reporting_to = %s
                """, (team_leader_id,))
                result = cur.fetchone()
                number_of_recruiters = result[0] if result else 0
                print(f"DEBUG: Number of recruiters (reporting_to): {number_of_recruiters}")
                
                return {
                    "total_submissions": total_submissions,
                    "current_demand": current_demand,
                    "number_of_recruiters": number_of_recruiters
                }
                
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"Failed to fetch key highlights: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR in get_key_highlights: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch key highlights: {str(e)}")


@router.get("/teamleader/dashboard/daily-submissions-trend")
async def get_daily_submissions_trend(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get daily submissions trend grouped by date with recruiter details.
    Only considers records where status = 1 (Team Leader has submitted the profile).
    Uses cv_date field from cv_list column to group data by date.
    """
    try:
        team_leader_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not team_leader_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get demand_ids and recruiter_ids based on tl_id (not reporting_to)
                demand_ids, recruiter_ids = _get_tl_demand_and_recruiter_ids(cur, team_leader_id)
                
                # Get recruiter names for display
                recruiter_data = {}
                if recruiter_ids:
                    cur.execute("""
                        SELECT id, COALESCE(NULLIF(TRIM(first_name || ' ' || last_name), ''), first_name, last_name, email) as name
                        FROM tbl_users 
                        WHERE id = ANY(%s)
                    """, (recruiter_ids,))
                    recruiter_rows = cur.fetchall()
                    recruiter_data = {row[0]: row[1] for row in recruiter_rows}
                
                print(f"DEBUG: Team Leader ID: {team_leader_id}")
                print(f"DEBUG: Found {len(demand_ids)} demands, {len(recruiter_ids)} recruiters: {recruiter_ids}")
                
                if not recruiter_ids or not demand_ids:
                    print("DEBUG: No recruiters or demands found for this team leader")
                    return {"daily_trend": []}
                
                # Build date filter for WHERE clause - use recruiter_date (or legacy cv_date) if available, otherwise fallback to updated_at
                # Handle NULL and invalid date formats properly using NULLIF to prevent casting errors
                where_date_filter = ""
                where_date_params = []
                if start_date and end_date:
                    where_date_filter = """
                        AND (
                            (NULLIF(COALESCE(cv->>'recruiter_date', cv->>'cv_date'), '') IS NOT NULL 
                             AND (COALESCE(cv->>'recruiter_date', cv->>'cv_date')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' 
                             AND (COALESCE(cv->>'recruiter_date', cv->>'cv_date'))::date BETWEEN %s AND %s)
                            OR 
                            (NULLIF(COALESCE(cv->>'recruiter_date', cv->>'cv_date'), '') IS NULL 
                             AND DATE(ra.updated_at) BETWEEN %s AND %s)
                        )
                    """
                    where_date_params = [start_date, end_date, start_date, end_date]
                elif start_date:
                    where_date_filter = """
                        AND (
                            (NULLIF(COALESCE(cv->>'recruiter_date', cv->>'cv_date'), '') IS NOT NULL 
                             AND (COALESCE(cv->>'recruiter_date', cv->>'cv_date')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' 
                             AND (COALESCE(cv->>'recruiter_date', cv->>'cv_date'))::date >= %s)
                            OR 
                            (NULLIF(COALESCE(cv->>'recruiter_date', cv->>'cv_date'), '') IS NULL 
                             AND DATE(ra.updated_at) >= %s)
                        )
                    """
                    where_date_params = [start_date, start_date]
                elif end_date:
                    where_date_filter = """
                        AND (
                            (NULLIF(COALESCE(cv->>'recruiter_date', cv->>'cv_date'), '') IS NOT NULL 
                             AND (COALESCE(cv->>'recruiter_date', cv->>'cv_date')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' 
                             AND (COALESCE(cv->>'recruiter_date', cv->>'cv_date'))::date <= %s)
                            OR 
                            (NULLIF(COALESCE(cv->>'recruiter_date', cv->>'cv_date'), '') IS NULL 
                             AND DATE(ra.updated_at) <= %s)
                        )
                    """
                    where_date_params = [end_date, end_date]
                
                # Use recruiter_date (or legacy cv_date) from CV entry to group by date (status 0 or 1)
                # Fallback to activity updated_at if date is NULL or invalid
                group_by = """
                    CASE 
                        WHEN COALESCE(cv->>'recruiter_date', cv->>'cv_date') IS NOT NULL AND (COALESCE(cv->>'recruiter_date', cv->>'cv_date')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' 
                        THEN (COALESCE(cv->>'recruiter_date', cv->>'cv_date'))::date
                        ELSE DATE(ra.updated_at)
                    END
                """
                
                # Get submissions where status IN (0,1)
                # Group by recruiter_date (fallback cv_date) to show date-wise submissions
                # Use CASE statement for proper date handling with NULLIF to prevent errors
                query = f"""
                    SELECT 
                        CASE 
                            WHEN NULLIF(COALESCE(cv->>'recruiter_date', cv->>'cv_date'), '') IS NOT NULL 
                                 AND (COALESCE(cv->>'recruiter_date', cv->>'cv_date')) ~ '^[0-9]{{4}}-[0-9]{{2}}-[0-9]{{2}}' 
                            THEN (COALESCE(cv->>'recruiter_date', cv->>'cv_date'))::date
                            ELSE DATE(ra.updated_at)
                        END as submission_date,
                        ra.recruiter_id,
                        COUNT(*) as submission_count
                    FROM tbl_recruiter_activity ra
                    CROSS JOIN LATERAL jsonb_array_elements(ra.cv_list) AS cv
                    WHERE ra.recruiter_id = ANY(%s)
                    AND ra.demand_id = ANY(%s)
                    AND ra.cv_list IS NOT NULL
                    AND jsonb_array_length(ra.cv_list) > 0
                    AND (
                        CASE 
                            WHEN (cv->>'status') ~ '^[0-9]+' THEN (cv->>'status')::int IN (0,1)
                            WHEN cv->>'status' IS NOT NULL THEN cv->>'status' IN ('0','1')
                            ELSE FALSE
                        END
                    )
                    {where_date_filter}
                    GROUP BY 
                        CASE 
                            WHEN NULLIF(COALESCE(cv->>'recruiter_date', cv->>'cv_date'), '') IS NOT NULL 
                                 AND (COALESCE(cv->>'recruiter_date', cv->>'cv_date')) ~ '^[0-9]{{4}}-[0-9]{{2}}-[0-9]{{2}}' 
                            THEN (COALESCE(cv->>'recruiter_date', cv->>'cv_date'))::date
                            ELSE DATE(ra.updated_at)
                        END,
                        ra.recruiter_id
                    ORDER BY submission_date DESC
                """
                
                # ANY(%s) expects a single array parameter, not expanded tuple
                params = [recruiter_ids, demand_ids] + where_date_params if where_date_params else [recruiter_ids, demand_ids]
                print(f"DEBUG: Executing query with params: {params}")
                print(f"DEBUG: Date filter: start_date={start_date}, end_date={end_date}")
                cur.execute(query, params)
                rows = cur.fetchall()
                
                print(f"DEBUG: Daily submissions trend query returned {len(rows)} rows")
                print(f"DEBUG: Query params: {params}")
                if rows:
                    print(f"DEBUG: First row sample: {rows[0]}")
                else:
                    print("DEBUG: No rows returned - checking if there are any CVs with status=1")
                    # Debug query to check if there are any CVs with status=1
                    debug_query = """
                        SELECT COUNT(*) as total_cvs_status_1
                        FROM tbl_recruiter_activity ra
                        CROSS JOIN LATERAL jsonb_array_elements(ra.cv_list) AS cv
                        WHERE ra.recruiter_id = ANY(%s)
                        AND ra.cv_list IS NOT NULL
                        AND jsonb_array_length(ra.cv_list) > 0
                        AND (
                            CASE 
                                WHEN (cv->>'status') ~ '^[0-9]+$' THEN (cv->>'status')::int = 1
                                WHEN cv->>'status' IS NOT NULL THEN cv->>'status' = '1'
                                ELSE FALSE
                            END
                        )
                    """
                    cur.execute(debug_query, (tuple(recruiter_ids),))
                    debug_result = cur.fetchone()
                    print(f"DEBUG: Total CVs with status=1 (without date filter): {debug_result[0] if debug_result else 0}")
                
                # Group by date and aggregate
                date_map: Dict[str, Dict[str, Any]] = {}
                for row in rows:
                    submission_date = row[0]
                    recruiter_id = row[1]
                    count = int(row[2]) if row[2] else 0
                    
                    # Handle date conversion
                    if submission_date is None:
                        continue
                    
                    if isinstance(submission_date, date):
                        date_str = submission_date.isoformat()
                    elif isinstance(submission_date, datetime):
                        date_str = submission_date.date().isoformat()
                    else:
                        date_str = str(submission_date).split()[0]  # Take only date part if datetime string
                    
                    if date_str not in date_map:
                        date_map[date_str] = {
                            "date": date_str,
                            "count": 0,
                            "recruiters": []
                        }
                    
                    date_map[date_str]["count"] += count
                    if count > 0:
                        date_map[date_str]["recruiters"].append({
                            "recruiter_name": recruiter_data.get(recruiter_id, f"Recruiter {recruiter_id}"),
                            "count": count
                        })
                
                daily_trend = list(date_map.values())
                daily_trend.sort(key=lambda x: x["date"])
                
                print(f"DEBUG: Daily trend aggregated to {len(daily_trend)} date entries")
                if daily_trend:
                    print(f"DEBUG: Sample trend entry: {daily_trend[0]}")
                
                return {"daily_trend": daily_trend}
                
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"Failed to fetch daily submissions trend: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR in get_daily_submissions_trend: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch daily submissions trend: {str(e)}")


@router.get("/teamleader/dashboard/demand-by-recruiters")
async def get_demand_by_recruiters(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get distribution of open demands by recruiters (for pie chart)
    Date filter applies to demand_date from demand_sheet table
    """
    try:
        team_leader_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not team_leader_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Build date filter for demand_date
                date_filter = ""
                date_params = []
                if start_date and end_date:
                    date_filter = "AND ds.demand_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND ds.demand_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND ds.demand_date <= %s"
                    date_params = [end_date]
                
                # Count demands per recruiter - get recruiters directly from assigned_to field
                # Include all statuses except 'rejected' (include: open, in_progress, assigned, processing, closed, on_hold)
                query = f"""
                    SELECT 
                        (assignment->>'recruiter_id')::int as recruiter_id,
                        COUNT(DISTINCT ds.id) as demand_count
                    FROM tbl_demand_sheet ds
                    JOIN jsonb_array_elements(ds.assigned_to) AS assignment ON true
                    WHERE ds.tl_id = %s
                    AND ds.assigned_to IS NOT NULL
                    AND ds.assigned_to != '[]'::jsonb
                    AND ds.status != 'rejected'
                    AND (assignment->>'recruiter_id') IS NOT NULL
                    AND (assignment->>'recruiter_id')::text != ''
                    {date_filter}
                    GROUP BY (assignment->>'recruiter_id')::int
                """
                params = [team_leader_id] + date_params
                
                # Debug: Check if there are any demands with assigned_to for this TL
                debug_query = """
                    SELECT COUNT(*) as total_demands,
                           COUNT(CASE WHEN assigned_to IS NOT NULL AND assigned_to != '[]'::jsonb THEN 1 END) as demands_with_assignments
                    FROM tbl_demand_sheet
                    WHERE tl_id = %s
                """
                cur.execute(debug_query, (team_leader_id,))
                debug_row = cur.fetchone()
                print(f"DEBUG demand-by-recruiters: TL ID={team_leader_id}, Total demands={debug_row[0]}, With assignments={debug_row[1]}")
                
                # Debug: Check sample assigned_to data
                sample_query = """
                    SELECT id, status, assigned_to, demand_date
                    FROM tbl_demand_sheet
                    WHERE tl_id = %s
                    AND assigned_to IS NOT NULL
                    AND assigned_to != '[]'::jsonb
                    LIMIT 3
                """
                cur.execute(sample_query, (team_leader_id,))
                sample_rows = cur.fetchall()
                print(f"DEBUG demand-by-recruiters: Sample demands with assignments: {sample_rows}")
                
                cur.execute(query, params)
                rows = cur.fetchall()
                
                print(f"DEBUG demand-by-recruiters: Query returned {len(rows)} rows")
                if rows:
                    print(f"DEBUG demand-by-recruiters: Sample rows: {rows[:3]}")
                
                if not rows:
                    return {"distribution": []}
                
                # Get all unique recruiter IDs from the results
                recruiter_ids_from_results = [row[0] for row in rows if row[0] is not None]
                
                # Get recruiter names for display
                recruiter_data = {}
                if recruiter_ids_from_results:
                    cur.execute("""
                        SELECT id, COALESCE(NULLIF(TRIM(first_name || ' ' || last_name), ''), first_name, last_name, email) as name
                        FROM tbl_users 
                        WHERE id = ANY(%s)
                    """, (recruiter_ids_from_results,))
                    recruiter_rows = cur.fetchall()
                    recruiter_data = {row[0]: row[1] for row in recruiter_rows}
                
                total = sum(row[1] for row in rows) if rows else 0
                
                distribution = [
                    {
                        "recruiter_id": row[0],
                        "recruiter_name": recruiter_data.get(row[0], f"Recruiter {row[0]}"),
                        "count": row[1],
                        "percentage": round((row[1] / total * 100) if total > 0 else 0, 1)
                    }
                    for row in rows if row[0] is not None
                ]
                
                return {"distribution": distribution}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch demand by recruiters: {e}")


@router.get("/teamleader/dashboard/demand-by-spocs")
async def get_demand_by_spocs(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get distribution of demands by SPOCs (for pie chart)
    Date filter applies to demand_date from demand_sheet table
    """
    try:
        team_leader_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not team_leader_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get demand_ids based on tl_id (not reporting_to)
                demand_ids, _ = _get_tl_demand_and_recruiter_ids(cur, team_leader_id)
                
                if not demand_ids:
                    return {"distribution": []}
                
                # Build date filter for demand_date
                date_filter = ""
                date_params = []
                if start_date and end_date:
                    date_filter = "AND ds.demand_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND ds.demand_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND ds.demand_date <= %s"
                    date_params = [end_date]
                
                # Count demands per SPOC - filter by tl_id
                query = f"""
                    SELECT 
                        ds.spoc_id,
                        COALESCE(cs.spoc_name, 'Unknown SPOC') as spoc_name,
                        COUNT(DISTINCT ds.id) as demand_count
                    FROM tbl_demand_sheet ds
                    LEFT JOIN tbl_client_spocs cs ON ds.spoc_id = cs.id
                    WHERE ds.tl_id = %s
                    {date_filter}
                    GROUP BY ds.spoc_id, cs.spoc_name
                    ORDER BY demand_count DESC
                """
                params = [team_leader_id] + date_params
                cur.execute(query, params)
                
                rows = cur.fetchall()
                total = sum(row[2] for row in rows) if rows else 0
                
                distribution = [
                    {
                        "spoc_id": row[0],
                        "spoc_name": row[1] or "Unknown SPOC",
                        "count": row[2],
                        "percentage": round((row[2] / total * 100) if total > 0 else 0, 1)
                    }
                    for row in rows
                ]
                
                return {"distribution": distribution}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch demand by SPOCs: {e}")


@router.get("/teamleader/dashboard/submissions-by-spocs")
async def get_submissions_by_spocs(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get total submissions count grouped by SPOC from tbl_submissions table (bar chart).
    Date filter uses submission_date field.
    """
    try:
        team_leader_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not team_leader_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get demand_ids and recruiter_ids based on tl_id (not reporting_to)
                demand_ids, recruiter_ids = _get_tl_demand_and_recruiter_ids(cur, team_leader_id)
                
                if not recruiter_ids:
                    return {"spoc_submissions": []}
                
                # Build date filter for submission_date
                date_filter = ""
                date_params = []
                if start_date and end_date:
                    date_filter = "AND s.submission_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND s.submission_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND s.submission_date <= %s"
                    date_params = [end_date]
                
                # Count submissions per SPOC from tbl_submissions - filter by recruiter_ids assigned to TL's demands
                query = f"""
                    SELECT 
                        s.spoc_id,
                        COALESCE(cs.spoc_name, 'Unknown SPOC') as spoc_name,
                        COUNT(*) as submission_count
                    FROM tbl_submissions s
                    LEFT JOIN tbl_client_spocs cs ON s.spoc_id = cs.id
                    WHERE s.recruiter_id = ANY(%s)
                    AND s.demand_id = ANY(%s)
                    {date_filter}
                    GROUP BY s.spoc_id, cs.spoc_name
                    ORDER BY submission_count DESC
                """
                params = [recruiter_ids, demand_ids] + date_params
                cur.execute(query, params)
                
                rows = cur.fetchall()
                
                spoc_submissions = [
                    {
                        "spoc_id": row[0],
                        "spoc_name": row[1] or "Unknown SPOC",
                        "count": row[2]
                    }
                    for row in rows
                ]
                
                return {"spoc_submissions": spoc_submissions}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch submissions by SPOCs: {e}")


@router.get("/teamleader/dashboard/demand-by-status")
async def get_demand_by_status(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get demand count by status from demand_sheet table (bar chart)
    Date filter applies to updated_at from demand_sheet table
    """
    try:
        team_leader_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not team_leader_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get demand_ids based on tl_id (not reporting_to)
                demand_ids, _ = _get_tl_demand_and_recruiter_ids(cur, team_leader_id)
                
                if not demand_ids:
                    return {"status_counts": []}
                
                # Build date filter for updated_at
                date_filter = ""
                date_params = []
                if start_date and end_date:
                    date_filter = "AND DATE(ds.updated_at) BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND DATE(ds.updated_at) >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND DATE(ds.updated_at) <= %s"
                    date_params = [end_date]
                
                # Get demands created by this TL and count by status - filter by tl_id
                query = f"""
                    SELECT 
                        COALESCE(LOWER(CAST(ds.status AS TEXT)), 'unknown') as status,
                        COUNT(DISTINCT ds.id) as count
                    FROM tbl_demand_sheet ds
                    WHERE ds.tl_id = %s
                    {date_filter}
                    GROUP BY COALESCE(LOWER(CAST(ds.status AS TEXT)), 'unknown')
                    ORDER BY count DESC
                """
                params = [team_leader_id] + date_params
                cur.execute(query, params)
                
                rows = cur.fetchall()
                status_counts = [
                    {
                        "status": str(row[0]) if row[0] else "unknown",
                        "count": int(row[1]) if row[1] else 0
                    }
                    for row in rows
                ]
                
                return {"status_counts": status_counts}
                
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"Failed to fetch demand by status: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR in get_demand_by_status: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch demand by status: {str(e)}")


@router.get("/teamleader/dashboard/demand-by-skill")
async def get_demand_by_skill(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get distribution of demands by skill from demand_sheet table (for donut/pie chart)
    Date filter applies to demand_date from demand_sheet table
    """
    try:
        team_leader_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not team_leader_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get demand_ids based on tl_id (not reporting_to)
                demand_ids, _ = _get_tl_demand_and_recruiter_ids(cur, team_leader_id)
                
                if not demand_ids:
                    return {"skill_distribution": []}
                
                # Build date filter for demand_date
                date_filter = ""
                date_params = []
                if start_date and end_date:
                    date_filter = "AND ds.demand_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND ds.demand_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND ds.demand_date <= %s"
                    date_params = [end_date]
                
                # Get skills from demand_sheet - filter by tl_id
                query = f"""
                    SELECT 
                        COALESCE(ds.skill, 'Unknown') as skill,
                        COUNT(DISTINCT ds.id) as demand_count
                    FROM tbl_demand_sheet ds
                    WHERE ds.tl_id = %s
                    {date_filter}
                    GROUP BY ds.skill
                    ORDER BY demand_count DESC
                """
                params = [team_leader_id] + date_params
                cur.execute(query, params)
                
                rows = cur.fetchall()
                total = sum(row[1] for row in rows) if rows else 0
                
                skill_distribution = [
                    {
                        "skill": row[0] or "Unknown",
                        "count": row[1],
                        "percentage": round((row[1] / total * 100) if total > 0 else 0, 1)
                    }
                    for row in rows
                ]
                
                return {"skill_distribution": skill_distribution}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch demand by skill: {e}")


@router.get("/teamleader/dashboard/submissions-by-recruiters")
async def get_submissions_by_recruiters(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get total submissions count grouped by recruiter (bar chart).
    Only includes records where status = 0 (recruiter submitted).
    Groups/counts submissions based on recruiter_id.
    Date filter uses recruiter_date field (fallback to legacy cv_date) from cv_list column.
    """
    try:
        team_leader_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not team_leader_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        # Build date filter conditions - use recruiter_date (or legacy cv_date) if available, otherwise fallback to updated_at
        # Handle NULL and invalid date formats properly using NULLIF to prevent casting errors
        date_filter = ""
        date_params = []
        if start_date and end_date:
            date_filter = """
                AND (
                    (NULLIF(COALESCE(cv->>'recruiter_date', cv->>'cv_date'), '') IS NOT NULL 
                     AND (COALESCE(cv->>'recruiter_date', cv->>'cv_date')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' 
                     AND (COALESCE(cv->>'recruiter_date', cv->>'cv_date'))::date BETWEEN %s AND %s)
                    OR 
                    (NULLIF(COALESCE(cv->>'recruiter_date', cv->>'cv_date'), '') IS NULL 
                     AND DATE(ra.updated_at) BETWEEN %s AND %s)
                )
            """
            date_params = [start_date, end_date, start_date, end_date]
        elif start_date:
            date_filter = """
                AND (
                    (NULLIF(COALESCE(cv->>'recruiter_date', cv->>'cv_date'), '') IS NOT NULL 
                     AND (COALESCE(cv->>'recruiter_date', cv->>'cv_date')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' 
                     AND (COALESCE(cv->>'recruiter_date', cv->>'cv_date'))::date >= %s)
                    OR 
                    (NULLIF(COALESCE(cv->>'recruiter_date', cv->>'cv_date'), '') IS NULL 
                     AND DATE(ra.updated_at) >= %s)
                )
            """
            date_params = [start_date, start_date]
        elif end_date:
            date_filter = """
                AND (
                    (NULLIF(COALESCE(cv->>'recruiter_date', cv->>'cv_date'), '') IS NOT NULL 
                     AND (COALESCE(cv->>'recruiter_date', cv->>'cv_date')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' 
                     AND (COALESCE(cv->>'recruiter_date', cv->>'cv_date'))::date <= %s)
                    OR 
                    (NULLIF(COALESCE(cv->>'recruiter_date', cv->>'cv_date'), '') IS NULL 
                     AND DATE(ra.updated_at) <= %s)
                )
            """
            date_params = [end_date, end_date]
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get demand_ids and recruiter_ids based on tl_id (not reporting_to)
                demand_ids, recruiter_ids = _get_tl_demand_and_recruiter_ids(cur, team_leader_id)
                
                # Get recruiter names for display
                recruiter_data = {}
                if recruiter_ids:
                    cur.execute("""
                        SELECT id, COALESCE(NULLIF(TRIM(first_name || ' ' || last_name), ''), first_name, last_name, email) as name
                        FROM tbl_users 
                        WHERE id = ANY(%s)
                    """, (recruiter_ids,))
                    recruiter_rows = cur.fetchall()
                    recruiter_data = {row[0]: row[1] for row in recruiter_rows}
                
                if not recruiter_ids or not demand_ids:
                    return {"recruiter_submissions": []}
                
                # Get submissions where status in (0,1)
                # Group by recruiter_id to count submissions per recruiter
                # Filter by both recruiter_ids and demand_ids
                query = f"""
                    SELECT 
                        ra.recruiter_id,
                        COUNT(*) as submission_count
                    FROM tbl_recruiter_activity ra
                    CROSS JOIN LATERAL jsonb_array_elements(ra.cv_list) AS cv
                    WHERE ra.recruiter_id = ANY(%s)
                    AND ra.demand_id = ANY(%s)
                    AND ra.cv_list IS NOT NULL
                    AND jsonb_array_length(ra.cv_list) > 0
                    AND (
                        CASE 
                            WHEN cv->>'status' IS NOT NULL THEN 
                                CASE 
                                    WHEN (cv->>'status') ~ '^[0-9]+$' THEN (cv->>'status')::int IN (0,1)
                                    ELSE cv->>'status' IN ('0','1')
                                END
                            ELSE FALSE
                        END
                    )
                    {date_filter}
                    GROUP BY ra.recruiter_id
                    ORDER BY submission_count DESC
                """
                # ANY(%s) expects a single array parameter, not expanded tuple
                params = [recruiter_ids, demand_ids] + date_params if date_params else [recruiter_ids, demand_ids]
                cur.execute(query, params)
                
                rows = cur.fetchall()
                recruiter_submissions = [
                    {
                        "recruiter_id": row[0],
                        "recruiter_name": recruiter_data.get(row[0], f"Recruiter {row[0]}"),
                        "count": int(row[1]) if row[1] else 0
                    }
                    for row in rows
                ]
                
                return {"recruiter_submissions": recruiter_submissions}
                
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"Failed to fetch submissions by recruiters: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR in get_submissions_by_recruiters: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch submissions by recruiters: {str(e)}")


@router.get("/teamleader/dashboard/available-years")
async def get_available_years(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Get list of available years from the database for filter dropdown
    """
    try:
        team_leader_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not team_leader_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get all recruiters reporting to this team leader
                cur.execute("""
                    SELECT id FROM tbl_users 
                    WHERE role = 'recruiter' AND reporting_to = %s
                """, (team_leader_id,))
                recruiter_rows = cur.fetchall()
                recruiter_ids = [row[0] for row in recruiter_rows] if recruiter_rows else []
                
                if not recruiter_ids:
                    return {"years": []}
                
                # Get distinct years from recruiter_activity
                cur.execute("""
                    SELECT DISTINCT EXTRACT(YEAR FROM created_at)::int as year
                    FROM tbl_recruiter_activity
                    WHERE recruiter_id = ANY(%s)
                    UNION
                    SELECT DISTINCT EXTRACT(YEAR FROM created_at)::int as year
                    FROM tbl_demand_sheet
                    WHERE EXISTS (
                        SELECT 1 FROM jsonb_array_elements(assigned_to) AS assignment
                        WHERE (assignment->>'recruiter_id')::int = ANY(%s)
                    )
                    ORDER BY year DESC
                """, (recruiter_ids, recruiter_ids))
                
                rows = cur.fetchall()
                years = [int(row[0]) for row in rows if row[0]]
                
                return {"years": years}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch available years: {e}")


# ============================================
# Manager Dashboard Endpoints
# ============================================

@router.get("/manager/dashboard/key-highlights")
async def get_manager_key_highlights(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get key highlights for Manager: Total Submissions, Current Demand, and Number of Team Leaders
    Aggregates data from Team Leaders reporting to this Manager
    """
    try:
        manager_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not manager_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        # Build date filter conditions
        date_filter = ""
        date_params = []
        if start_date and end_date:
            date_filter = """
                AND (
                    (cv->>'recruiter_date')::date BETWEEN %s AND %s
                    OR ((cv->>'recruiter_date') IS NULL AND DATE(ra.updated_at) BETWEEN %s AND %s)
                )
            """
            date_params = [start_date, end_date, start_date, end_date]
        elif start_date:
            date_filter = """
                AND (
                    (cv->>'recruiter_date')::date >= %s
                    OR ((cv->>'recruiter_date') IS NULL AND DATE(ra.updated_at) >= %s)
                )
            """
            date_params = [start_date, start_date]
        elif end_date:
            date_filter = """
                AND (
                    (cv->>'recruiter_date')::date <= %s
                    OR ((cv->>'recruiter_date') IS NULL AND DATE(ra.updated_at) <= %s)
                )
            """
            date_params = [end_date, end_date]
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get all Team Leaders reporting to this Manager
                cur.execute("""
                    SELECT id FROM tbl_users 
                    WHERE role = 'team_leader' AND reporting_to = %s
                """, (manager_id,))
                tl_rows = cur.fetchall()
                tl_ids = [row[0] for row in tl_rows] if tl_rows else []
                
                # Get all recruiters reporting to these Team Leaders
                recruiter_ids = []
                if tl_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'recruiter' AND reporting_to = ANY(%s)
                    """, (tl_ids,))
                    recruiter_rows = cur.fetchall()
                    recruiter_ids = [row[0] for row in recruiter_rows] if recruiter_rows else []
                
                # Total Submissions: Count total number of CVs with status = 1
                total_submissions = 0
                if recruiter_ids:
                    if date_params:
                        query = f"""
                            SELECT COALESCE(SUM(
                                (SELECT COUNT(*) 
                                 FROM jsonb_array_elements(ra.cv_list) AS cv
                                 WHERE (
                                     cv->>'status' = '1' 
                                     OR (cv->>'status') ~ '^[0-9]+$' AND (cv->>'status')::int = 1
                                 )
                                 {date_filter})
                            ), 0) as total_count
                            FROM tbl_recruiter_activity ra
                            WHERE ra.recruiter_id = ANY(%s)
                            AND ra.cv_list IS NOT NULL
                            AND jsonb_array_length(ra.cv_list) > 0
                        """
                        params = [recruiter_ids] + date_params
                    else:
                        query = """
                            SELECT COALESCE(SUM(
                                (SELECT COUNT(*) 
                                 FROM jsonb_array_elements(ra.cv_list) AS cv
                                 WHERE (
                                     cv->>'status' = '1' 
                                     OR (cv->>'status') ~ '^[0-9]+$' AND (cv->>'status')::int = 1
                                 ))
                            ), 0) as total_count
                            FROM tbl_recruiter_activity ra
                            WHERE ra.recruiter_id = ANY(%s)
                            AND ra.cv_list IS NOT NULL
                            AND jsonb_array_length(ra.cv_list) > 0
                        """
                        params = [recruiter_ids]
                    cur.execute(query, params)
                    result = cur.fetchone()
                    total_submissions = result[0] if result else 0
                
                # Current Demand: Count distinct demands
                current_demand = 0
                if recruiter_ids:
                    query = """
                        SELECT COUNT(DISTINCT ra.demand_id)
                        FROM tbl_recruiter_activity ra
                        WHERE ra.recruiter_id = ANY(%s)
                    """
                    cur.execute(query, (recruiter_ids,))
                    result = cur.fetchone()
                    current_demand = result[0] if result else 0
                
                # Number of Team Leaders
                number_of_team_leaders = len(tl_ids)
                
                return {
                    "total_submissions": total_submissions,
                    "current_demand": current_demand,
                    "number_of_team_leaders": number_of_team_leaders
                }
                
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"Failed to fetch manager key highlights: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR in get_manager_key_highlights: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch manager key highlights: {str(e)}")


@router.get("/manager/dashboard/submissions-by-team-leaders")
async def get_manager_submissions_by_team_leaders(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    For a Manager, get total submissions grouped by Team Leaders under them.
    Data source: tbl_submissions; date filter uses submission_date.
    """
    try:
        manager_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not manager_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")

        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Team Leaders reporting to this manager
                cur.execute("""
                    SELECT id, COALESCE(first_name,'') || CASE WHEN last_name IS NOT NULL AND last_name <> '' THEN ' ' || last_name ELSE '' END AS name
                    FROM tbl_users
                    WHERE role = 'team_leader' AND reporting_to = %s
                """, (manager_id,))
                tl_rows = cur.fetchall()
                tl_ids = [row[0] for row in tl_rows] if tl_rows else []

                if not tl_ids:
                    return {"team_leader_submissions": []}

                # Recruiters reporting to these TLs
                cur.execute("""
                    SELECT id, reporting_to FROM tbl_users
                    WHERE role = 'recruiter' AND reporting_to = ANY(%s)
                """, (tl_ids,))
                rec_rows = cur.fetchall()
                recruiter_ids = [r[0] for r in rec_rows] if rec_rows else []

                if not recruiter_ids:
                    return {"team_leader_submissions": []}

                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND s.submission_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND s.submission_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND s.submission_date <= %s"
                    date_params = [end_date]

                # Count submissions grouped by TL (via recruiter -> TL mapping)
                query = f"""
                    SELECT tl.id AS team_leader_id,
                           COALESCE(tl.first_name,'') || CASE WHEN tl.last_name IS NOT NULL AND tl.last_name <> '' THEN ' ' || tl.last_name ELSE '' END AS team_leader_name,
                           COUNT(*) AS submission_count
                    FROM tbl_submissions s
                    JOIN tbl_users r ON r.id = s.recruiter_id AND r.role = 'recruiter'
                    JOIN tbl_users tl ON tl.id = r.reporting_to AND tl.role = 'team_leader'
                    WHERE r.id = ANY(%s)
                    {date_filter}
                    GROUP BY tl.id, tl.first_name, tl.last_name
                    ORDER BY submission_count DESC
                """
                params: List[Any] = [recruiter_ids] + date_params
                cur.execute(query, params)
                rows = cur.fetchall()

                team_leader_submissions = [
                    {
                        "team_leader_id": row[0],
                        "team_leader_name": row[1] or "",
                        "count": row[2]
                    }
                    for row in rows
                ]

                return {"team_leader_submissions": team_leader_submissions}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch submissions by team leaders: {e}")


@router.get("/manager/dashboard/submissions-by-spocs")
async def get_manager_submissions_by_spocs(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    For a Manager, get total submissions grouped by SPOC for all recruiters under TLs of the manager.
    Data source: tbl_submissions; date filter uses submission_date.
    """
    try:
        manager_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not manager_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")

        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Team Leaders under manager
                cur.execute("""
                    SELECT id FROM tbl_users 
                    WHERE role = 'team_leader' AND reporting_to = %s
                """, (manager_id,))
                tl_rows = cur.fetchall()
                tl_ids = [row[0] for row in tl_rows] if tl_rows else []

                # Recruiters under those TLs
                recruiter_ids: List[int] = []
                if tl_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'recruiter' AND reporting_to = ANY(%s)
                    """, (tl_ids,))
                    rec_rows = cur.fetchall()
                    recruiter_ids = [row[0] for row in rec_rows] if rec_rows else []

                if not recruiter_ids:
                    return {"spoc_submissions": []}

                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND s.submission_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND s.submission_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND s.submission_date <= %s"
                    date_params = [end_date]

                # Count submissions grouped by SPOC
                query = f"""
                    SELECT 
                        s.spoc_id,
                        COALESCE(cs.spoc_name, 'Unknown SPOC') AS spoc_name,
                        COUNT(*) AS submission_count
                    FROM tbl_submissions s
                    LEFT JOIN tbl_client_spocs cs ON s.spoc_id = cs.id
                    WHERE s.recruiter_id = ANY(%s)
                    {date_filter}
                    GROUP BY s.spoc_id, cs.spoc_name
                    ORDER BY submission_count DESC
                """
                params: List[Any] = [recruiter_ids] + date_params
                cur.execute(query, params)
                rows = cur.fetchall()

                spoc_submissions = [
                    {
                        "spoc_id": row[0],
                        "spoc_name": row[1] or "Unknown SPOC",
                        "count": row[2]
                    }
                    for row in rows
                ]

                return {"spoc_submissions": spoc_submissions}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch submissions by SPOCs: {e}")


@router.get("/manager/dashboard/daily-submissions-trend")
async def get_manager_daily_submissions_trend(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get daily submissions trend for Manager (aggregates from all recruiters under their Team Leaders).
    Data source: tbl_submissions; date filter uses submission_date.
    """
    try:
        manager_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not manager_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get Team Leaders under this manager
                cur.execute("""
                    SELECT id FROM tbl_users 
                    WHERE role = 'team_leader' AND reporting_to = %s
                """, (manager_id,))
                tl_rows = cur.fetchall()
                tl_ids = [row[0] for row in tl_rows] if tl_rows else []
                
                # Get recruiters under those TLs
                recruiter_ids: List[int] = []
                if tl_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'recruiter' AND reporting_to = ANY(%s)
                    """, (tl_ids,))
                    rec_rows = cur.fetchall()
                    recruiter_ids = [row[0] for row in rec_rows] if rec_rows else []
                
                if not recruiter_ids:
                    return {"daily_trend": []}
                
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND s.submission_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND s.submission_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND s.submission_date <= %s"
                    date_params = [end_date]
                
                # Get daily submissions grouped by date
                query = f"""
                    SELECT 
                        DATE(s.submission_date) as date,
                        COUNT(*) as count
                    FROM tbl_submissions s
                    WHERE s.recruiter_id = ANY(%s)
                    {date_filter}
                    GROUP BY DATE(s.submission_date)
                    ORDER BY DATE(s.submission_date)
                """
                params: List[Any] = [recruiter_ids] + date_params
                cur.execute(query, params)
                rows = cur.fetchall()
                
                daily_trend = [
                    {
                        "date": row[0].isoformat() if isinstance(row[0], date) else str(row[0]),
                        "count": row[1]
                    }
                    for row in rows
                ]
                
                return {"daily_trend": daily_trend}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch daily submissions trend: {e}")


@router.get("/manager/dashboard/demand-by-team-leaders")
async def get_manager_demand_by_team_leaders(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get demand distribution by Team Leaders for Manager.
    Date filter applies to demand_date from demand_sheet table.
    """
    try:
        manager_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not manager_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get Team Leaders under this manager
                cur.execute("""
                    SELECT id, COALESCE(first_name,'') || CASE WHEN last_name IS NOT NULL AND last_name <> '' THEN ' ' || last_name ELSE '' END AS name
                    FROM tbl_users 
                    WHERE role = 'team_leader' AND reporting_to = %s
                """, (manager_id,))
                tl_rows = cur.fetchall()
                tl_data = {row[0]: row[1] for row in tl_rows}
                tl_ids = list(tl_data.keys())
                
                if not tl_ids:
                    return {"distribution": []}
                
                # Get recruiters under those TLs
                cur.execute("""
                    SELECT id FROM tbl_users 
                    WHERE role = 'recruiter' AND reporting_to = ANY(%s)
                """, (tl_ids,))
                rec_rows = cur.fetchall()
                recruiter_ids = [row[0] for row in rec_rows] if rec_rows else []
                
                if not recruiter_ids:
                    return {"distribution": []}
                
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND ds.demand_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND ds.demand_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND ds.demand_date <= %s"
                    date_params = [end_date]
                
                # Count demands per Team Leader (via recruiter -> TL mapping)
                query = f"""
                    SELECT 
                        tl.id AS team_leader_id,
                        COALESCE(tl.first_name,'') || CASE WHEN tl.last_name IS NOT NULL AND tl.last_name <> '' THEN ' ' || tl.last_name ELSE '' END AS team_leader_name,
                        COUNT(DISTINCT ds.id) AS demand_count
                    FROM tbl_demand_sheet ds
                    JOIN jsonb_array_elements(ds.assigned_to) AS assignment ON (assignment->>'recruiter_id')::int = ANY(%s)
                    JOIN tbl_users r ON r.id = (assignment->>'recruiter_id')::int AND r.role = 'recruiter'
                    JOIN tbl_users tl ON tl.id = r.reporting_to AND tl.role = 'team_leader'
                    WHERE ds.assigned_to IS NOT NULL
                    {date_filter}
                    GROUP BY tl.id, tl.first_name, tl.last_name
                    ORDER BY demand_count DESC
                """
                params: List[Any] = [recruiter_ids] + date_params
                cur.execute(query, params)
                rows = cur.fetchall()
                
                total = sum(row[2] for row in rows) if rows else 0
                
                distribution = [
                    {
                        "team_leader_id": row[0],
                        "team_leader_name": row[1] or "",
                        "count": row[2],
                        "percentage": round((row[2] / total * 100) if total > 0 else 0, 1)
                    }
                    for row in rows
                ]
                
                return {"distribution": distribution}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch demand by team leaders: {e}")


@router.get("/manager/dashboard/demand-by-status")
async def get_manager_demand_by_status(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get demand count by status for Manager (aggregates from all recruiters under their Team Leaders).
    Date filter applies to updated_at from demand_sheet table.
    """
    try:
        manager_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not manager_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get Team Leaders under this manager
                cur.execute("""
                    SELECT id FROM tbl_users 
                    WHERE role = 'team_leader' AND reporting_to = %s
                """, (manager_id,))
                tl_rows = cur.fetchall()
                tl_ids = [row[0] for row in tl_rows] if tl_rows else []
                
                # Get recruiters under those TLs
                recruiter_ids: List[int] = []
                if tl_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'recruiter' AND reporting_to = ANY(%s)
                    """, (tl_ids,))
                    rec_rows = cur.fetchall()
                    recruiter_ids = [row[0] for row in rec_rows] if rec_rows else []
                
                if not recruiter_ids:
                    return {"status_counts": []}
                
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND DATE(ds.updated_at) BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND DATE(ds.updated_at) >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND DATE(ds.updated_at) <= %s"
                    date_params = [end_date]
                
                # Get demands assigned to these recruiters and count by status
                query = f"""
                    SELECT 
                        COALESCE(LOWER(CAST(ds.status AS TEXT)), 'unknown') as status,
                        COUNT(DISTINCT ds.id) as count
                    FROM tbl_demand_sheet ds
                    WHERE ds.assigned_to IS NOT NULL
                    AND ds.assigned_to != '[]'::jsonb
                    AND jsonb_typeof(ds.assigned_to) = 'array'
                    AND EXISTS (
                        SELECT 1 FROM jsonb_array_elements(ds.assigned_to) AS assignment
                        WHERE (assignment->>'recruiter_id')::int = ANY(%s)
                    )
                    {date_filter}
                    GROUP BY ds.status
                    ORDER BY count DESC
                """
                params: List[Any] = [recruiter_ids] + date_params
                cur.execute(query, params)
                rows = cur.fetchall()
                
                status_counts = [
                    {
                        "status": row[0] or "unknown",
                        "count": row[1]
                    }
                    for row in rows
                ]
                
                return {"status_counts": status_counts}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch demand by status: {e}")


@router.get("/manager/dashboard/demand-by-skill")
async def get_manager_demand_by_skill(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get distribution of demands by skill for Manager (aggregates from all recruiters under their Team Leaders).
    Date filter applies to demand_date from demand_sheet table.
    """
    try:
        manager_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not manager_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get Team Leaders under this manager
                cur.execute("""
                    SELECT id FROM tbl_users 
                    WHERE role = 'team_leader' AND reporting_to = %s
                """, (manager_id,))
                tl_rows = cur.fetchall()
                tl_ids = [row[0] for row in tl_rows] if tl_rows else []
                
                # Get recruiters under those TLs
                recruiter_ids: List[int] = []
                if tl_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'recruiter' AND reporting_to = ANY(%s)
                    """, (tl_ids,))
                    rec_rows = cur.fetchall()
                    recruiter_ids = [row[0] for row in rec_rows] if rec_rows else []
                
                if not recruiter_ids:
                    return {"skill_distribution": []}
                
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND ds.demand_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND ds.demand_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND ds.demand_date <= %s"
                    date_params = [end_date]
                
                # Get skills from demand_sheet via recruiter_activity.demand_id
                query = f"""
                    SELECT 
                        COALESCE(ds.skill, 'Unknown') as skill,
                        COUNT(DISTINCT ra.demand_id) as demand_count
                    FROM tbl_recruiter_activity ra
                    LEFT JOIN tbl_demand_sheet ds ON ra.demand_id = ds.id
                    WHERE ra.recruiter_id = ANY(%s)
                    {date_filter}
                    GROUP BY ds.skill
                    ORDER BY demand_count DESC
                """
                params: List[Any] = [recruiter_ids] + date_params
                cur.execute(query, params)
                rows = cur.fetchall()
                
                total = sum(row[1] for row in rows) if rows else 0
                
                skill_distribution = [
                    {
                        "skill": row[0] or "Unknown",
                        "count": row[1],
                        "percentage": round((row[1] / total * 100) if total > 0 else 0, 1)
                    }
                    for row in rows
                ]
                
                return {"skill_distribution": skill_distribution}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch demand by skill: {e}")


@router.get("/manager/dashboard/demand-by-spocs")
async def get_manager_demand_by_spocs(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get demand distribution by SPOCs for Manager (aggregates from all recruiters under their Team Leaders).
    Date filter applies to demand_date from demand_sheet table.
    """
    try:
        manager_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not manager_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get Team Leaders under this manager
                cur.execute("""
                    SELECT id FROM tbl_users 
                    WHERE role = 'team_leader' AND reporting_to = %s
                """, (manager_id,))
                tl_rows = cur.fetchall()
                tl_ids = [row[0] for row in tl_rows] if tl_rows else []
                
                # Get recruiters under those TLs
                recruiter_ids: List[int] = []
                if tl_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'recruiter' AND reporting_to = ANY(%s)
                    """, (tl_ids,))
                    rec_rows = cur.fetchall()
                    recruiter_ids = [row[0] for row in rec_rows] if rec_rows else []
                
                if not recruiter_ids:
                    return {"distribution": []}
                
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND ds.demand_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND ds.demand_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND ds.demand_date <= %s"
                    date_params = [end_date]
                
                # Count demands per SPOC
                query = f"""
                    SELECT 
                        ds.spoc_id,
                        COALESCE(cs.spoc_name, 'Unknown SPOC') AS spoc_name,
                        COUNT(DISTINCT ds.id) AS demand_count
                    FROM tbl_demand_sheet ds
                    LEFT JOIN tbl_client_spocs cs ON ds.spoc_id = cs.id
                    WHERE ds.assigned_to IS NOT NULL
                    AND EXISTS (
                        SELECT 1 FROM jsonb_array_elements(ds.assigned_to) AS assignment
                        WHERE (assignment->>'recruiter_id')::int = ANY(%s)
                    )
                    {date_filter}
                    GROUP BY ds.spoc_id, cs.spoc_name
                    ORDER BY demand_count DESC
                """
                params: List[Any] = [recruiter_ids] + date_params
                cur.execute(query, params)
                rows = cur.fetchall()
                
                total = sum(row[2] for row in rows) if rows else 0
                
                distribution = [
                    {
                        "spoc_id": row[0],
                        "spoc_name": row[1] or "Unknown SPOC",
                        "count": row[2],
                        "percentage": round((row[2] / total * 100) if total > 0 else 0, 1)
                    }
                    for row in rows
                ]
                
                return {"distribution": distribution}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch demand by SPOCs: {e}")


# ============================================
# Business Head Dashboard Endpoints
# ============================================

@router.get("/businesshead/dashboard/key-highlights")
async def get_businesshead_key_highlights(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get key highlights for Business Head: Total Submissions, Current Demand, and Number of Managers
    Aggregates data from Managers reporting to this Business Head
    """
    try:
        business_head_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not business_head_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        # Build date filter conditions
        date_filter = ""
        date_params = []
        if start_date and end_date:
            date_filter = """
                AND (
                    (cv->>'recruiter_date')::date BETWEEN %s AND %s
                    OR ((cv->>'recruiter_date') IS NULL AND DATE(ra.updated_at) BETWEEN %s AND %s)
                )
            """
            date_params = [start_date, end_date, start_date, end_date]
        elif start_date:
            date_filter = """
                AND (
                    (cv->>'recruiter_date')::date >= %s
                    OR ((cv->>'recruiter_date') IS NULL AND DATE(ra.updated_at) >= %s)
                )
            """
            date_params = [start_date, start_date]
        elif end_date:
            date_filter = """
                AND (
                    (cv->>'recruiter_date')::date <= %s
                    OR ((cv->>'recruiter_date') IS NULL AND DATE(ra.updated_at) <= %s)
                )
            """
            date_params = [end_date, end_date]
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get all Managers reporting to this Business Head
                cur.execute("""
                    SELECT id FROM tbl_users 
                    WHERE role = 'manager' AND reporting_to = %s
                """, (business_head_id,))
                manager_rows = cur.fetchall()
                manager_ids = [row[0] for row in manager_rows] if manager_rows else []
                
                # Get all Team Leaders reporting to these Managers
                tl_ids = []
                if manager_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'team_leader' AND reporting_to = ANY(%s)
                    """, (manager_ids,))
                    tl_rows = cur.fetchall()
                    tl_ids = [row[0] for row in tl_rows] if tl_rows else []
                
                # Get all recruiters reporting to these Team Leaders
                recruiter_ids = []
                if tl_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'recruiter' AND reporting_to = ANY(%s)
                    """, (tl_ids,))
                    recruiter_rows = cur.fetchall()
                    recruiter_ids = [row[0] for row in recruiter_rows] if recruiter_rows else []
                
                # Total Submissions: Count total number of CVs with status = 1
                total_submissions = 0
                if recruiter_ids:
                    if date_params:
                        query = f"""
                            SELECT COALESCE(SUM(
                                (SELECT COUNT(*) 
                                 FROM jsonb_array_elements(ra.cv_list) AS cv
                                 WHERE (
                                     cv->>'status' = '1' 
                                     OR (cv->>'status') ~ '^[0-9]+$' AND (cv->>'status')::int = 1
                                 )
                                 {date_filter})
                            ), 0) as total_count
                            FROM tbl_recruiter_activity ra
                            WHERE ra.recruiter_id = ANY(%s)
                            AND ra.cv_list IS NOT NULL
                            AND jsonb_array_length(ra.cv_list) > 0
                        """
                        params = [recruiter_ids] + date_params
                    else:
                        query = """
                            SELECT COALESCE(SUM(
                                (SELECT COUNT(*) 
                                 FROM jsonb_array_elements(ra.cv_list) AS cv
                                 WHERE (
                                     cv->>'status' = '1' 
                                     OR (cv->>'status') ~ '^[0-9]+$' AND (cv->>'status')::int = 1
                                 ))
                            ), 0) as total_count
                            FROM tbl_recruiter_activity ra
                            WHERE ra.recruiter_id = ANY(%s)
                            AND ra.cv_list IS NOT NULL
                            AND jsonb_array_length(ra.cv_list) > 0
                        """
                        params = [recruiter_ids]
                    cur.execute(query, params)
                    result = cur.fetchone()
                    total_submissions = result[0] if result else 0
                
                # Current Demand: Count distinct demands
                current_demand = 0
                if recruiter_ids:
                    query = """
                        SELECT COUNT(DISTINCT ra.demand_id)
                        FROM tbl_recruiter_activity ra
                        WHERE ra.recruiter_id = ANY(%s)
                    """
                    cur.execute(query, (recruiter_ids,))
                    result = cur.fetchone()
                    current_demand = result[0] if result else 0
                
                # Number of Managers
                number_of_managers = len(manager_ids)
                
                return {
                    "total_submissions": total_submissions,
                    "current_demand": current_demand,
                    "number_of_managers": number_of_managers
                }
                
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"Failed to fetch business head key highlights: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR in get_businesshead_key_highlights: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch business head key highlights: {str(e)}")


@router.get("/businesshead/dashboard/daily-submissions-trend")
async def get_businesshead_daily_submissions_trend(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get daily submissions trend for Business Head (aggregates from all recruiters under their Managers).
    Data source: tbl_submissions; date filter uses submission_date.
    """
    try:
        business_head_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not business_head_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get Managers under this Business Head
                cur.execute("""
                    SELECT id FROM tbl_users 
                    WHERE role = 'manager' AND reporting_to = %s
                """, (business_head_id,))
                manager_rows = cur.fetchall()
                manager_ids = [row[0] for row in manager_rows] if manager_rows else []
                
                # Get Team Leaders under those Managers
                tl_ids: List[int] = []
                if manager_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'team_leader' AND reporting_to = ANY(%s)
                    """, (manager_ids,))
                    tl_rows = cur.fetchall()
                    tl_ids = [row[0] for row in tl_rows] if tl_rows else []
                
                # Get recruiters under those TLs
                recruiter_ids: List[int] = []
                if tl_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'recruiter' AND reporting_to = ANY(%s)
                    """, (tl_ids,))
                    rec_rows = cur.fetchall()
                    recruiter_ids = [row[0] for row in rec_rows] if rec_rows else []
                
                if not recruiter_ids:
                    return {"daily_trend": []}
                
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND s.submission_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND s.submission_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND s.submission_date <= %s"
                    date_params = [end_date]
                
                # Get daily submissions grouped by date
                query = f"""
                    SELECT 
                        DATE(s.submission_date) as date,
                        COUNT(*) as count
                    FROM tbl_submissions s
                    WHERE s.recruiter_id = ANY(%s)
                    {date_filter}
                    GROUP BY DATE(s.submission_date)
                    ORDER BY DATE(s.submission_date)
                """
                params: List[Any] = [recruiter_ids] + date_params
                cur.execute(query, params)
                rows = cur.fetchall()
                
                daily_trend = [
                    {
                        "date": row[0].isoformat() if isinstance(row[0], date) else str(row[0]),
                        "count": row[1]
                    }
                    for row in rows
                ]
                
                return {"daily_trend": daily_trend}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch daily submissions trend: {e}")


@router.get("/businesshead/dashboard/demand-by-managers")
async def get_businesshead_demand_by_managers(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get demand distribution by Managers for Business Head.
    Date filter applies to demand_date from demand_sheet table.
    """
    try:
        business_head_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not business_head_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get Managers under this Business Head
                cur.execute("""
                    SELECT id, COALESCE(first_name,'') || CASE WHEN last_name IS NOT NULL AND last_name <> '' THEN ' ' || last_name ELSE '' END AS name
                    FROM tbl_users 
                    WHERE role = 'manager' AND reporting_to = %s
                """, (business_head_id,))
                manager_rows = cur.fetchall()
                manager_data = {row[0]: row[1] for row in manager_rows}
                manager_ids = list(manager_data.keys())
                
                if not manager_ids:
                    return {"distribution": []}
                
                # Get Team Leaders under those Managers
                cur.execute("""
                    SELECT id FROM tbl_users 
                    WHERE role = 'team_leader' AND reporting_to = ANY(%s)
                """, (manager_ids,))
                tl_rows = cur.fetchall()
                tl_ids = [row[0] for row in tl_rows] if tl_rows else []
                
                # Get recruiters under those TLs
                cur.execute("""
                    SELECT id FROM tbl_users 
                    WHERE role = 'recruiter' AND reporting_to = ANY(%s)
                """, (tl_ids,))
                rec_rows = cur.fetchall()
                recruiter_ids = [row[0] for row in rec_rows] if rec_rows else []
                
                if not recruiter_ids:
                    return {"distribution": []}
                
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND ds.demand_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND ds.demand_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND ds.demand_date <= %s"
                    date_params = [end_date]
                
                # Count demands per Manager (via recruiter -> TL -> Manager mapping)
                query = f"""
                    SELECT 
                        m.id AS manager_id,
                        COALESCE(m.first_name,'') || CASE WHEN m.last_name IS NOT NULL AND m.last_name <> '' THEN ' ' || m.last_name ELSE '' END AS manager_name,
                        COUNT(DISTINCT ds.id) AS demand_count
                    FROM tbl_demand_sheet ds
                    JOIN jsonb_array_elements(ds.assigned_to) AS assignment ON (assignment->>'recruiter_id')::int = ANY(%s)
                    JOIN tbl_users r ON r.id = (assignment->>'recruiter_id')::int AND r.role = 'recruiter'
                    JOIN tbl_users tl ON tl.id = r.reporting_to AND tl.role = 'team_leader'
                    JOIN tbl_users m ON m.id = tl.reporting_to AND m.role = 'manager'
                    WHERE ds.assigned_to IS NOT NULL
                    {date_filter}
                    GROUP BY m.id, m.first_name, m.last_name
                    ORDER BY demand_count DESC
                """
                params: List[Any] = [recruiter_ids] + date_params
                cur.execute(query, params)
                rows = cur.fetchall()
                
                total = sum(row[2] for row in rows) if rows else 0
                
                distribution = [
                    {
                        "manager_id": row[0],
                        "manager_name": row[1] or "",
                        "count": row[2],
                        "percentage": round((row[2] / total * 100) if total > 0 else 0, 1)
                    }
                    for row in rows
                ]
                
                return {"distribution": distribution}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch demand by managers: {e}")


@router.get("/businesshead/dashboard/demand-by-status")
async def get_businesshead_demand_by_status(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get demand count by status for Business Head (aggregates from all recruiters under their Managers).
    Date filter applies to updated_at from demand_sheet table.
    """
    try:
        business_head_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not business_head_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get Managers under this Business Head
                cur.execute("""
                    SELECT id FROM tbl_users 
                    WHERE role = 'manager' AND reporting_to = %s
                """, (business_head_id,))
                manager_rows = cur.fetchall()
                manager_ids = [row[0] for row in manager_rows] if manager_rows else []
                
                # Get Team Leaders under those Managers
                tl_ids: List[int] = []
                if manager_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'team_leader' AND reporting_to = ANY(%s)
                    """, (manager_ids,))
                    tl_rows = cur.fetchall()
                    tl_ids = [row[0] for row in tl_rows] if tl_rows else []
                
                # Get recruiters under those TLs
                recruiter_ids: List[int] = []
                if tl_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'recruiter' AND reporting_to = ANY(%s)
                    """, (tl_ids,))
                    rec_rows = cur.fetchall()
                    recruiter_ids = [row[0] for row in rec_rows] if rec_rows else []
                
                if not recruiter_ids:
                    return {"status_counts": []}
                
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND DATE(ds.updated_at) BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND DATE(ds.updated_at) >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND DATE(ds.updated_at) <= %s"
                    date_params = [end_date]
                
                # Get demands assigned to these recruiters and count by status
                query = f"""
                    SELECT 
                        COALESCE(LOWER(CAST(ds.status AS TEXT)), 'unknown') as status,
                        COUNT(DISTINCT ds.id) as count
                    FROM tbl_demand_sheet ds
                    WHERE ds.assigned_to IS NOT NULL
                    AND ds.assigned_to != '[]'::jsonb
                    AND jsonb_typeof(ds.assigned_to) = 'array'
                    AND EXISTS (
                        SELECT 1 FROM jsonb_array_elements(ds.assigned_to) AS assignment
                        WHERE (assignment->>'recruiter_id')::int = ANY(%s)
                    )
                    {date_filter}
                    GROUP BY ds.status
                    ORDER BY count DESC
                """
                params: List[Any] = [recruiter_ids] + date_params
                cur.execute(query, params)
                rows = cur.fetchall()
                
                status_counts = [
                    {
                        "status": row[0] or "unknown",
                        "count": row[1]
                    }
                    for row in rows
                ]
                
                return {"status_counts": status_counts}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch demand by status: {e}")


@router.get("/businesshead/dashboard/demand-by-skill")
async def get_businesshead_demand_by_skill(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get distribution of demands by skill for Business Head (aggregates from all recruiters under their Managers).
    Date filter applies to demand_date from demand_sheet table.
    """
    try:
        business_head_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not business_head_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get Managers under this Business Head
                cur.execute("""
                    SELECT id FROM tbl_users 
                    WHERE role = 'manager' AND reporting_to = %s
                """, (business_head_id,))
                manager_rows = cur.fetchall()
                manager_ids = [row[0] for row in manager_rows] if manager_rows else []
                
                # Get Team Leaders under those Managers
                tl_ids: List[int] = []
                if manager_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'team_leader' AND reporting_to = ANY(%s)
                    """, (manager_ids,))
                    tl_rows = cur.fetchall()
                    tl_ids = [row[0] for row in tl_rows] if tl_rows else []
                
                # Get recruiters under those TLs
                recruiter_ids: List[int] = []
                if tl_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'recruiter' AND reporting_to = ANY(%s)
                    """, (tl_ids,))
                    rec_rows = cur.fetchall()
                    recruiter_ids = [row[0] for row in rec_rows] if rec_rows else []
                
                if not recruiter_ids:
                    return {"skill_distribution": []}
                
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND ds.demand_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND ds.demand_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND ds.demand_date <= %s"
                    date_params = [end_date]
                
                # Get skills from demand_sheet via recruiter_activity.demand_id
                query = f"""
                    SELECT 
                        COALESCE(ds.skill, 'Unknown') as skill,
                        COUNT(DISTINCT ra.demand_id) as demand_count
                    FROM tbl_recruiter_activity ra
                    LEFT JOIN tbl_demand_sheet ds ON ra.demand_id = ds.id
                    WHERE ra.recruiter_id = ANY(%s)
                    {date_filter}
                    GROUP BY ds.skill
                    ORDER BY demand_count DESC
                """
                params: List[Any] = [recruiter_ids] + date_params
                cur.execute(query, params)
                rows = cur.fetchall()
                
                total = sum(row[1] for row in rows) if rows else 0
                
                skill_distribution = [
                    {
                        "skill": row[0] or "Unknown",
                        "count": row[1],
                        "percentage": round((row[1] / total * 100) if total > 0 else 0, 1)
                    }
                    for row in rows
                ]
                
                return {"skill_distribution": skill_distribution}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch demand by skill: {e}")


@router.get("/businesshead/dashboard/submissions-by-managers")
async def get_businesshead_submissions_by_managers(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get submissions grouped by Managers for Business Head (all Managers under the Business Head).
    Data source: tbl_submissions; date filter uses submission_date.
    """
    try:
        business_head_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not business_head_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND s.submission_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND s.submission_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND s.submission_date <= %s"
                    date_params = [end_date]
                
                # Count submissions grouped by Manager (via recruiter -> TL -> Manager hierarchy)
                query = f"""
                    SELECT 
                        m.id AS manager_id,
                        COALESCE(m.first_name,'') || CASE WHEN m.last_name IS NOT NULL AND m.last_name <> '' THEN ' ' || m.last_name ELSE '' END AS manager_name,
                        COUNT(*) AS submission_count
                    FROM tbl_submissions s
                    JOIN tbl_users r ON r.id = s.recruiter_id AND r.role = 'recruiter'
                    JOIN tbl_users tl ON tl.id = r.reporting_to AND tl.role = 'team_leader'
                    JOIN tbl_users m ON m.id = tl.reporting_to AND m.role = 'manager'
                    WHERE m.reporting_to = %s
                    {date_filter}
                    GROUP BY m.id, m.first_name, m.last_name
                    ORDER BY submission_count DESC
                """
                params: List[Any] = [business_head_id] + date_params
                cur.execute(query, params)
                rows = cur.fetchall()
                
                manager_submissions = [
                    {
                        "manager_id": row[0],
                        "manager_name": row[1] or "",
                        "count": row[2]
                    }
                    for row in rows
                ]
                
                return {"manager_submissions": manager_submissions}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch submissions by managers: {e}")


@router.get("/businesshead/dashboard/demand-by-spocs")
async def get_businesshead_demand_by_spocs(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get demand distribution by SPOCs for Business Head (aggregates from all recruiters under their Managers).
    Date filter applies to demand_date from demand_sheet table.
    """
    try:
        business_head_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not business_head_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get Managers under this Business Head
                cur.execute("""
                    SELECT id FROM tbl_users 
                    WHERE role = 'manager' AND reporting_to = %s
                """, (business_head_id,))
                manager_rows = cur.fetchall()
                manager_ids = [row[0] for row in manager_rows] if manager_rows else []
                
                # Get Team Leaders under those Managers
                tl_ids: List[int] = []
                if manager_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'team_leader' AND reporting_to = ANY(%s)
                    """, (manager_ids,))
                    tl_rows = cur.fetchall()
                    tl_ids = [row[0] for row in tl_rows] if tl_rows else []
                
                # Get recruiters under those TLs
                recruiter_ids: List[int] = []
                if tl_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'recruiter' AND reporting_to = ANY(%s)
                    """, (tl_ids,))
                    rec_rows = cur.fetchall()
                    recruiter_ids = [row[0] for row in rec_rows] if rec_rows else []
                
                if not recruiter_ids:
                    return {"distribution": []}
                
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND ds.demand_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND ds.demand_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND ds.demand_date <= %s"
                    date_params = [end_date]
                
                # Count demands per SPOC
                query = f"""
                    SELECT 
                        ds.spoc_id,
                        COALESCE(cs.spoc_name, 'Unknown SPOC') AS spoc_name,
                        COUNT(DISTINCT ds.id) AS demand_count
                    FROM tbl_demand_sheet ds
                    LEFT JOIN tbl_client_spocs cs ON ds.spoc_id = cs.id
                    WHERE ds.assigned_to IS NOT NULL
                    AND EXISTS (
                        SELECT 1 FROM jsonb_array_elements(ds.assigned_to) AS assignment
                        WHERE (assignment->>'recruiter_id')::int = ANY(%s)
                    )
                    {date_filter}
                    GROUP BY ds.spoc_id, cs.spoc_name
                    ORDER BY demand_count DESC
                """
                params: List[Any] = [recruiter_ids] + date_params
                cur.execute(query, params)
                rows = cur.fetchall()
                
                total = sum(row[2] for row in rows) if rows else 0
                
                distribution = [
                    {
                        "spoc_id": row[0],
                        "spoc_name": row[1] or "Unknown SPOC",
                        "count": row[2],
                        "percentage": round((row[2] / total * 100) if total > 0 else 0, 1)
                    }
                    for row in rows
                ]
                
                return {"distribution": distribution}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch demand by SPOCs: {e}")


@router.get("/businesshead/dashboard/submissions-by-spocs")
async def get_businesshead_submissions_by_spocs(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get submissions grouped by SPOC for Business Head (all recruiters under their Managers).
    Data source: tbl_submissions; date filter uses submission_date.
    """
    try:
        business_head_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not business_head_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get Managers under this Business Head
                cur.execute("""
                    SELECT id FROM tbl_users 
                    WHERE role = 'manager' AND reporting_to = %s
                """, (business_head_id,))
                manager_rows = cur.fetchall()
                manager_ids = [row[0] for row in manager_rows] if manager_rows else []
                
                # Get Team Leaders under those Managers
                tl_ids: List[int] = []
                if manager_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'team_leader' AND reporting_to = ANY(%s)
                    """, (manager_ids,))
                    tl_rows = cur.fetchall()
                    tl_ids = [row[0] for row in tl_rows] if tl_rows else []
                
                # Get recruiters under those TLs
                recruiter_ids: List[int] = []
                if tl_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'recruiter' AND reporting_to = ANY(%s)
                    """, (tl_ids,))
                    rec_rows = cur.fetchall()
                    recruiter_ids = [row[0] for row in rec_rows] if rec_rows else []
                
                if not recruiter_ids:
                    return {"spoc_submissions": []}
                
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND s.submission_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND s.submission_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND s.submission_date <= %s"
                    date_params = [end_date]
                
                # Count submissions grouped by SPOC
                query = f"""
                    SELECT 
                        s.spoc_id,
                        COALESCE(cs.spoc_name, 'Unknown SPOC') AS spoc_name,
                        COUNT(*) AS submission_count
                    FROM tbl_submissions s
                    LEFT JOIN tbl_client_spocs cs ON s.spoc_id = cs.id
                    WHERE s.recruiter_id = ANY(%s)
                    {date_filter}
                    GROUP BY s.spoc_id, cs.spoc_name
                    ORDER BY submission_count DESC
                """
                params: List[Any] = [recruiter_ids] + date_params
                cur.execute(query, params)
                rows = cur.fetchall()
                
                spoc_submissions = [
                    {
                        "spoc_id": row[0],
                        "spoc_name": row[1] or "Unknown SPOC",
                        "count": row[2]
                    }
                    for row in rows
                ]
                
                return {"spoc_submissions": spoc_submissions}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch submissions by SPOCs: {e}")


# ============================================
# Cluster Manager Dashboard Endpoints
# ============================================

@router.get("/clustermanager/dashboard/key-highlights")
async def get_clustermanager_key_highlights(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get key highlights for Cluster Manager: Total Submissions, Current Demand, and Number of Business Heads
    Aggregates data from Business Heads reporting to this Cluster Manager
    """
    try:
        cluster_manager_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not cluster_manager_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        # Build date filter conditions
        date_filter = ""
        date_params = []
        if start_date and end_date:
            date_filter = """
                AND (
                    (cv->>'recruiter_date')::date BETWEEN %s AND %s
                    OR ((cv->>'recruiter_date') IS NULL AND DATE(ra.updated_at) BETWEEN %s AND %s)
                )
            """
            date_params = [start_date, end_date, start_date, end_date]
        elif start_date:
            date_filter = """
                AND (
                    (cv->>'recruiter_date')::date >= %s
                    OR ((cv->>'recruiter_date') IS NULL AND DATE(ra.updated_at) >= %s)
                )
            """
            date_params = [start_date, start_date]
        elif end_date:
            date_filter = """
                AND (
                    (cv->>'recruiter_date')::date <= %s
                    OR ((cv->>'recruiter_date') IS NULL AND DATE(ra.updated_at) <= %s)
                )
            """
            date_params = [end_date, end_date]
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get all Business Heads reporting to this Cluster Manager
                cur.execute("""
                    SELECT id FROM tbl_users 
                    WHERE role = 'business_head' AND reporting_to = %s
                """, (cluster_manager_id,))
                bh_rows = cur.fetchall()
                bh_ids = [row[0] for row in bh_rows] if bh_rows else []
                
                # Get all Managers reporting to these Business Heads
                manager_ids = []
                if bh_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'manager' AND reporting_to = ANY(%s)
                    """, (bh_ids,))
                    manager_rows = cur.fetchall()
                    manager_ids = [row[0] for row in manager_rows] if manager_rows else []
                
                # Get all Team Leaders reporting to these Managers
                tl_ids = []
                if manager_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'team_leader' AND reporting_to = ANY(%s)
                    """, (manager_ids,))
                    tl_rows = cur.fetchall()
                    tl_ids = [row[0] for row in tl_rows] if tl_rows else []
                
                # Get all recruiters reporting to these Team Leaders
                recruiter_ids = []
                if tl_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'recruiter' AND reporting_to = ANY(%s)
                    """, (tl_ids,))
                    recruiter_rows = cur.fetchall()
                    recruiter_ids = [row[0] for row in recruiter_rows] if recruiter_rows else []
                
                # Total Submissions: Count total number of CVs with status = 1
                total_submissions = 0
                if recruiter_ids:
                    if date_params:
                        query = f"""
                            SELECT COALESCE(SUM(
                                (SELECT COUNT(*) 
                                 FROM jsonb_array_elements(ra.cv_list) AS cv
                                 WHERE (
                                     cv->>'status' = '1' 
                                     OR (cv->>'status') ~ '^[0-9]+$' AND (cv->>'status')::int = 1
                                 )
                                 {date_filter})
                            ), 0) as total_count
                            FROM tbl_recruiter_activity ra
                            WHERE ra.recruiter_id = ANY(%s)
                            AND ra.cv_list IS NOT NULL
                            AND jsonb_array_length(ra.cv_list) > 0
                        """
                        params = [recruiter_ids] + date_params
                    else:
                        query = """
                            SELECT COALESCE(SUM(
                                (SELECT COUNT(*) 
                                 FROM jsonb_array_elements(ra.cv_list) AS cv
                                 WHERE (
                                     cv->>'status' = '1' 
                                     OR (cv->>'status') ~ '^[0-9]+$' AND (cv->>'status')::int = 1
                                 ))
                            ), 0) as total_count
                            FROM tbl_recruiter_activity ra
                            WHERE ra.recruiter_id = ANY(%s)
                            AND ra.cv_list IS NOT NULL
                            AND jsonb_array_length(ra.cv_list) > 0
                        """
                        params = [recruiter_ids]
                    cur.execute(query, params)
                    result = cur.fetchone()
                    total_submissions = result[0] if result else 0
                
                # Current Demand: Count distinct demands assigned to these recruiters (open or processing)
                current_demand = 0
                if recruiter_ids:
                    cur.execute("""
                        SELECT COUNT(DISTINCT ds.id)
                        FROM tbl_demand_sheet ds
                        WHERE ds.status IN ('open', 'processing')
                        AND ds.assigned_to IS NOT NULL
                        AND EXISTS (
                            SELECT 1 FROM jsonb_array_elements(ds.assigned_to) AS assignment
                            WHERE (assignment->>'recruiter_id')::int = ANY(%s)
                        )
                    """, (recruiter_ids,))
                    result = cur.fetchone()
                    current_demand = result[0] if result else 0
                
                # Number of Business Heads: Count Business Heads reporting to this Cluster Manager
                number_of_business_heads = len(bh_ids)
                
                return {
                    "total_submissions": total_submissions,
                    "current_demand": current_demand,
                    "number_of_business_heads": number_of_business_heads
                }
                
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"Failed to fetch cluster manager key highlights: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR in get_clustermanager_key_highlights: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch cluster manager key highlights: {str(e)}")


@router.get("/clustermanager/dashboard/daily-submissions-trend")
async def get_clustermanager_daily_submissions_trend(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get daily submissions trend for Cluster Manager (aggregates from all recruiters under their Business Heads).
    Data source: tbl_submissions; date filter uses submission_date.
    """
    try:
        cluster_manager_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not cluster_manager_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get Business Heads under this Cluster Manager
                cur.execute("""
                    SELECT id FROM tbl_users 
                    WHERE role = 'business_head' AND reporting_to = %s
                """, (cluster_manager_id,))
                bh_rows = cur.fetchall()
                bh_ids = [row[0] for row in bh_rows] if bh_rows else []
                
                # Get Managers under those Business Heads
                manager_ids: List[int] = []
                if bh_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'manager' AND reporting_to = ANY(%s)
                    """, (bh_ids,))
                    manager_rows = cur.fetchall()
                    manager_ids = [row[0] for row in manager_rows] if manager_rows else []
                
                # Get Team Leaders under those Managers
                tl_ids: List[int] = []
                if manager_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'team_leader' AND reporting_to = ANY(%s)
                    """, (manager_ids,))
                    tl_rows = cur.fetchall()
                    tl_ids = [row[0] for row in tl_rows] if tl_rows else []
                
                # Get recruiters under those TLs
                recruiter_ids: List[int] = []
                if tl_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'recruiter' AND reporting_to = ANY(%s)
                    """, (tl_ids,))
                    rec_rows = cur.fetchall()
                    recruiter_ids = [row[0] for row in rec_rows] if rec_rows else []
                
                if not recruiter_ids:
                    return {"daily_trend": []}
                
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND s.submission_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND s.submission_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND s.submission_date <= %s"
                    date_params = [end_date]
                
                # Get daily submissions grouped by date
                query = f"""
                    SELECT 
                        DATE(s.submission_date) as date,
                        COUNT(*) as count
                    FROM tbl_submissions s
                    WHERE s.recruiter_id = ANY(%s)
                    {date_filter}
                    GROUP BY DATE(s.submission_date)
                    ORDER BY DATE(s.submission_date)
                """
                params: List[Any] = [recruiter_ids] + date_params
                cur.execute(query, params)
                rows = cur.fetchall()
                
                daily_trend = [
                    {
                        "date": row[0].isoformat() if isinstance(row[0], date) else str(row[0]),
                        "count": row[1]
                    }
                    for row in rows
                ]
                
                return {"daily_trend": daily_trend}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch daily submissions trend: {e}")


@router.get("/clustermanager/dashboard/demand-by-business-heads")
async def get_clustermanager_demand_by_business_heads(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get demand distribution by Business Heads for Cluster Manager.
    Date filter applies to demand_date from demand_sheet table.
    """
    try:
        cluster_manager_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not cluster_manager_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get Business Heads under this Cluster Manager
                cur.execute("""
                    SELECT id, COALESCE(first_name,'') || CASE WHEN last_name IS NOT NULL AND last_name <> '' THEN ' ' || last_name ELSE '' END AS name
                    FROM tbl_users 
                    WHERE role = 'business_head' AND reporting_to = %s
                """, (cluster_manager_id,))
                bh_rows = cur.fetchall()
                bh_data = {row[0]: row[1] for row in bh_rows}
                bh_ids = list(bh_data.keys())
                
                if not bh_ids:
                    return {"distribution": []}
                
                # Get Managers under those Business Heads
                manager_ids: List[int] = []
                if bh_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'manager' AND reporting_to = ANY(%s)
                    """, (bh_ids,))
                    manager_rows = cur.fetchall()
                    manager_ids = [row[0] for row in manager_rows] if manager_rows else []
                
                # Get Team Leaders under those Managers
                tl_ids: List[int] = []
                if manager_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'team_leader' AND reporting_to = ANY(%s)
                    """, (manager_ids,))
                    tl_rows = cur.fetchall()
                    tl_ids = [row[0] for row in tl_rows] if tl_rows else []
                
                # Get recruiters under those TLs
                recruiter_ids: List[int] = []
                if tl_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'recruiter' AND reporting_to = ANY(%s)
                    """, (tl_ids,))
                    rec_rows = cur.fetchall()
                    recruiter_ids = [row[0] for row in rec_rows] if rec_rows else []
                
                if not recruiter_ids:
                    return {"distribution": []}
                
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND ds.demand_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND ds.demand_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND ds.demand_date <= %s"
                    date_params = [end_date]
                
                # Count demands per Business Head (via recruiter -> TL -> Manager -> BH mapping)
                query = f"""
                    SELECT 
                        bh.id AS business_head_id,
                        COALESCE(bh.first_name,'') || CASE WHEN bh.last_name IS NOT NULL AND bh.last_name <> '' THEN ' ' || bh.last_name ELSE '' END AS business_head_name,
                        COUNT(DISTINCT ds.id) AS demand_count
                    FROM tbl_demand_sheet ds
                    JOIN jsonb_array_elements(ds.assigned_to) AS assignment ON (assignment->>'recruiter_id')::int = ANY(%s)
                    JOIN tbl_users r ON r.id = (assignment->>'recruiter_id')::int AND r.role = 'recruiter'
                    JOIN tbl_users tl ON tl.id = r.reporting_to AND tl.role = 'team_leader'
                    JOIN tbl_users m ON m.id = tl.reporting_to AND m.role = 'manager'
                    JOIN tbl_users bh ON bh.id = m.reporting_to AND bh.role = 'business_head'
                    WHERE ds.assigned_to IS NOT NULL
                    {date_filter}
                    GROUP BY bh.id, bh.first_name, bh.last_name
                    ORDER BY demand_count DESC
                """
                params: List[Any] = [recruiter_ids] + date_params
                cur.execute(query, params)
                rows = cur.fetchall()
                
                total = sum(row[2] for row in rows) if rows else 0
                
                distribution = [
                    {
                        "business_head_id": row[0],
                        "business_head_name": row[1] or "",
                        "count": row[2],
                        "percentage": round((row[2] / total * 100) if total > 0 else 0, 1)
                    }
                    for row in rows
                ]
                
                return {"distribution": distribution}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch demand by business heads: {e}")


@router.get("/clustermanager/dashboard/demand-by-status")
async def get_clustermanager_demand_by_status(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get demand count by status for Cluster Manager (aggregates from all recruiters under their Business Heads).
    Date filter applies to updated_at from demand_sheet table.
    """
    try:
        cluster_manager_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not cluster_manager_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get Business Heads under this Cluster Manager
                cur.execute("""
                    SELECT id FROM tbl_users 
                    WHERE role = 'business_head' AND reporting_to = %s
                """, (cluster_manager_id,))
                bh_rows = cur.fetchall()
                bh_ids = [row[0] for row in bh_rows] if bh_rows else []
                
                # Get Managers under those Business Heads
                manager_ids: List[int] = []
                if bh_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'manager' AND reporting_to = ANY(%s)
                    """, (bh_ids,))
                    manager_rows = cur.fetchall()
                    manager_ids = [row[0] for row in manager_rows] if manager_rows else []
                
                # Get Team Leaders under those Managers
                tl_ids: List[int] = []
                if manager_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'team_leader' AND reporting_to = ANY(%s)
                    """, (manager_ids,))
                    tl_rows = cur.fetchall()
                    tl_ids = [row[0] for row in tl_rows] if tl_rows else []
                
                # Get recruiters under those TLs
                recruiter_ids: List[int] = []
                if tl_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'recruiter' AND reporting_to = ANY(%s)
                    """, (tl_ids,))
                    rec_rows = cur.fetchall()
                    recruiter_ids = [row[0] for row in rec_rows] if rec_rows else []
                
                if not recruiter_ids:
                    return {"status_counts": []}
                
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND DATE(ds.updated_at) BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND DATE(ds.updated_at) >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND DATE(ds.updated_at) <= %s"
                    date_params = [end_date]
                
                # Get demands assigned to these recruiters and count by status
                query = f"""
                    SELECT 
                        COALESCE(LOWER(CAST(ds.status AS TEXT)), 'unknown') as status,
                        COUNT(DISTINCT ds.id) as count
                    FROM tbl_demand_sheet ds
                    WHERE ds.assigned_to IS NOT NULL
                    AND ds.assigned_to != '[]'::jsonb
                    AND jsonb_typeof(ds.assigned_to) = 'array'
                    AND EXISTS (
                        SELECT 1 FROM jsonb_array_elements(ds.assigned_to) AS assignment
                        WHERE (assignment->>'recruiter_id')::int = ANY(%s)
                    )
                    {date_filter}
                    GROUP BY ds.status
                    ORDER BY count DESC
                """
                params: List[Any] = [recruiter_ids] + date_params
                cur.execute(query, params)
                rows = cur.fetchall()
                
                status_counts = [
                    {
                        "status": row[0] or "unknown",
                        "count": row[1]
                    }
                    for row in rows
                ]
                
                return {"status_counts": status_counts}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch demand by status: {e}")


@router.get("/clustermanager/dashboard/demand-by-skill")
async def get_clustermanager_demand_by_skill(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get distribution of demands by skill for Cluster Manager (aggregates from all recruiters under their Business Heads).
    Date filter applies to demand_date from demand_sheet table.
    """
    try:
        cluster_manager_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not cluster_manager_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get Business Heads under this Cluster Manager
                cur.execute("""
                    SELECT id FROM tbl_users 
                    WHERE role = 'business_head' AND reporting_to = %s
                """, (cluster_manager_id,))
                bh_rows = cur.fetchall()
                bh_ids = [row[0] for row in bh_rows] if bh_rows else []
                
                # Get Managers under those Business Heads
                manager_ids: List[int] = []
                if bh_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'manager' AND reporting_to = ANY(%s)
                    """, (bh_ids,))
                    manager_rows = cur.fetchall()
                    manager_ids = [row[0] for row in manager_rows] if manager_rows else []
                
                # Get Team Leaders under those Managers
                tl_ids: List[int] = []
                if manager_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'team_leader' AND reporting_to = ANY(%s)
                    """, (manager_ids,))
                    tl_rows = cur.fetchall()
                    tl_ids = [row[0] for row in tl_rows] if tl_rows else []
                
                # Get recruiters under those TLs
                recruiter_ids: List[int] = []
                if tl_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'recruiter' AND reporting_to = ANY(%s)
                    """, (tl_ids,))
                    rec_rows = cur.fetchall()
                    recruiter_ids = [row[0] for row in rec_rows] if rec_rows else []
                
                if not recruiter_ids:
                    return {"skill_distribution": []}
                
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND ds.demand_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND ds.demand_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND ds.demand_date <= %s"
                    date_params = [end_date]
                
                # Get skills from demand_sheet via recruiter_activity.demand_id
                query = f"""
                    SELECT 
                        COALESCE(ds.skill, 'Unknown') as skill,
                        COUNT(DISTINCT ra.demand_id) as demand_count
                    FROM tbl_recruiter_activity ra
                    LEFT JOIN tbl_demand_sheet ds ON ra.demand_id = ds.id
                    WHERE ra.recruiter_id = ANY(%s)
                    {date_filter}
                    GROUP BY ds.skill
                    ORDER BY demand_count DESC
                """
                params: List[Any] = [recruiter_ids] + date_params
                cur.execute(query, params)
                rows = cur.fetchall()
                
                total = sum(row[1] for row in rows) if rows else 0
                
                skill_distribution = [
                    {
                        "skill": row[0] or "Unknown",
                        "count": row[1],
                        "percentage": round((row[1] / total * 100) if total > 0 else 0, 1)
                    }
                    for row in rows
                ]
                
                return {"skill_distribution": skill_distribution}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch demand by skill: {e}")


@router.get("/clustermanager/dashboard/submissions-by-business-heads")
async def get_clustermanager_submissions_by_business_heads(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get submissions grouped by Business Heads for Cluster Manager (all Business Heads under the Cluster Manager).
    Data source: tbl_submissions; date filter uses submission_date.
    """
    try:
        cluster_manager_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not cluster_manager_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND s.submission_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND s.submission_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND s.submission_date <= %s"
                    date_params = [end_date]
                
                # Count submissions grouped by Business Head (via recruiter -> TL -> Manager -> BH hierarchy)
                query = f"""
                    SELECT 
                        bh.id AS business_head_id,
                        COALESCE(bh.first_name,'') || CASE WHEN bh.last_name IS NOT NULL AND bh.last_name <> '' THEN ' ' || bh.last_name ELSE '' END AS business_head_name,
                        COUNT(*) AS submission_count
                    FROM tbl_submissions s
                    JOIN tbl_users r ON r.id = s.recruiter_id AND r.role = 'recruiter'
                    JOIN tbl_users tl ON tl.id = r.reporting_to AND tl.role = 'team_leader'
                    JOIN tbl_users m ON m.id = tl.reporting_to AND m.role = 'manager'
                    JOIN tbl_users bh ON bh.id = m.reporting_to AND bh.role = 'business_head'
                    WHERE bh.reporting_to = %s
                    {date_filter}
                    GROUP BY bh.id, bh.first_name, bh.last_name
                    ORDER BY submission_count DESC
                """
                params: List[Any] = [cluster_manager_id] + date_params
                cur.execute(query, params)
                rows = cur.fetchall()
                
                business_head_submissions = [
                    {
                        "business_head_id": row[0],
                        "business_head_name": row[1] or "",
                        "count": row[2]
                    }
                    for row in rows
                ]
                
                return {"business_head_submissions": business_head_submissions}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch submissions by business heads: {e}")


@router.get("/clustermanager/dashboard/demand-by-spocs")
async def get_clustermanager_demand_by_spocs(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get demand distribution by SPOCs for Cluster Manager (aggregates from all recruiters under their Business Heads).
    Date filter applies to demand_date from demand_sheet table.
    """
    try:
        cluster_manager_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not cluster_manager_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get Business Heads under this Cluster Manager
                cur.execute("""
                    SELECT id FROM tbl_users 
                    WHERE role = 'business_head' AND reporting_to = %s
                """, (cluster_manager_id,))
                bh_rows = cur.fetchall()
                bh_ids = [row[0] for row in bh_rows] if bh_rows else []
                
                # Get Managers under those Business Heads
                manager_ids: List[int] = []
                if bh_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'manager' AND reporting_to = ANY(%s)
                    """, (bh_ids,))
                    manager_rows = cur.fetchall()
                    manager_ids = [row[0] for row in manager_rows] if manager_rows else []
                
                # Get Team Leaders under those Managers
                tl_ids: List[int] = []
                if manager_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'team_leader' AND reporting_to = ANY(%s)
                    """, (manager_ids,))
                    tl_rows = cur.fetchall()
                    tl_ids = [row[0] for row in tl_rows] if tl_rows else []
                
                # Get recruiters under those TLs
                recruiter_ids: List[int] = []
                if tl_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'recruiter' AND reporting_to = ANY(%s)
                    """, (tl_ids,))
                    rec_rows = cur.fetchall()
                    recruiter_ids = [row[0] for row in rec_rows] if rec_rows else []
                
                if not recruiter_ids:
                    return {"distribution": []}
                
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND ds.demand_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND ds.demand_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND ds.demand_date <= %s"
                    date_params = [end_date]
                
                # Count demands per SPOC
                query = f"""
                    SELECT 
                        ds.spoc_id,
                        COALESCE(cs.spoc_name, 'Unknown SPOC') AS spoc_name,
                        COUNT(DISTINCT ds.id) AS demand_count
                    FROM tbl_demand_sheet ds
                    LEFT JOIN tbl_client_spocs cs ON ds.spoc_id = cs.id
                    WHERE ds.assigned_to IS NOT NULL
                    AND EXISTS (
                        SELECT 1 FROM jsonb_array_elements(ds.assigned_to) AS assignment
                        WHERE (assignment->>'recruiter_id')::int = ANY(%s)
                    )
                    {date_filter}
                    GROUP BY ds.spoc_id, cs.spoc_name
                    ORDER BY demand_count DESC
                """
                params: List[Any] = [recruiter_ids] + date_params
                cur.execute(query, params)
                rows = cur.fetchall()
                
                total = sum(row[2] for row in rows) if rows else 0
                
                distribution = [
                    {
                        "spoc_id": row[0],
                        "spoc_name": row[1] or "Unknown SPOC",
                        "count": row[2],
                        "percentage": round((row[2] / total * 100) if total > 0 else 0, 1)
                    }
                    for row in rows
                ]
                
                return {"distribution": distribution}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch demand by SPOCs: {e}")


@router.get("/clustermanager/dashboard/submissions-by-spocs")
async def get_clustermanager_submissions_by_spocs(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get submissions grouped by SPOC for Cluster Manager (all recruiters under their Business Heads).
    Data source: tbl_submissions; date filter uses submission_date.
    """
    try:
        cluster_manager_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not cluster_manager_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get Business Heads under this Cluster Manager
                cur.execute("""
                    SELECT id FROM tbl_users 
                    WHERE role = 'business_head' AND reporting_to = %s
                """, (cluster_manager_id,))
                bh_rows = cur.fetchall()
                bh_ids = [row[0] for row in bh_rows] if bh_rows else []
                
                # Get Managers under those Business Heads
                manager_ids: List[int] = []
                if bh_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'manager' AND reporting_to = ANY(%s)
                    """, (bh_ids,))
                    manager_rows = cur.fetchall()
                    manager_ids = [row[0] for row in manager_rows] if manager_rows else []
                
                # Get Team Leaders under those Managers
                tl_ids: List[int] = []
                if manager_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'team_leader' AND reporting_to = ANY(%s)
                    """, (manager_ids,))
                    tl_rows = cur.fetchall()
                    tl_ids = [row[0] for row in tl_rows] if tl_rows else []
                
                # Get recruiters under those TLs
                recruiter_ids: List[int] = []
                if tl_ids:
                    cur.execute("""
                        SELECT id FROM tbl_users 
                        WHERE role = 'recruiter' AND reporting_to = ANY(%s)
                    """, (tl_ids,))
                    rec_rows = cur.fetchall()
                    recruiter_ids = [row[0] for row in rec_rows] if rec_rows else []
                
                if not recruiter_ids:
                    return {"spoc_submissions": []}
                
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND s.submission_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND s.submission_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND s.submission_date <= %s"
                    date_params = [end_date]
                
                # Count submissions grouped by SPOC
                query = f"""
                    SELECT 
                        s.spoc_id,
                        COALESCE(cs.spoc_name, 'Unknown SPOC') AS spoc_name,
                        COUNT(*) AS submission_count
                    FROM tbl_submissions s
                    LEFT JOIN tbl_client_spocs cs ON s.spoc_id = cs.id
                    WHERE s.recruiter_id = ANY(%s)
                    {date_filter}
                    GROUP BY s.spoc_id, cs.spoc_name
                    ORDER BY submission_count DESC
                """
                params: List[Any] = [recruiter_ids] + date_params
                cur.execute(query, params)
                rows = cur.fetchall()
                
                spoc_submissions = [
                    {
                        "spoc_id": row[0],
                        "spoc_name": row[1] or "Unknown SPOC",
                        "count": row[2]
                    }
                    for row in rows
                ]
                
                return {"spoc_submissions": spoc_submissions}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch submissions by SPOCs: {e}")


# ============================================
# SuperAdmin Dashboard Endpoints
# ============================================

@router.get("/superadmin/dashboard/key-highlights")
async def get_superadmin_key_highlights(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get key highlights for SuperAdmin: Total Submissions, Current Demand, and Number of Managers
    Aggregates data from ALL recruiters (no hierarchy filter for SuperAdmin)
    """
    try:
        # SuperAdmin has access to all data, no user_id check needed for filtering
        # But we still validate the user is authenticated
        user_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        # Build date filter conditions
        date_filter = ""
        date_params = []
        if start_date and end_date:
            date_filter = """
                AND (
                    (cv->>'recruiter_date')::date BETWEEN %s AND %s
                    OR ((cv->>'recruiter_date') IS NULL AND DATE(ra.updated_at) BETWEEN %s AND %s)
                )
            """
            date_params = [start_date, end_date, start_date, end_date]
        elif start_date:
            date_filter = """
                AND (
                    (cv->>'recruiter_date')::date >= %s
                    OR ((cv->>'recruiter_date') IS NULL AND DATE(ra.updated_at) >= %s)
                )
            """
            date_params = [start_date, start_date]
        elif end_date:
            date_filter = """
                AND (
                    (cv->>'recruiter_date')::date <= %s
                    OR ((cv->>'recruiter_date') IS NULL AND DATE(ra.updated_at) <= %s)
                )
            """
            date_params = [end_date, end_date]
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Total Submissions: Count total number of CVs with status = 1 from ALL recruiters
                total_submissions = 0
                if date_params:
                    # Build the query with date filter - note: ra.updated_at is accessible in subquery via outer query reference
                    if start_date and end_date:
                        query = """
                            SELECT COALESCE(SUM(
                                (SELECT COUNT(*) 
                                 FROM jsonb_array_elements(ra.cv_list) AS cv
                                 WHERE (
                                     cv->>'status' = '1' 
                                     OR (cv->>'status') ~ '^[0-9]+$' AND (cv->>'status')::int = 1
                                 )
                                 AND (
                                     (cv->>'recruiter_date')::date BETWEEN %s AND %s
                                     OR ((cv->>'recruiter_date') IS NULL AND DATE(ra.updated_at) BETWEEN %s AND %s)
                                 ))
                            ), 0) as total_count
                            FROM tbl_recruiter_activity ra
                            WHERE ra.cv_list IS NOT NULL
                            AND jsonb_array_length(ra.cv_list) > 0
                        """
                        params = [start_date, end_date, start_date, end_date]
                    elif start_date:
                        query = """
                            SELECT COALESCE(SUM(
                                (SELECT COUNT(*) 
                                 FROM jsonb_array_elements(ra.cv_list) AS cv
                                 WHERE (
                                     cv->>'status' = '1' 
                                     OR (cv->>'status') ~ '^[0-9]+$' AND (cv->>'status')::int = 1
                                 )
                                 AND (
                                     (cv->>'recruiter_date')::date >= %s
                                     OR ((cv->>'recruiter_date') IS NULL AND DATE(ra.updated_at) >= %s)
                                 ))
                            ), 0) as total_count
                            FROM tbl_recruiter_activity ra
                            WHERE ra.cv_list IS NOT NULL
                            AND jsonb_array_length(ra.cv_list) > 0
                        """
                        params = [start_date, start_date]
                    elif end_date:
                        query = """
                            SELECT COALESCE(SUM(
                                (SELECT COUNT(*) 
                                 FROM jsonb_array_elements(ra.cv_list) AS cv
                                 WHERE (
                                     cv->>'status' = '1' 
                                     OR (cv->>'status') ~ '^[0-9]+$' AND (cv->>'status')::int = 1
                                 )
                                 AND (
                                     (cv->>'recruiter_date')::date <= %s
                                     OR ((cv->>'recruiter_date') IS NULL AND DATE(ra.updated_at) <= %s)
                                 ))
                            ), 0) as total_count
                            FROM tbl_recruiter_activity ra
                            WHERE ra.cv_list IS NOT NULL
                            AND jsonb_array_length(ra.cv_list) > 0
                        """
                        params = [end_date, end_date]
                else:
                    query = """
                        SELECT COALESCE(SUM(
                            (SELECT COUNT(*) 
                             FROM jsonb_array_elements(ra.cv_list) AS cv
                             WHERE (
                                 cv->>'status' = '1' 
                                 OR (cv->>'status') ~ '^[0-9]+$' AND (cv->>'status')::int = 1
                             ))
                        ), 0) as total_count
                        FROM tbl_recruiter_activity ra
                        WHERE ra.cv_list IS NOT NULL
                        AND jsonb_array_length(ra.cv_list) > 0
                    """
                    params = []
                cur.execute(query, params)
                result = cur.fetchone()
                total_submissions = result[0] if result else 0
                
                # Current Demand: Count distinct demands (open or processing)
                query = """
                    SELECT COUNT(DISTINCT id)
                    FROM tbl_demand_sheet
                    WHERE status IN ('open', 'processing')
                """
                cur.execute(query)
                result = cur.fetchone()
                current_demand = result[0] if result else 0
                
                # Number of Managers: Count all managers
                cur.execute("""
                    SELECT COUNT(*) FROM tbl_users 
                    WHERE role = 'manager'
                """)
                result = cur.fetchone()
                number_of_managers = result[0] if result else 0
                
                return {
                    "total_submissions": total_submissions,
                    "current_demand": current_demand,
                    "number_of_managers": number_of_managers
                }
                
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"Failed to fetch superadmin key highlights: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR in get_superadmin_key_highlights: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch superadmin key highlights: {str(e)}")


@router.get("/superadmin/dashboard/daily-submissions-trend")
async def get_superadmin_daily_submissions_trend(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get daily submissions trend for SuperAdmin (all recruiters, no hierarchy filter).
    Data source: tbl_submissions; date filter uses submission_date.
    """
    try:
        user_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND s.submission_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND s.submission_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND s.submission_date <= %s"
                    date_params = [end_date]
                
                # Get daily submissions from ALL recruiters
                query = f"""
                    SELECT 
                        DATE(s.submission_date) as date,
                        COUNT(*) as count
                    FROM tbl_submissions s
                    WHERE 1=1
                    {date_filter}
                    GROUP BY DATE(s.submission_date)
                    ORDER BY DATE(s.submission_date)
                """
                cur.execute(query, date_params)
                rows = cur.fetchall()
                
                daily_trend = [
                    {
                        "date": row[0].isoformat() if isinstance(row[0], date) else str(row[0]),
                        "count": row[1]
                    }
                    for row in rows
                ]
                
                return {"daily_trend": daily_trend}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch daily submissions trend: {e}")


@router.get("/superadmin/dashboard/demand-by-managers")
async def get_superadmin_demand_by_managers(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get demand distribution by Managers for SuperAdmin (all managers).
    """
    try:
        user_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND ds.demand_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND ds.demand_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND ds.demand_date <= %s"
                    date_params = [end_date]
                
                # Get all managers and their demand counts
                query = f"""
                    SELECT 
                        m.id AS manager_id,
                        COALESCE(m.first_name,'') || CASE WHEN m.last_name IS NOT NULL AND m.last_name <> '' THEN ' ' || m.last_name ELSE '' END AS manager_name,
                        COUNT(DISTINCT ds.id) AS demand_count
                    FROM tbl_users m
                    LEFT JOIN tbl_users tl ON tl.reporting_to = m.id AND tl.role = 'team_leader'
                    LEFT JOIN tbl_users r ON r.reporting_to = tl.id AND r.role = 'recruiter'
                    LEFT JOIN tbl_demand_sheet ds ON ds.assigned_to IS NOT NULL
                        AND EXISTS (
                            SELECT 1 FROM jsonb_array_elements(ds.assigned_to) AS assignment
                            WHERE (assignment->>'recruiter_id')::int = r.id
                        )
                        {date_filter}
                    WHERE m.role = 'manager'
                    GROUP BY m.id, m.first_name, m.last_name
                    HAVING COUNT(DISTINCT ds.id) > 0
                    ORDER BY demand_count DESC
                """
                cur.execute(query, date_params)
                rows = cur.fetchall()
                
                total = sum(row[2] for row in rows) if rows else 0
                
                distribution = [
                    {
                        "manager_id": row[0],
                        "manager_name": row[1] or "",
                        "count": row[2],
                        "percentage": round((row[2] / total * 100) if total > 0 else 0, 1)
                    }
                    for row in rows
                ]
                
                return {"distribution": distribution}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch demand by managers: {e}")


@router.get("/superadmin/dashboard/demand-by-status")
async def get_superadmin_demand_by_status(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get demand distribution by status for SuperAdmin (all demands).
    """
    try:
        user_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND demand_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND demand_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND demand_date <= %s"
                    date_params = [end_date]
                
                query = f"""
                    SELECT status, COUNT(*) as count
                    FROM tbl_demand_sheet
                    WHERE 1=1
                    {date_filter}
                    GROUP BY status
                    ORDER BY count DESC
                """
                cur.execute(query, date_params)
                rows = cur.fetchall()
                
                status_counts = [
                    {
                        "status": row[0] or "unknown",
                        "count": row[1]
                    }
                    for row in rows
                ]
                
                return {"status_counts": status_counts}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch demand by status: {e}")


@router.get("/superadmin/dashboard/demand-by-skill")
async def get_superadmin_demand_by_skill(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get demand distribution by skill for SuperAdmin (all demands).
    """
    try:
        user_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND demand_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND demand_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND demand_date <= %s"
                    date_params = [end_date]
                
                query = f"""
                    SELECT skill, COUNT(*) as count
                    FROM tbl_demand_sheet
                    WHERE skill IS NOT NULL AND skill != ''
                    {date_filter}
                    GROUP BY skill
                    ORDER BY count DESC
                """
                cur.execute(query, date_params)
                rows = cur.fetchall()
                
                total = sum(row[1] for row in rows) if rows else 0
                
                skill_distribution = [
                    {
                        "skill": row[0],
                        "count": row[1],
                        "percentage": round((row[1] / total * 100) if total > 0 else 0, 1)
                    }
                    for row in rows
                ]
                
                return {"skill_distribution": skill_distribution}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch demand by skill: {e}")


@router.get("/superadmin/dashboard/submissions-by-managers")
async def get_superadmin_submissions_by_managers(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get submissions grouped by Managers for SuperAdmin (all managers).
    Data source: tbl_submissions; date filter uses submission_date.
    """
    try:
        user_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND s.submission_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND s.submission_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND s.submission_date <= %s"
                    date_params = [end_date]
                
                # Count submissions grouped by Manager (via recruiter -> TL -> Manager hierarchy)
                query = f"""
                    SELECT 
                        m.id AS manager_id,
                        COALESCE(m.first_name,'') || CASE WHEN m.last_name IS NOT NULL AND m.last_name <> '' THEN ' ' || m.last_name ELSE '' END AS manager_name,
                        COUNT(*) AS submission_count
                    FROM tbl_submissions s
                    JOIN tbl_users r ON r.id = s.recruiter_id AND r.role = 'recruiter'
                    JOIN tbl_users tl ON tl.id = r.reporting_to AND tl.role = 'team_leader'
                    JOIN tbl_users m ON m.id = tl.reporting_to AND m.role = 'manager'
                    WHERE 1=1
                    {date_filter}
                    GROUP BY m.id, m.first_name, m.last_name
                    ORDER BY submission_count DESC
                """
                cur.execute(query, date_params)
                rows = cur.fetchall()
                
                manager_submissions = [
                    {
                        "manager_id": row[0],
                        "manager_name": row[1] or "",
                        "count": row[2]
                    }
                    for row in rows
                ]
                
                return {"manager_submissions": manager_submissions}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch submissions by managers: {e}")


@router.get("/superadmin/dashboard/demand-by-spocs")
async def get_superadmin_demand_by_spocs(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get demand distribution by SPOCs for SuperAdmin (all demands).
    """
    try:
        user_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND ds.demand_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND ds.demand_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND ds.demand_date <= %s"
                    date_params = [end_date]
                
                # Count demands per SPOC (all demands)
                query = f"""
                    SELECT 
                        ds.spoc_id,
                        COALESCE(cs.spoc_name, 'Unknown SPOC') AS spoc_name,
                        COUNT(DISTINCT ds.id) AS demand_count
                    FROM tbl_demand_sheet ds
                    LEFT JOIN tbl_client_spocs cs ON ds.spoc_id = cs.id
                    WHERE ds.assigned_to IS NOT NULL
                    {date_filter}
                    GROUP BY ds.spoc_id, cs.spoc_name
                    ORDER BY demand_count DESC
                """
                cur.execute(query, date_params)
                rows = cur.fetchall()
                
                total = sum(row[2] for row in rows) if rows else 0
                
                distribution = [
                    {
                        "spoc_id": row[0],
                        "spoc_name": row[1] or "Unknown SPOC",
                        "count": row[2],
                        "percentage": round((row[2] / total * 100) if total > 0 else 0, 1)
                    }
                    for row in rows
                ]
                
                return {"distribution": distribution}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch demand by SPOCs: {e}")


@router.get("/superadmin/dashboard/submissions-by-spocs")
async def get_superadmin_submissions_by_spocs(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get submissions grouped by SPOC for SuperAdmin (all recruiters).
    Data source: tbl_submissions; date filter uses submission_date.
    """
    try:
        user_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Build date filter
                date_filter = ""
                date_params: List[Any] = []
                if start_date and end_date:
                    date_filter = "AND s.submission_date BETWEEN %s AND %s"
                    date_params = [start_date, end_date]
                elif start_date:
                    date_filter = "AND s.submission_date >= %s"
                    date_params = [start_date]
                elif end_date:
                    date_filter = "AND s.submission_date <= %s"
                    date_params = [end_date]
                
                # Count submissions grouped by SPOC (all recruiters)
                query = f"""
                    SELECT 
                        s.spoc_id,
                        COALESCE(cs.spoc_name, 'Unknown SPOC') AS spoc_name,
                        COUNT(*) AS submission_count
                    FROM tbl_submissions s
                    LEFT JOIN tbl_client_spocs cs ON s.spoc_id = cs.id
                    WHERE 1=1
                    {date_filter}
                    GROUP BY s.spoc_id, cs.spoc_name
                    ORDER BY submission_count DESC
                """
                cur.execute(query, date_params)
                rows = cur.fetchall()
                
                spoc_submissions = [
                    {
                        "spoc_id": row[0],
                        "spoc_name": row[1] or "Unknown SPOC",
                        "count": row[2]
                    }
                    for row in rows
                ]
                
                return {"spoc_submissions": spoc_submissions}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch submissions by SPOCs: {e}")
