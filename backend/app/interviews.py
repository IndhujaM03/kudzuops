import os
import json
from typing import Any, Dict, List, Optional
from datetime import datetime

import psycopg
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

# Database connection
DATABASE_DSN = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/kudzu_operations")

router = APIRouter(prefix="/api", tags=["Interviews"])

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
def get_recruiter_interviews(recruiter_id: int, page: int = 1, size: int = 10) -> Dict[str, Any]:
    """Get all interviews for a specific recruiter"""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Count total
                cur.execute(
                    "SELECT COUNT(*) FROM tbl_interviews WHERE recruiter_id = %s",
                    (recruiter_id,)
                )
                total = int(cur.fetchone()[0])
                
                # Get interviews with submission and demand info
                cur.execute("""
                    SELECT 
                        i.id, i.submission_id, i.recruiter_id, i.interview_date, 
                        i.mode, i.status, i.notes, i.created_at, i.updated_at,
                        rs.candidate_name, rs.candidate_email, rs.demand_id,
                        ds.skill as job_title, c.client_name
                    FROM tbl_interviews i
                    LEFT JOIN tbl_recruiter_submissions rs ON i.submission_id = rs.id
                    LEFT JOIN tbl_demand_sheet ds ON rs.demand_id = ds.id
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    WHERE i.recruiter_id = %s
                    ORDER BY i.interview_date DESC
                    LIMIT %s OFFSET %s
                """, (recruiter_id, size, (page - 1) * size))
                
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
                        u.display_name as recruiter_name
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





