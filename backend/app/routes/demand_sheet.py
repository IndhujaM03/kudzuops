import os
import json
from typing import Any, Dict, List, Optional

import psycopg
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

try:
    from ..config import settings
    DATABASE_DSN = settings.database_url
except Exception:
    # Default DSN targets kudzuops database; can be overridden by env var DATABASE_URL
    DATABASE_DSN = os.getenv(
        "DATABASE_URL",
        "postgresql://kudzuops:kudzu%40%402025@127.0.0.1:5432/kudzuops",
    )


router = APIRouter(tags=["demand"])


def _rows_to_dicts(columns: List[str], rows: List[tuple]) -> List[Dict[str, Any]]:
    return [dict(zip(columns, row)) for row in rows]


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

    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    (
                        "INSERT INTO tbl_demand_sheet (demand_date, client_id, spoc_id, skill, no_of_positions, "
                        "required_cv_count, priority, job_description_url, remarks, status, created_at) "
                        "VALUES (CURRENT_DATE, %s, %s, %s, %s, %s, %s, %s, %s, %s, COALESCE(%s::demand_status_enum, 'open'::demand_status_enum), NOW()) RETURNING id"
                    ),
                    (
                        client_id,
                        spoc_id,
                        skills,
                        no_of_positions,
                        required_cv_count,
                        (priority or None).lower() if priority else None,
                        job_description_url,
                        remarks,
                        (status or None),
                    ),
                )
                new_id = cur.fetchone()[0]
                
                # Create initial recruiter activity record with required_cv_count
                # This ensures the required_cv_count is stored in both tables as specified
                cur.execute(
                    "INSERT INTO tbl_recruiter_activity (recruiter_id, analysis_date, required_cv_count, demand_id, created_at) VALUES (%s, CURRENT_DATE, %s, %s, NOW())",
                    (None, required_cv_count, new_id)  # recruiter_id will be set when demand is assigned
                )
                
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
def list_unassigned() -> List[Dict[str, Any]]:
    """Demand sheets where assigned_to IS NULL or empty array."""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    (
                        "SELECT d.*, c.client_name, s.spoc_name FROM tbl_demand_sheet d "
                        "LEFT JOIN tbl_clients c ON c.id = d.client_id "
                        "LEFT JOIN tbl_client_spocs s ON s.id = d.spoc_id "
                        "WHERE d.assigned_to IS NULL OR array_length(d.assigned_to, 1) IS NULL "
                        "ORDER BY d.id DESC"
                    )
                )
                rows = cur.fetchall()
                columns = [desc[0] for desc in cur.description]
                return _rows_to_dicts(columns, rows)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch unassigned demands: {e}")


@router.get("/demand/assigned")
def list_assigned(recruiter_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """Demand sheets where assigned_to IS NOT NULL with recruiter name."""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                if recruiter_id:
                    cur.execute(
                        (
                            "SELECT d.*, c.client_name, s.spoc_name, u.first_name as recruiter_first_name, u.last_name as recruiter_last_name, u.email as recruiter_email, u.role as recruiter_role "
                            "FROM tbl_demand_sheet d "
                            "LEFT JOIN tbl_clients c ON c.id = d.client_id "
                            "LEFT JOIN tbl_client_spocs s ON s.id = d.spoc_id "
                            "LEFT JOIN tbl_users u ON u.id = d.recruiter_id "
                            "WHERE d.recruiter_id = %s AND d.assigned_to IS NOT NULL "
                            "ORDER BY d.id DESC"
                        ),
                        (recruiter_id,),
                    )
                else:
                    cur.execute(
                        """
                        SELECT d.*, c.client_name, s.spoc_name
                        FROM tbl_demand_sheet d 
                        LEFT JOIN tbl_clients c ON c.id = d.client_id 
                        LEFT JOIN tbl_client_spocs s ON s.id = d.spoc_id 
                        WHERE d.assigned_to IS NOT NULL AND array_length(d.assigned_to, 1) > 0 
                        ORDER BY d.id DESC
                        """
                    )
                rows = cur.fetchall()
                columns = [desc[0] for desc in cur.description]
                result = _rows_to_dicts(columns, rows)
                
                # For each demand, fetch the assigned recruiter names
                for demand in result:
                    if demand.get('assigned_to'):
                        # Fetch recruiter names for this demand
                        cur.execute(
                            "SELECT first_name FROM tbl_users WHERE id = ANY(%s) ORDER BY first_name",
                            (demand['assigned_to'],)
                        )
                        recruiter_names = [row[0] for row in cur.fetchall()]
                        demand['assigned_recruiter_names'] = recruiter_names
                    else:
                        demand['assigned_recruiter_names'] = []
                
                return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch assigned demands: {e}")


@router.get("/demand/submitted")
def list_submitted() -> List[Dict[str, Any]]:
    """Submitted demand sheets with profile count from tbl_recruiter_activity."""
    try:
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
                        "WHERE d.assigned_to IS NOT NULL "
                        "GROUP BY d.id, c.client_name, s.spoc_name "
                        "HAVING COUNT(ra.id) > 0 "
                        "ORDER BY d.id DESC"
                    )
                )
                rows = cur.fetchall()
                columns = [desc[0] for desc in cur.description]
                return _rows_to_dicts(columns, rows)
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
                # Insert into tbl_submissions
                cur.execute(
                    "INSERT INTO tbl_submissions (demand_id, action, submitted_at) VALUES (%s, %s, NOW())",
                    (demand_id, action)
                )
                conn.commit()
                return {"message": f"Demand {action} successfully"}
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
                # Update tbl_demand_sheet with assigned_to and recruiter_id
                cur.execute(
                    "UPDATE tbl_demand_sheet SET assigned_to=%s, recruiter_id=%s WHERE id=%s",
                    (recruiter_id, recruiter_id, demand_id),
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
                # Convert recruiter IDs to array format for assigned_to column
                recruiter_array = f"{{{','.join(map(str, recruiters))}}}"
                # For recruiter_id, use the first recruiter as primary
                primary_recruiter_id = recruiters[0] if recruiters else None
                
                if not primary_recruiter_id:
                    raise HTTPException(status_code=400, detail="At least one recruiter is required")
                
                print(f"🔍 Updating demand {demand_id} with assigned_to={recruiter_array}, recruiter_id={primary_recruiter_id}")
                
                cur.execute(
                    "UPDATE tbl_demand_sheet SET assigned_to=%s, recruiter_id=%s WHERE id=%s",
                    (recruiter_array, primary_recruiter_id, demand_id),
                )
                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="Demand not found")
                conn.commit()
                print(f"✅ Successfully updated demand {demand_id}")
                return {"message": "Recruiters assigned successfully"}
    except Exception as e:
        print(f"❌ Error assigning recruiters: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to assign recruiters: {e}")

