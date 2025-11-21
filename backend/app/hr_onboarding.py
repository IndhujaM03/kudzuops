import json
import os
import shutil
import smtplib
import uuid
from datetime import date, datetime
from decimal import Decimal
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import psycopg
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, Depends
from dotenv import load_dotenv

try:
    from .login import get_current_user
except ImportError:
    async def get_current_user():
        return {"uid": 1, "role": "team_leader"}

# Load .env file
backend_env = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(backend_env):
    load_dotenv(backend_env, override=True)

try:
    from .config import settings
    DATABASE_DSN = settings.database_url or ""
except Exception:
    DATABASE_DSN = os.getenv("DATABASE_URL", "")

# Fallback to default if still empty
if not DATABASE_DSN:
    DATABASE_DSN = "postgresql://kudzuops:kudzu%40%402025@127.0.0.1:5432/kudzuops"
FRONTEND_BASE_URL = (
    os.getenv("ONBOARDING_FORM_BASE_URL")
    or os.getenv("FRONTEND_BASE_URL")
    or "http://localhost:4200"
)
ONBOARDING_STATIC_PREFIX = "/onboarding-files"

APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
WORKSPACE_ROOT = BACKEND_DIR.parent
ASSETS_ROOT = WORKSPACE_ROOT / "src" / "assets"
ONBOARDING_ROOT = ASSETS_ROOT / "onboarding"
DOCUMENTS_FOLDER_NAME = "documents"

ONBOARDING_ROOT.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/api/hr", tags=["HR"])
public_router = APIRouter(prefix="/api/onboarding", tags=["Onboarding"])


