import psycopg
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel, Field, ConfigDict

from .login import get_current_user  # reuse auth dependency
try:
    from .config import settings
    DATABASE_DSN = settings.database_url
except Exception:
    # Fallback DSN if config import fails
    DATABASE_DSN = "postgresql://kudzuops:kudzu%40%402025@127.0.0.1:5432/kudzuops"


router = APIRouter(prefix="/api/clientsettings", tags=["clientsettings"]) 


# -----------------------------
# Models
# -----------------------------
class ClientCreateRequest(BaseModel):
    clientname: str = Field(..., alias="clientname")
    location: Optional[str] = None
    industry: Optional[str] = None
    status: Optional[str] = Field("inactive", pattern="^(active|inactive)$")

    model_config = ConfigDict(populate_by_name=True)


class ClientResponse(BaseModel):
    id: int
    client_name: str
    industry: Optional[str]
    location: Optional[str]
    email: Optional[str] = None
    contact_person: Optional[str] = None
    status: Optional[str] = None


class SpocCreateRequest(BaseModel):
    name: str
    client_id: int
    email_id: Optional[str] = None
    designation: Optional[str] = None
    phone_number: Optional[str] = None
    spoc_reporting_manager: Optional[str] = None


class SpocResponse(BaseModel):
    id: int
    client_id: int
    spoc_name: str
    designation: Optional[str]
    email: Optional[str]
    phone_number: Optional[str]
    spoc_reporting_manager: Optional[str] = None


# -----------------------------
# Helpers
# -----------------------------
def _row_to_client(row: tuple) -> ClientResponse:
    # tbl_clients: id, client_name, industry, location, email, contact_person, status, created_at, updated_at
    return ClientResponse(
        id=row[0], 
        client_name=row[1], 
        industry=row[2], 
        location=row[3],
        email=row[4] if len(row) > 4 else None,
        contact_person=row[5] if len(row) > 5 else None,
        status=row[6] if len(row) > 6 else None
    )


def _row_to_spoc(row: tuple) -> SpocResponse:
    # tbl_client_spocs: id, client_id, spoc_name, designation, email, phone_number, spoc_reporting_manager, is_primary, created_at, updated_at
    return SpocResponse(
        id=row[0], 
        client_id=row[1], 
        spoc_name=row[2], 
        designation=row[3], 
        email=row[4], 
        phone_number=row[5],
        spoc_reporting_manager=row[6] if len(row) > 6 else None
    )


# -----------------------------
# Endpoints
# -----------------------------
@router.get("/clients", response_model=List[ClientResponse])
def list_clients(_: Dict[str, Any] = Depends(get_current_user)) -> List[ClientResponse]:
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Check which columns exist in the table
                cur.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'tbl_clients'
                    AND table_schema = 'public'
                """)
                available_columns = {row[0] for row in cur.fetchall()}
                
                # Build the query dynamically based on available columns
                base_cols = ['id', 'client_name', 'industry', 'location']
                
                # Handle email column
                if 'email' in available_columns:
                    email_expr = 'email'
                else:
                    email_expr = 'NULL::VARCHAR as email'
                
                # Handle contact_person column
                if 'contact_person' in available_columns:
                    contact_expr = 'contact_person'
                else:
                    contact_expr = 'NULL::VARCHAR as contact_person'
                
                # Handle status column (prefer status, fallback to is_active)
                if 'status' in available_columns:
                    status_expr = 'status'
                elif 'is_active' in available_columns:
                    status_expr = "CASE WHEN is_active THEN 'active' ELSE 'inactive' END as status"
                else:
                    status_expr = "'inactive'::VARCHAR as status"
                
                query = f"""
                    SELECT 
                        {', '.join(base_cols)},
                        {email_expr},
                        {contact_expr},
                        {status_expr}
                    FROM tbl_clients 
                    ORDER BY id ASC
                """
                
                cur.execute(query)
                rows = cur.fetchall() or []
                return [_row_to_client(r) for r in rows]
    except Exception as e:
        import traceback
        error_detail = f"Failed to list clients: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR in list_clients: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Failed to list clients: {str(e)}")


@router.post("/clients", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(payload: ClientCreateRequest, _: Dict[str, Any] = Depends(get_current_user)) -> ClientResponse:
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO tbl_clients (client_name, industry, location, status)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id, client_name, industry, location, email, contact_person, status
                    """,
                    (payload.clientname.strip(), payload.industry, payload.location, payload.status or 'inactive'),
                )
                row = cur.fetchone()
                conn.commit()
                return _row_to_client(row)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create client: {e}")