@router.get("/teamleaders")
def list_team_leaders() -> List[Dict[str, Any]]:
    """Get all team leaders from tbl_users where role = team_leader."""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # First try to get users with role = 'team_leader'
                cur.execute(
                    "SELECT id, first_name, last_name, email, role FROM tbl_users WHERE role = 'team_leader' ORDER BY first_name"
                )
                rows = cur.fetchall()
                print(f"🔍 Found {len(rows)} team leaders with role='team_leader'")
                
                # If no team leaders found, get all users (for testing)
                if not rows:
                    print("⚠️ No team leaders found, fetching all users")
                    cur.execute(
                        "SELECT id, first_name, last_name, email, role FROM tbl_users ORDER BY first_name"
                    )
                    rows = cur.fetchall()
                    print(f"🔍 Found {len(rows)} total users")
                
                columns = [desc[0] for desc in cur.description]
                result = _rows_to_dicts(columns, rows)
                print(f"✅ Returning {len(result)} team leaders/users")
                return result
    except Exception as e:
        print(f"❌ Error fetching team leaders: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch team leaders: {e}")

@router.get("/teamleaders/{team_leader_id}/recruiters")
def list_recruiters_by_team_leader(team_leader_id: int) -> List[Dict[str, Any]]:
    """Get recruiters for a specific team leader based on reporting_to field."""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get recruiters that report to this team leader
                cur.execute(
                    "SELECT id, first_name, last_name, email, role FROM tbl_users WHERE role = 'recruiter' AND reporting_to = %s ORDER BY first_name",
                    (team_leader_id,)
                )
                rows = cur.fetchall()
                columns = [desc[0] for desc in cur.description]
                return _rows_to_dicts(columns, rows)
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
async def get_cv_received():
    """Get CVs waiting for approval (status = 0) from tbl_recruiter_activity"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Query to get CVs with status = 0 (waiting for approval)
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
                        cs.spoc_name
                    FROM tbl_recruiter_activity ra
                    LEFT JOIN tbl_users u ON ra.recruiter_id = u.id
                    LEFT JOIN tbl_demand_sheet ds ON ra.demand_id = ds.id
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    LEFT JOIN tbl_client_spocs cs ON ds.spoc_id = cs.id
                    WHERE ra.cv_list IS NOT NULL 
                    AND jsonb_array_length(ra.cv_list) > 0
                    AND EXISTS (
                        SELECT 1 FROM jsonb_array_elements(ra.cv_list) AS cv
                        WHERE cv->>'status' = '0'
                    )
                    ORDER BY ra.created_at DESC
                """)
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
                                    cv['cv_url'] = f"http://localhost:8000/cv-file/{row['recruiter_id']}/{row['demand_id']}/{encoded_filename}"
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
    """Approve a CV (change status from 0 to 1) and update demand status if needed"""
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

                # Update CV status to approved (1) based on candidate_id
                updated_cv_list = []
                for i, cv in enumerate(cv_list):
                    cv_dict = dict(cv)
                    if i == target_index:
                        cv_dict['status'] = 1
                    updated_cv_list.append(cv_dict)
                
                # Update the cv_list and check if all CVs for this activity are approved
                cur.execute("""
                    UPDATE tbl_recruiter_activity 
                    SET cv_list = %s, updated_at = now()
                    WHERE id = %s AND recruiter_id = %s
                """, (json.dumps(updated_cv_list), activity_id, recruiter_id))
                
                # Check if all CVs in this activity are approved
                all_approved = all(cv.get('status') == 1 for cv in updated_cv_list)
                if all_approved:
                    cur.execute("""
                        UPDATE tbl_recruiter_activity 
                        SET activity_status = 'closed'
                        WHERE id = %s AND recruiter_id = %s
                    """, (activity_id, recruiter_id))
                
                # Check if uploaded_cv_count equals required_cv_count for this activity
                cur.execute("""
                    SELECT uploaded_cv_count, required_cv_count 
                    FROM tbl_recruiter_activity 
                    WHERE id = %s
                """, (activity_id,))
                activity_data = cur.fetchone()
                if activity_data:
                    uploaded_count, required_count = activity_data
                    
                    # If uploaded_cv_count equals required_cv_count, close the activity and demand
                    if uploaded_count == required_count:
                        cur.execute("""
                            UPDATE tbl_recruiter_activity 
                            SET activity_status = 'closed'
                            WHERE id = %s
                        """, (activity_id,))
                        
                        # Also close the demand
                        cur.execute("""
                            UPDATE tbl_demand_sheet 
                            SET status = 'closed', updated_at = now() 
                            WHERE id = %s
                        """, (demand_id,))
                
                conn.commit()
                return {"message": "CV approved successfully"}
                
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to approve CV: {e}")