def _serialize_value(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def _rows_to_dicts(cursor, rows: List[tuple]) -> Dict[str, Any]:
    columns = [
        getattr(col, "name", col[0])  # type: ignore[index]
        for col in cursor.description
    ]
    items = []
    for row in rows:
        record = {}
        for column, raw_value in zip(columns, row):
            record[column] = _serialize_value(raw_value)
        items.append(record)

    return {"columns": columns, "items": items}


def _ensure_candidate_dirs(candidate_id: int) -> Tuple[Path, Path]:
    candidate_dir = ONBOARDING_ROOT / str(candidate_id)
    docs_dir = candidate_dir / DOCUMENTS_FOLDER_NAME
    docs_dir.mkdir(parents=True, exist_ok=True)
    return candidate_dir, docs_dir


def _relative_document_path(candidate_id: int, filename: str) -> str:
    safe_name = filename.lstrip("/\\")
    return f"{ONBOARDING_STATIC_PREFIX}/{candidate_id}/{DOCUMENTS_FOLDER_NAME}/{safe_name}"


def _save_upload(candidate_id: int, upload: UploadFile, prefix: str) -> str:
    if upload is None or upload.filename is None:
        raise HTTPException(status_code=400, detail="Missing file upload.")

    _, docs_dir = _ensure_candidate_dirs(candidate_id)
    ext = Path(upload.filename).suffix or ""
    filename = f"{prefix}_{uuid.uuid4().hex}{ext}"
    destination = docs_dir / filename
    with destination.open("wb") as buffer:
        shutil.copyfileobj(upload.file, buffer)
    upload.file.close()
    return _relative_document_path(candidate_id, filename)


def _parse_json_field(raw_value: Any) -> Any:
    if raw_value is None:
        return None
    if isinstance(raw_value, (dict, list)):
        return raw_value
    if isinstance(raw_value, str):
        try:
            return json.loads(raw_value)
        except json.JSONDecodeError:
            return raw_value
    return raw_value


def _parse_interview_schedules(raw: Any) -> Dict[str, Any]:
    parsed = _parse_json_field(raw)
    return parsed if isinstance(parsed, dict) else {}


def _confirmed_rounds(raw: Any) -> List[Dict[str, Any]]:
    schedules = _parse_interview_schedules(raw)
    confirmed: List[Dict[str, Any]] = []
    for round_key, round_value in schedules.items():
        if int(round_value.get("round_status", 0)) != 2:
            continue
        slots = [
            {
                "date": slot.get("date"),
                "time": slot.get("time"),
                "status": "Confirmed",
            }
            for slot in round_value.get("slots", [])
            if int(slot.get("slot_status", 0)) == 1
        ]
        if not slots:
            continue
        formatted_round = (
            round_key.replace("_", " ").title()
            if isinstance(round_key, str)
            else "Round"
        )
        confirmed.append({"round": formatted_round, "slots": slots})
    return confirmed


def _fetch_onboarding_record(candidate_id: int) -> Dict[str, Any]:
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT 
                        o.*,
                        c.client_name,
                        COALESCE(
                            NULLIF(
                                TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))),
                                ''
                            ),
                            u.email,
                            CAST(u.id AS TEXT)
                        ) AS recruiter_name
                    FROM tbl_candidate_onboarding o
                    LEFT JOIN tbl_clients c ON c.id = o.client_id
                    LEFT JOIN tbl_users u ON u.id = o.recruiter_id
                    WHERE o.id = %s
                    """,
                    (candidate_id,),
                )
                row = cur.fetchone()
                if not row:
                    raise HTTPException(
                        status_code=404, detail="Candidate onboarding record not found."
                    )
                columns = [col.name for col in cur.description]  # type: ignore[attr-defined]
                record = {
                    column: _serialize_value(value)
                    for column, value in zip(columns, row)
                }
                return record
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch onboarding record: {exc}"
        ) from exc


def _extract_token_from_link(link: Optional[str]) -> Optional[str]:
    if not link:
        return None
    cleaned = str(link).rstrip("/")
    if not cleaned:
        return None
    return cleaned.split("/")[-1]


def _validate_token(record: Dict[str, Any], token: str) -> None:
    expected_token = _extract_token_from_link(record.get("generated_link"))
    if not expected_token or expected_token != token:
        raise HTTPException(status_code=404, detail="Invalid or expired onboarding link.")


def _send_candidate_link_email(
    candidate_email: Optional[str], candidate_name: Optional[str], link: str
) -> None:
    if not candidate_email:
        return
    subject = "Kudzu Onboarding Form"
    display_name = candidate_name or "Candidate"
    body = f"""
        <p>Hi {display_name},</p>
        <p>Your onboarding form is ready. Please use the link below to complete it:</p>
        <p><a href="{link}">{link}</a></p>
        <p>Regards,<br/>Kudzu HR Team</p>
    """
    try:
        if os.getenv("EMAIL_ENABLED", "true").lower() not in {"1", "true", "yes"}:
            print(f"📧 EMAIL_DISABLED: {subject} -> {candidate_email}")
            return
        smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER", "")
        smtp_password = os.getenv("SMTP_PASSWORD", "")
        if not smtp_user or not smtp_password:
            print(f"⚠️ SMTP not configured. Email would go to {candidate_email}: {link}")
            return
        msg = MIMEMultipart()
        msg["From"] = smtp_user
        msg["To"] = candidate_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "html"))
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
    except Exception as exc:
        print(f"❌ Email error: {exc}")


def _parse_structured_field(raw: Optional[str]) -> Any:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed
    except json.JSONDecodeError:
        return {"text": raw}


def _coerce_documents(raw: Any) -> Optional[Dict[str, Any]]:
    parsed = _parse_json_field(raw)
    if isinstance(parsed, dict):
        return parsed
    return None


@router.get("/onboarding")
async def get_candidate_onboarding(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None, description="Filter by status (e.g., 'completed')"),
    pending_only: bool = Query(False, description="Filter for pending onboarding (generated_link is empty)"),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        team_leader_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not team_leader_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Build WHERE clause based on filters
                where_conditions = ["d.tl_id = %s"]
                params = [team_leader_id]
                
                if pending_only:
                    where_conditions.append("(o.generated_link IS NULL OR o.generated_link = '')")
                
                if status:
                    where_conditions.append("LOWER(o.status) = LOWER(%s)")
                    params.append(status)
                
                where_clause = "WHERE " + " AND ".join(where_conditions)
                
                # Count query
                count_query = f"SELECT COUNT(*) FROM tbl_candidate_onboarding o LEFT JOIN tbl_demand_sheet d ON o.demand_id = d.id {where_clause}"
                cur.execute(count_query, params)
                total = int(cur.fetchone()[0]) if cur.rowcount != 0 else 0

                # Data query
                data_query = f"""
                    SELECT 
                        o.*,
                        c.client_name,
                        COALESCE(
                            NULLIF(
                                TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))),
                                ''
                            ),
                            u.email,
                            CAST(u.id AS TEXT)
                        ) AS recruiter_name
                    FROM tbl_candidate_onboarding o
                    LEFT JOIN tbl_demand_sheet d ON o.demand_id = d.id
                    LEFT JOIN tbl_clients c ON c.id = o.client_id
                    LEFT JOIN tbl_users u ON u.id = o.recruiter_id
                    {where_clause}
                    ORDER BY o.id DESC
                    LIMIT %s OFFSET %s
                """
                cur.execute(data_query, params + [limit, offset])
                rows = cur.fetchall()

                data = _rows_to_dicts(cur, rows)

                return {
                    "items": data["items"],
                    "columns": data["columns"],
                    "total": total,
                    "limit": limit,
                    "offset": offset,
                }
    except psycopg.errors.UndefinedTable:
        raise HTTPException(
            status_code=404,
            detail="tbl_candidate_onboarding table was not found in the database.",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch onboarding data: {exc}"
        ) from exc


@router.post("/onboarding/{candidate_id}/generate-link")
def generate_onboarding_link(candidate_id: int) -> Dict[str, Any]:
    token = uuid.uuid4().hex
    base_url = FRONTEND_BASE_URL.rstrip("/")
    generated_link = f"{base_url}/onboarding-form/{candidate_id}/{token}"

    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE tbl_candidate_onboarding
                    SET generated_link = %s,
                        status = %s,
                        documents = NULL
                    WHERE id = %s
                    RETURNING candidate_name, candidate_email
                    """,
                    (generated_link, "pending", candidate_id),
                )
                result = cur.fetchone()
                if not result:
                    raise HTTPException(
                        status_code=404,
                        detail="Candidate onboarding record not found.",
                    )
                conn.commit()
                _ensure_candidate_dirs(candidate_id)
                _send_candidate_link_email(result[1], result[0], generated_link)
                return {"generated_link": generated_link, "status": "pending"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Unable to generate onboarding link: {exc}"
        ) from exc