@router.put("/clients/{client_id}", response_model=ClientResponse)
def update_client(client_id: int, payload: ClientCreateRequest, _: Dict[str, Any] = Depends(get_current_user)) -> ClientResponse:
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Check if client exists
                cur.execute("SELECT 1 FROM tbl_clients WHERE id=%s", (client_id,))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Client not found")
                
                cur.execute(
                    """
                    UPDATE tbl_clients 
                    SET client_name=%s, industry=%s, location=%s, status=%s, updated_at=NOW()
                    WHERE id=%s
                    RETURNING id, client_name, industry, location, email, contact_person, status
                    """,
                    (payload.clientname.strip(), payload.industry, payload.location, payload.status or 'inactive', client_id),
                )
                row = cur.fetchone()
                conn.commit()
                return _row_to_client(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update client: {e}")


@router.delete("/clients/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(client_id: int, _: Dict[str, Any] = Depends(get_current_user)) -> None:
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Check if client exists
                cur.execute("SELECT 1 FROM tbl_clients WHERE id=%s", (client_id,))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Client not found")
                
                # Delete associated SPOCs first
                cur.execute("DELETE FROM tbl_client_spocs WHERE client_id=%s", (client_id,))
                
                # Delete the client
                cur.execute("DELETE FROM tbl_clients WHERE id=%s", (client_id,))
                conn.commit()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete client: {e}")


@router.get("/spocs", response_model=List[SpocResponse])
def list_spocs(client_id: Optional[int] = Query(default=None), _: Dict[str, Any] = Depends(get_current_user)) -> List[SpocResponse]:
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                if client_id:
                    cur.execute(
                        "SELECT id, client_id, spoc_name, designation, email, phone_number, spoc_reporting_manager FROM tbl_client_spocs WHERE client_id=%s ORDER BY id ASC",
                        (client_id,),
                    )
                else:
                    cur.execute(
                        "SELECT id, client_id, spoc_name, designation, email, phone_number, spoc_reporting_manager FROM tbl_client_spocs ORDER BY id ASC"
                    )
                rows = cur.fetchall() or []
                return [_row_to_spoc(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list SPOCs: {e}")


@router.post("/spocs", response_model=SpocResponse, status_code=status.HTTP_201_CREATED)
def create_spoc(payload: SpocCreateRequest, _: Dict[str, Any] = Depends(get_current_user)) -> SpocResponse:
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Ensure client exists
                cur.execute("SELECT 1 FROM tbl_clients WHERE id=%s", (payload.client_id,))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Client not found")

                cur.execute(
                    """
                    INSERT INTO tbl_client_spocs (client_id, spoc_name, designation, email, phone_number, spoc_reporting_manager)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id, client_id, spoc_name, designation, email, phone_number, spoc_reporting_manager
                    """,
                    (
                        payload.client_id,
                        payload.name.strip(),
                        payload.designation,
                        (payload.email_id or None),
                        payload.phone_number,
                        payload.spoc_reporting_manager,
                    ),
                )
                row = cur.fetchone()
                conn.commit()
                return _row_to_spoc(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create SPOC: {e}")


@router.put("/spocs/{spoc_id}", response_model=SpocResponse)
def update_spoc(spoc_id: int, payload: SpocCreateRequest, _: Dict[str, Any] = Depends(get_current_user)) -> SpocResponse:
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Check if SPOC exists
                cur.execute("SELECT 1 FROM tbl_client_spocs WHERE id=%s", (spoc_id,))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="SPOC not found")
                
                # Ensure client exists
                cur.execute("SELECT 1 FROM tbl_clients WHERE id=%s", (payload.client_id,))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Client not found")
                
                cur.execute(
                    """
                    UPDATE tbl_client_spocs 
                    SET client_id=%s, spoc_name=%s, designation=%s, email=%s, phone_number=%s, spoc_reporting_manager=%s, updated_at=NOW()
                    WHERE id=%s
                    RETURNING id, client_id, spoc_name, designation, email, phone_number, spoc_reporting_manager
                    """,
                    (
                        payload.client_id,
                        payload.name.strip(),
                        payload.designation,
                        (payload.email_id or None),
                        payload.phone_number,
                        payload.spoc_reporting_manager,
                        spoc_id,
                    ),
                )
                row = cur.fetchone()
                conn.commit()
                return _row_to_spoc(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update SPOC: {e}")


@router.delete("/spocs/{spoc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_spoc(spoc_id: int, _: Dict[str, Any] = Depends(get_current_user)) -> None:
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Check if SPOC exists
                cur.execute("SELECT 1 FROM tbl_client_spocs WHERE id=%s", (spoc_id,))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="SPOC not found")
                
                # Delete the SPOC
                cur.execute("DELETE FROM tbl_client_spocs WHERE id=%s", (spoc_id,))
                conn.commit()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete SPOC: {e}")