@router.post("/cv-reject/{activity_id}")
async def reject_cv(activity_id: int, request: Request, cv_index: Optional[int] = None, cv_id: Optional[str] = None):
    """Reject a CV (change status from 0 to 2) and decrement uploaded_cv_count"""
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

                # Update CV status to rejected (2) based on candidate_id
                updated_cv_list = []
                for i, cv in enumerate(cv_list):
                    cv_dict = dict(cv)
                    if i == target_index:
                        cv_dict['status'] = 2
                    updated_cv_list.append(cv_dict)
                
                # Update the cv_list for the current activity (do not change activity_status)
                cur.execute("""
                    UPDATE tbl_recruiter_activity 
                    SET cv_list = %s, updated_at = now()
                    WHERE id = %s AND recruiter_id = %s
                """, (json.dumps(updated_cv_list), activity_id, recruiter_id))

                # Decrement uploaded_cv_count for ALL recruiters associated with this demand
                cur.execute("""
                    UPDATE tbl_recruiter_activity
                    SET uploaded_cv_count = GREATEST(COALESCE(uploaded_cv_count, 0) - 1, 0),
                        updated_at = now()
                    WHERE demand_id = %s
                """, (demand_id,))
                
                # Update demand sheet status back to open if it was closed
                cur.execute(
                    """
                    UPDATE tbl_demand_sheet 
                    SET 
                        status = CASE WHEN status = 'closed' THEN 'open' ELSE status END,
                        updated_at = now()
                    WHERE id = %s
                    """,
                    (demand_id,),
                )

                # Recompute total uploaded across activities and update demand status accordingly
                cur.execute("SELECT COALESCE(SUM(uploaded_cv_count),0) FROM tbl_recruiter_activity WHERE demand_id=%s", (demand_id,))
                total_uploaded = cur.fetchone()[0] or 0
                cur.execute("SELECT COALESCE(required_cv_count,0) FROM tbl_demand_sheet WHERE id=%s", (demand_id,))
                req = cur.fetchone()[0] or 0
                if req > 0 and total_uploaded >= req:
                    cur.execute("UPDATE tbl_demand_sheet SET status='closed', updated_at=now() WHERE id=%s", (demand_id,))
                else:
                    cur.execute("UPDATE tbl_demand_sheet SET status='open', updated_at=now() WHERE id=%s", (demand_id,))
                
                conn.commit()
                return {
                    "message": "CV rejected successfully",
                    "demand_status": "open"
                }
                
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to reject CV: {e}")


