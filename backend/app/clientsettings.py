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


router = APIRouter(prefix="/clientsettings", tags=["clientsettings"]) 


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
    is_active: bool


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


# -----------------------------
# Helpers
# -----------------------------
def _row_to_client(row: tuple) -> ClientResponse:
    # tbl_clients: id, client_name, industry, location, is_active, created_at, updated_at
    return ClientResponse(
        id=row[0], client_name=row[1], industry=row[2], location=row[3], is_active=row[4]
    )


def _row_to_spoc(row: tuple) -> SpocResponse:
    # tbl_client_spocs: id, client_id, spoc_name, designation, email, phone_number, is_primary, created_at, updated_at
    return SpocResponse(
        id=row[0], client_id=row[1], spoc_name=row[2], designation=row[3], email=row[4], phone_number=row[5]
    )


# -----------------------------
# Endpoints
# -----------------------------
@router.get("/clients", response_model=List[ClientResponse])
def list_clients(_: Dict[str, Any] = Depends(get_current_user)) -> List[ClientResponse]:
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, client_name, industry, location, is_active FROM tbl_clients ORDER BY id ASC")
                rows = cur.fetchall() or []
                return [_row_to_client(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list clients: {e}")


@router.post("/clients", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(payload: ClientCreateRequest, _: Dict[str, Any] = Depends(get_current_user)) -> ClientResponse:
    is_active = True if (payload.status or "inactive") == "active" else False
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO tbl_clients (client_name, industry, location, is_active)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id, client_name, industry, location, is_active
                    """,
                    (payload.clientname.strip(), payload.industry, payload.location, is_active),
                )
                row = cur.fetchone()
                conn.commit()
                return _row_to_client(row)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create client: {e}")


@router.get("/spocs", response_model=List[SpocResponse])
def list_spocs(client_id: Optional[int] = Query(default=None), _: Dict[str, Any] = Depends(get_current_user)) -> List[SpocResponse]:
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                if client_id:
                    cur.execute(
                        "SELECT id, client_id, spoc_name, designation, email, phone_number FROM tbl_client_spocs WHERE client_id=%s ORDER BY id ASC",
                        (client_id,),
                    )
                else:
                    cur.execute(
                        "SELECT id, client_id, spoc_name, designation, email, phone_number FROM tbl_client_spocs ORDER BY id ASC"
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
                    INSERT INTO tbl_client_spocs (client_id, spoc_name, designation, email, phone_number)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id, client_id, spoc_name, designation, email, phone_number
                    """,
                    (
                        payload.client_id,
                        payload.name.strip(),
                        payload.designation,
                        (payload.email_id or None),
                        payload.phone_number,
                    ),
                )
                row = cur.fetchone()
                conn.commit()
                return _row_to_spoc(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create SPOC: {e}")