@router.get("/onboarding/{candidate_id}")
def get_onboarding_detail(candidate_id: int) -> Dict[str, Any]:
    record = _fetch_onboarding_record(candidate_id)
    record["documents"] = _coerce_documents(record.get("documents"))
    record["confirmed_rounds"] = _confirmed_rounds(record.get("interview_schedules"))
    return record


@public_router.get("/form/{candidate_id}/{token}")
def get_onboarding_form(candidate_id: int, token: str) -> Dict[str, Any]:
    record = _fetch_onboarding_record(candidate_id)
    _validate_token(record, token)
    documents = _coerce_documents(record.get("documents"))
    status = (record.get("status") or "").lower()
    return {
        "candidate_id": candidate_id,
        "candidate_name": record.get("candidate_name"),
        "candidate_email": record.get("candidate_email"),
        "candidate_phone": record.get("candidate_phone"),
        "status": status,
        "generated_link": record.get("generated_link"),
        "documents": documents,
        "confirmed_rounds": _confirmed_rounds(record.get("interview_schedules")),
        "read_only": status == "completed",
    }


@public_router.post("/form/{candidate_id}/{token}")
async def submit_onboarding_form(
    candidate_id: int,
    token: str,
    passport_photo: UploadFile = File(...),
    updated_resume: UploadFile = File(...),
    education_details: str = Form(...),
    employee_details: str = Form(...),
    additional_document_names: List[str] = Form([]),
    additional_files: List[UploadFile] = File([]),
) -> Dict[str, Any]:
    record = _fetch_onboarding_record(candidate_id)
    _validate_token(record, token)
    status = (record.get("status") or "").lower()
    if status == "completed":
        raise HTTPException(status_code=400, detail="Onboarding form already submitted.")

    passport_url = _save_upload(candidate_id, passport_photo, "passport")
    resume_url = _save_upload(candidate_id, updated_resume, "resume")

    additional_docs_dict: Dict[str, str] = {}
    additional_docs_list: List[Dict[str, Any]] = []
    for idx, upload in enumerate(additional_files or []):
        if upload is None:
            continue
        doc_name = (
            additional_document_names[idx]
            if idx < len(additional_document_names)
            else upload.filename or f"Document {idx + 1}"
        )
        if not doc_name or not doc_name.strip():
            doc_name = upload.filename or f"Document {idx + 1}"
        doc_name = doc_name.strip()
        doc_url = _save_upload(candidate_id, upload, f"additional_{idx + 1}")
        additional_docs_dict[doc_name] = doc_url
        additional_docs_list.append({"doc_name": doc_name, "url": doc_url})

    documents_payload = {
        "passport_photo": passport_url,
        "updated_resume": resume_url,
        "education_details": _parse_structured_field(education_details),
        "employee_details": _parse_structured_field(employee_details),
        "additional_documents": additional_docs_dict,
        "additional_documents_list": additional_docs_list,
    }

    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE tbl_candidate_onboarding
                    SET documents = %s,
                        status = %s
                    WHERE id = %s
                    """,
                    (json.dumps(documents_payload), "completed", candidate_id),
                )
                conn.commit()
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to save onboarding form: {exc}"
        ) from exc

    return {
        "status": "completed",
        "message": "Your onboarding form is submitted successfully.",
        "documents": documents_payload,
    }