@router.get("/cv-submitted")
async def get_cv_submitted():
    """Get approved CVs (status = 1) for the Submitted tab"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Query to get approved CVs (status = 1)
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
                        cs.spoc_name
                    FROM tbl_recruiter_activity ra
                    LEFT JOIN tbl_users u ON ra.recruiter_id = u.id
                    LEFT JOIN tbl_demand_sheet ds ON ra.demand_id = ds.id
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    LEFT JOIN tbl_client_spocs cs ON ds.spoc_id = cs.id
                    WHERE ra.cv_list IS NOT NULL 
                    AND jsonb_array_length(ra.cv_list) > 0
                    AND EXISTS (
                        SELECT 1 FROM jsonb_array_elements(ra.cv_list) AS cv
                        WHERE cv->>'status' = '1'
                    )
                    ORDER BY ra.updated_at DESC
                """)
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
                                    cv['cv_url'] = f"http://localhost:8000/cv-file/{row['recruiter_id']}/{row['demand_id']}/{encoded_filename}"
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
        raise HTTPException(status_code=500, detail=f"Failed to fetch submitted CVs: {e}")


@router.get("/cv-file/{recruiter_id}/{demand_id}/{filename:path}")
async def get_cv_file(recruiter_id: int, demand_id: int, filename: str):
    """Serve CV files with proper error handling"""
    try:
        # Construct the file path - fix the path construction
        cv_uploads_path = os.path.join(os.path.dirname(__file__), "..", "..", "src", "assets", "cv_uploads")
        
        # Check if filename already contains the full path
        if filename.startswith("src/assets/cv_uploads/"):
            # Extract just the filename from the full path
            filename = os.path.basename(filename)
        
        file_path = os.path.join(cv_uploads_path, str(recruiter_id), str(demand_id), filename)
        
        # Debug: Print paths for troubleshooting
        print(f"🔍 CV File Request Debug:")
        print(f"   Recruiter ID: {recruiter_id}")
        print(f"   Demand ID: {demand_id}")
        print(f"   Filename: {filename}")
        print(f"   CV Uploads Path: {cv_uploads_path}")
        print(f"   Full File Path: {file_path}")
        print(f"   Path Exists: {os.path.exists(cv_uploads_path)}")
        print(f"   File Exists: {os.path.exists(file_path)}")
        
        # Check if CV uploads directory exists
        if not os.path.exists(cv_uploads_path):
            print(f"❌ CV uploads directory not found: {cv_uploads_path}")
            raise HTTPException(status_code=404, detail=f"CV uploads directory not found: {cv_uploads_path}")
        
        # Check if file exists
        if not os.path.exists(file_path):
            print(f"❌ CV file not found: {file_path}")
            raise HTTPException(status_code=404, detail=f"CV file not found: {file_path}")
        
        # Check if it's a file (not a directory)
        if not os.path.isfile(file_path):
            print(f"❌ Path is not a file: {file_path}")
            raise HTTPException(status_code=404, detail="CV file not found")
        
        # Determine content type based on file extension
        file_extension = os.path.splitext(filename)[1].lower()
        if file_extension == ".pdf":
            media_type = "application/pdf"
        elif file_extension in [".doc", ".docx"]:
            media_type = "application/msword"
        else:
            media_type = "application/octet-stream"
        
        print(f"✅ Serving CV file: {file_path}")
        return FileResponse(
            path=file_path,
            media_type=media_type,
            filename=filename,
            headers={"Content-Disposition": f"inline; filename={filename}"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error serving CV file: {e}")
        raise HTTPException(status_code=500, detail=f"Error serving CV file: {e}")


@router.get("/cv-files-list")
async def list_cv_files():
    """List available CV files for debugging"""
    try:
        cv_uploads_path = os.path.join(os.path.dirname(__file__), "..", "..", "src", "assets", "cv_uploads")
        
        if not os.path.exists(cv_uploads_path):
            return {"error": f"CV uploads directory not found: {cv_uploads_path}"}
        
        files_list = []
        for root, dirs, files in os.walk(cv_uploads_path):
            for file in files:
                rel_path = os.path.relpath(os.path.join(root, file), cv_uploads_path)
                files_list.append({
                    "path": rel_path,
                    "full_path": os.path.join(root, file),
                    "exists": os.path.exists(os.path.join(root, file))
                })
        
        return {
            "cv_uploads_path": cv_uploads_path,
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
        cv_uploads_path = os.path.join(os.path.dirname(__file__), "..", "..", "src", "assets", "cv_uploads")
        
        # Check if filename already contains the full path
        if filename.startswith("src/assets/cv_uploads/"):
            # Extract just the filename from the full path
            filename = os.path.basename(filename)
        
        file_path = os.path.join(cv_uploads_path, str(recruiter_id), str(demand_id), filename)
        
        # Check if CV uploads directory exists
        if not os.path.exists(cv_uploads_path):
            return {"exists": False, "error": f"CV uploads directory not found: {cv_uploads_path}"}
        
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

