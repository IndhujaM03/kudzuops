import os
import json
from datetime import datetime
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
                cur.execute(
                    """
                    INSERT INTO tbl_demand_sheet 
                    (demand_date, client_id, spoc_id, skill, no_of_positions, 
                     required_cv_count, priority, job_description_url, remarks, status, assigned_to, created_at)
                    VALUES (CURRENT_DATE, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, NOW())
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
def list_unassigned() -> List[Dict[str, Any]]:
    """Demand sheets where assigned_to IS NULL or empty JSON array."""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT d.*, c.client_name, s.spoc_name 
                    FROM tbl_demand_sheet d 
                    LEFT JOIN tbl_clients c ON c.id = d.client_id 
                    LEFT JOIN tbl_client_spocs s ON s.id = d.spoc_id 
                    WHERE d.assigned_to IS NULL 
                       OR d.assigned_to = '[]'::jsonb 
                       OR d.assigned_to = 'null'::jsonb
                       OR jsonb_array_length(COALESCE(d.assigned_to, '[]'::jsonb)) = 0
                    ORDER BY d.id DESC
                    """
                )
                rows = cur.fetchall()
                columns = [desc[0] for desc in cur.description]
                return _rows_to_dicts(columns, rows)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch unassigned demands: {e}")


@router.get("/demand/assigned")
def list_assigned(recruiter_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """Demand sheets where assigned_to contains recruiter assignments."""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                if recruiter_id:
                    # Get demands assigned to specific recruiter
                    cur.execute(
                        """
                        SELECT d.*, c.client_name, s.spoc_name
                        FROM tbl_demand_sheet d 
                        LEFT JOIN tbl_clients c ON c.id = d.client_id 
                        LEFT JOIN tbl_client_spocs s ON s.id = d.spoc_id 
                        WHERE d.assigned_to::text LIKE %s
                        ORDER BY d.id DESC
                        """,
                        (f"%{recruiter_id}%",)
                    )
                else:
                    # Get all assigned demands with aggregated CV counts
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
                        WHERE d.assigned_to IS NOT NULL 
                           AND d.assigned_to != '[]'::jsonb 
                           AND d.assigned_to != 'null'::jsonb
                           AND jsonb_array_length(COALESCE(d.assigned_to, '[]'::jsonb)) > 0
                        GROUP BY d.id, d.demand_date, d.client_id, d.spoc_id, d.skill, d.no_of_positions, d.status, d.priority, d.job_description_url, d.remarks, d.created_at, d.updated_at, d.required_cv_count, d.assigned_to, c.client_name, s.spoc_name
                        ORDER BY d.id DESC
                        """
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
                                
                                if recruiter_ids:
                                    # Fetch recruiter names
                                    placeholders = ','.join(['%s'] * len(recruiter_ids))
                                    cur.execute(
                                        f"SELECT id, first_name, last_name FROM tbl_users WHERE id IN ({placeholders}) ORDER BY first_name",
                                        recruiter_ids
                                    )
                                    recruiter_info = cur.fetchall()
                                    demand['assigned_recruiter_names'] = [f"{row[1]} {row[2]}" for row in recruiter_info]
                                else:
                                    demand['assigned_recruiter_names'] = []
                            else:
                                demand['assigned_recruiter_names'] = []
                        except Exception as e:
                            print(f"Error parsing assigned_to for demand {demand.get('id')}: {e}")
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
    """Get CVs waiting for approval (status = 0) from tbl_recruiter_activity with aggregated CV counts"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Query to get CVs with status = 0 (waiting for approval) with aggregated CV counts
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


@router.get("/cv-submitted")
async def get_cv_submitted():
    """Get approved CVs (status = 1) for the Submitted tab with aggregated CV counts"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Query to get approved CVs (status = 1) with aggregated CV counts
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

