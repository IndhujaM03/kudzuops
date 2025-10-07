import os
from typing import Any, Dict, List, Optional

import psycopg
from fastapi import APIRouter, HTTPException

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
    required_fields = ["client_id", "spoc_id"]
    for field in required_fields:
        if payload.get(field) in (None, ""):
            raise HTTPException(status_code=400, detail=f"{field} is required")

    client_id: int = int(payload["client_id"])  # type: ignore
    spoc_id: int = int(payload["spoc_id"])  # type: ignore
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
                        "priority, job_description_url, remarks, status, created_at) "
                        "VALUES (CURRENT_DATE, %s, %s, %s, %s, %s, %s, %s, COALESCE(%s::demand_status_enum, 'open'::demand_status_enum), NOW()) RETURNING id"
                    ),
                    (
                        client_id,
                        spoc_id,
                        skills,
                        no_of_positions,
                        (priority or None).lower() if priority else None,
                        job_description_url,
                        remarks,
                        (status or None),
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
    """Demand sheets without any recruiter assigned in tbl_recruiter_activity."""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    (
                        "SELECT d.* FROM tbl_demand_sheet d "
                        "LEFT JOIN tbl_recruiter_activity r ON r.demand_id = d.id "
                        "WHERE r.recruiter_id IS NULL OR r.demand_id IS NULL "
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
    """Demand sheets that are assigned; optional filter by recruiter_id."""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                if recruiter_id:
                    cur.execute(
                        (
                            "SELECT d.*, r.recruiter_id FROM tbl_demand_sheet d "
                            "JOIN tbl_recruiter_activity r ON r.demand_id = d.id "
                            "WHERE r.recruiter_id = %s ORDER BY d.id DESC"
                        ),
                        (recruiter_id,),
                    )
                else:
                    cur.execute(
                        (
                            "SELECT d.*, r.recruiter_id FROM tbl_demand_sheet d "
                            "JOIN tbl_recruiter_activity r ON r.demand_id = d.id "
                            "ORDER BY d.id DESC"
                        )
                    )
                rows = cur.fetchall()
                columns = [desc[0] for desc in cur.description]
                return _rows_to_dicts(columns, rows)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch assigned demands: {e}")


@router.get("/demand/submitted")
def list_submitted() -> List[Dict[str, Any]]:
    """Submitted demand sheets. We treat status 'closed' as submitted in absence of a dedicated status."""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # If enum has 'closed', treat that as submitted; adjust as needed
                cur.execute(
                    (
                        "SELECT * FROM tbl_demand_sheet WHERE status = 'closed' ORDER BY id DESC"
                    )
                )
                rows = cur.fetchall()
                columns = [desc[0] for desc in cur.description]
                return _rows_to_dicts(columns, rows)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch submitted demands: {e}")


@router.post("/demand/assign")
def assign_recruiter(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Assign a recruiter to a demand by upserting into tbl_recruiter_activity."""
    demand_id = payload.get("demand_id")
    recruiter_id = payload.get("recruiter_id")
    if not demand_id or not recruiter_id:
        raise HTTPException(status_code=400, detail="demand_id and recruiter_id are required")

    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Try update first
                cur.execute(
                    "UPDATE tbl_recruiter_activity SET recruiter_id=%s, assigned_at=NOW() WHERE demand_id=%s",
                    (recruiter_id, demand_id),
                )
                if cur.rowcount == 0:
                    # Insert if not exists
                    cur.execute(
                        "INSERT INTO tbl_recruiter_activity (demand_id, recruiter_id, assigned_at) VALUES (%s, %s, NOW())",
                        (demand_id, recruiter_id),
                    )
                conn.commit()
                return {"message": "Recruiter assigned"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to assign recruiter: {e}")

