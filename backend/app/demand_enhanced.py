"""
Enhanced Demand Sheet Routes for Kudzu Operations
==============================================

This module provides comprehensive demand management functionality including:
- Demand CRUD operations
- Recruiter assignment with modal support
- Status management
- Filtering and search
- Multi-assignment support
"""

import os
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from pydantic import BaseModel, validator

import psycopg
from psycopg.types.json import Json

try:
    from ..models.config import settings  # fixed import path
    DATABASE_DSN = settings.database_url
except Exception:
    DATABASE_DSN = os.getenv(
        "DATABASE_URL",
        "postgresql://kudzuops:kudzu%40%402025@127.0.0.1:5432/kudzuops"
    )

# Import auth dependencies
try:
    from .auth_enhanced import get_current_user, require_admin_or_manager
except ImportError:
    # Fallback if auth_enhanced not available
    def get_current_user():
        return {"id": 1, "role": "super_admin", "email": "admin@example.com"}
    
    def require_admin_or_manager(current_user: Dict[str, Any] = Depends(get_current_user)):
        return current_user

router = APIRouter(prefix="/api/demand", tags=["demand"])

# Pydantic Models
class DemandCreateRequest(BaseModel):
    client_id: int
    spoc_id: int
    job_title: str
    skill: Optional[str] = None
    job_description: Optional[str] = None
    job_description_url: Optional[str] = None
    no_of_positions: int = 1
    priority: str = "medium"
    experience_level: Optional[str] = None
    location: Optional[str] = None
    salary_range: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    requirements: Optional[str] = None
    remarks: Optional[str] = None
    
    @validator('priority')
    def validate_priority(cls, v):
        valid_priorities = ['low', 'medium', 'high', 'urgent']
        if v not in valid_priorities:
            raise ValueError('Invalid priority')
        return v

class DemandUpdateRequest(BaseModel):
    job_title: Optional[str] = None
    skill: Optional[str] = None
    job_description: Optional[str] = None
    job_description_url: Optional[str] = None
    no_of_positions: Optional[int] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    experience_level: Optional[str] = None
    location: Optional[str] = None
    salary_range: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    requirements: Optional[str] = None
    remarks: Optional[str] = None

class DemandAssignmentRequest(BaseModel):
    tl_id: Optional[int] = None
    recruiter_ids: List[int]
    primary_recruiter_id: Optional[int] = None
    notes: Optional[str] = None

class DemandStatusUpdateRequest(BaseModel):
    status: str
    remarks: Optional[str] = None
    spoc_remark: Optional[str] = None
    
    @validator('status')
    def validate_status(cls, v):
        # Normalize status values
        status_map = {
            'hold': 'on_hold',
            'cancel': 'rejected',
            'close': 'closed'
        }
        normalized_status = status_map.get(v.lower(), v.lower())
        if normalized_status not in ['open', 'in_progress', 'closed', 'on_hold', 'rejected']:
            raise ValueError('Invalid status')
        return normalized_status

# Utility Functions
def get_demand_with_details(demand_id: int) -> Optional[Dict[str, Any]]:
    """Get demand with client and SPOC details"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 
                        ds.id, ds.demand_date, ds.client_id, ds.spoc_id,
                        ds.job_title, ds.skill, ds.job_description, ds.job_description_url,
                        ds.no_of_positions, ds.priority, ds.status, ds.experience_level,
                        ds.location, ds.salary_range, ds.start_date, ds.end_date,
                        ds.requirements, ds.remarks, ds.created_at, ds.updated_at,
                        c.client_name, c.industry,
                        spoc.spoc_name, spoc.email as spoc_email, spoc.phone as spoc_phone,
                        ds.assigned_to
                    FROM tbl_demand_sheet ds
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    LEFT JOIN tbl_client_spocs spoc ON ds.spoc_id = spoc.id
                    WHERE ds.id = %s
                """, (demand_id,))
                
                row = cur.fetchone()
                if not row:
                    return None
                
                return {
                    "id": row[0],
                    "demand_date": row[1].isoformat() if row[1] else None,
                    "client_id": row[2],
                    "spoc_id": row[3],
                    "job_title": row[4],
                    "skill": row[5],
                    "job_description": row[6],
                    "job_description_url": row[7],
                    "no_of_positions": row[8],
                    "priority": row[9],
                    "status": row[10],
                    "experience_level": row[11],
                    "location": row[12],
                    "salary_range": row[13],
                    "start_date": row[14].isoformat() if row[14] else None,
                    "end_date": row[15].isoformat() if row[15] else None,
                    "requirements": row[16],
                    "remarks": row[17],
                    "created_at": row[18].isoformat() if row[18] else None,
                    "updated_at": row[19].isoformat() if row[19] else None,
                    "client_name": row[20],
                    "industry": row[21],
                    "spoc_name": row[22],
                    "spoc_email": row[23],
                    "spoc_phone": row[24],
                    "assigned_to": row[25] if row[25] else []
                }
    except Exception as e:
        print(f"Error getting demand details: {e}")
        return None

def get_assigned_recruiters(demand_id: int) -> List[Dict[str, Any]]:
    """Get assigned recruiters for a demand"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT assigned_to FROM tbl_demand_sheet WHERE id = %s
                """, (demand_id,))
                
                row = cur.fetchone()
                if not row or not row[0]:
                    return []
                
                assigned_data = row[0]
                if not isinstance(assigned_data, list):
                    return []
                
                # Get recruiter details for each assigned recruiter
                recruiter_ids = [item.get('recruiter_id') for item in assigned_data if item.get('recruiter_id')]
                if not recruiter_ids:
                    return []
                
                cur.execute("""
                    SELECT id, first_name, last_name, email, role
                    FROM tbl_users 
                    WHERE id = ANY(%s)
                """, (recruiter_ids,))
                
                recruiter_details = {row[0]: row for row in cur.fetchall()}
                
                recruiters = []
                for item in assigned_data:
                    recruiter_id = item.get('recruiter_id')
                    if recruiter_id and recruiter_id in recruiter_details:
                        details = recruiter_details[recruiter_id]
                        recruiters.append({
                            "recruiter_id": recruiter_id,
                            "primary_recruiter": item.get('primary_recruiter', False),
                            "assigned_at": item.get('assigned_date'),
                            "tl_id": item.get('tl_id'),
                            "assigned_by": item.get('assigned_by'),
                            "notes": item.get('notes'),
                            "first_name": details[1],
                            "last_name": details[2],
                            "email": details[3],
                            "role": details[4]
                        })
                
                return recruiters
    except Exception as e:
        print(f"Error getting assigned recruiters: {e}")
        return []

# Demand CRUD Routes
@router.get("/")
async def get_demands(
    tab: str = Query("all", description="Filter by tab: unassigned, assigned, submitted, all"),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    client_id: Optional[int] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = Query("created_at", description="Sort by field"),
    sort_dir: str = Query("desc", description="Sort direction: asc, desc"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get demands with filtering, pagination, and role-based access"""
    try:
        print(f"Demand List Debug - tab={tab}, page={page}, size={size}, current_user={current_user}")
        offset = (page - 1) * size
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Build query conditions
                where_conditions = []
                params = []
                
                # Role-based filtering
                user_role = current_user.get("role", "recruiter")
                user_id = current_user.get("id")
                
                if user_role == "recruiter":
                    # Recruiters see only their assigned demands
                    where_conditions.append("COALESCE(ds.assigned_to,'[]'::jsonb) @> %s::jsonb")
                    params.append(Json([{"recruiter_id": user_id}]))
                elif user_role in ["team_lead", "tl"]:
                    # Team leads see demands assigned to their recruiters
                    cur.execute("""
                        SELECT id FROM users WHERE reporting_to = %s AND role = 'recruiter'
                    """, (user_id,))
                    recruiter_ids = [row[0] for row in cur.fetchall()]
                    if recruiter_ids:
                        where_conditions.append("(" + " OR ".join([
                            "COALESCE(ds.assigned_to,'[]'::jsonb) @> %s::jsonb" 
                            for _ in recruiter_ids
                        ]) + ")")
                        params.extend([Json([{"recruiter_id": rid}]) for rid in recruiter_ids])
                    else:
                        where_conditions.append("1=0")  # No recruiters under this TL
                
                # Tab-based filtering
                if tab == "unassigned":
                    where_conditions.append("jsonb_array_length(COALESCE(ds.assigned_to,'[]'::jsonb)) = 0")
                elif tab == "assigned":
                    where_conditions.append("jsonb_array_length(COALESCE(ds.assigned_to,'[]'::jsonb)) > 0")
                elif tab == "submitted":
                    # Since 'submitted' is not in the enum, we'll look for demands with submissions
                    where_conditions.append("ds.status = 'in_progress' AND EXISTS (SELECT 1 FROM tbl_recruiter_submissions WHERE demand_id = ds.id)")
                
                # Additional filters
                if client_id:
                    where_conditions.append("ds.client_id = %s")
                    params.append(client_id)
                
                if status:
                    where_conditions.append("ds.status = %s")
                    params.append(status)
                
                if priority:
                    where_conditions.append("ds.priority = %s")
                    params.append(priority)
                
                if search:
                    where_conditions.append("""
                        (LOWER(ds.skill) LIKE LOWER(%s) OR 
                         LOWER(c.client_name) LIKE LOWER(%s))
                    """)
                    search_term = f"%{search}%"
                    params.extend([search_term, search_term])
                
                where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
                
                # Validate sort parameters
                valid_sort_fields = ["id", "created_at", "updated_at", "skill", "priority", "status", "client_name"]
                if sort_by not in valid_sort_fields:
                    sort_by = "created_at"
                
                if sort_dir not in ["asc", "desc"]:
                    sort_dir = "desc"
                
                # Count total
                print(f"Demand List Debug - Executing count query with where_clause: {where_clause}, params: {params}")
                cur.execute(f"""
                    SELECT COUNT(*) FROM tbl_demand_sheet ds
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    WHERE {where_clause}
                """, params)
                total = cur.fetchone()[0]
                print(f"Demand List Debug - Total count: {total}")
                
                # Get demands
                sort_sql = {
                    "id": "ds.id",
                    "created_at": "ds.created_at",
                    "updated_at": "ds.updated_at",
                    "skill": "ds.skill",
                    "priority": "ds.priority",
                    "status": "ds.status",
                    "client_name": "c.client_name"
                }[sort_by] + f" {sort_dir.upper()}"
                
                print(f"Demand List Debug - Executing main query with sort_sql: {sort_sql}")
                cur.execute(f"""
                    SELECT 
                        ds.id, ds.demand_date, ds.client_id, ds.spoc_id,
                        ds.skill, ds.no_of_positions, ds.priority, ds.status,
                        ds.created_at, ds.updated_at,
                        c.client_name,
                        spoc.spoc_name, spoc.email as spoc_email,
                        COALESCE(ds.assigned_to, '[]'::jsonb) as assigned_to
                    FROM tbl_demand_sheet ds
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    LEFT JOIN tbl_client_spocs spoc ON ds.spoc_id = spoc.id
                    WHERE {where_clause}
                    ORDER BY {sort_sql}
                    LIMIT %s OFFSET %s
                """, params + [size, offset])
                print(f"Demand List Debug - Query executed successfully")
                
                demands = []
                for row in cur.fetchall():
                    demand_data = {
                        "id": row[0],
                        "demand_date": row[1].isoformat() if row[1] else None,
                        "client_id": row[2],
                        "spoc_id": row[3],
                        "job_title": row[4],  # Using skill as job_title for now
                        "skill": row[4],
                        "no_of_positions": row[5],
                        "priority": row[6],
                        "status": row[7],
                        "created_at": row[8].isoformat() if row[8] else None,
                        "updated_at": row[9].isoformat() if row[9] else None,
                        "client_name": row[10],
                        "spoc_name": row[11],
                        "spoc_email": row[12],
                        "assigned_to": row[13] if row[13] else [],
                        "assigned_count": len(row[13]) if row[13] else 0
                    }
                    demands.append(demand_data)
                
                return {
                    "demands": demands,
                    "total": total,
                    "page": page,
                    "size": size,
                    "tab": tab
                }
                
    except Exception as e:
        print(f"Demand List Debug - Error occurred: {e}")
        print(f"Demand List Debug - Error type: {type(e)}")
        import traceback
        print(f"Demand List Debug - Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to get demands: {str(e)}")

@router.get("/users/team-leads")
async def get_team_leads(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get all team leads for assignment purposes"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, email, first_name, last_name, role 
                    FROM tbl_users 
                    WHERE role IN ('team_lead', 'tl') AND approval_status = TRUE 
                    ORDER BY first_name, last_name
                """)
                rows = cur.fetchall()
                return [
                    {
                        "id": r[0],
                        "email": r[1],
                        "first_name": r[2],
                        "last_name": r[3],
                        "role": r[4],
                        "name": f"{r[2] or ''} {r[3] or ''}".strip() or r[1]
                    }
                    for r in rows
                ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get team leads: {str(e)}")

@router.get("/filters/options")
async def get_filter_options(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get filter options for demands (clients, statuses, priorities)"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get clients
                cur.execute("SELECT id, client_name FROM tbl_clients ORDER BY client_name")
                clients = [{"id": r[0], "name": r[1]} for r in cur.fetchall()]
                
                # Get unique statuses from demands
                cur.execute("SELECT DISTINCT status FROM tbl_demand_sheet WHERE status IS NOT NULL ORDER BY status")
                statuses = [r[0] for r in cur.fetchall()]
                
                # Get unique priorities from demands
                cur.execute("SELECT DISTINCT priority FROM tbl_demand_sheet WHERE priority IS NOT NULL ORDER BY priority")
                priorities = [r[0] for r in cur.fetchall()]
                
                return {
                    "clients": clients,
                    "statuses": statuses,
                    "priorities": priorities
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get filter options: {str(e)}")

@router.get("/{demand_id}")
async def get_demand(demand_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get single demand with full details"""
    try:
        demand = get_demand_with_details(demand_id)
        if not demand:
            raise HTTPException(status_code=404, detail="Demand not found")
        
        # Get assigned recruiters
        assigned_recruiters = get_assigned_recruiters(demand_id)
        demand["assigned_recruiters"] = assigned_recruiters
        
        return demand
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get demand: {str(e)}")

@router.post("/")
async def create_demand(request: DemandCreateRequest, current_user: Dict[str, Any] = Depends(require_admin_or_manager)):
    """Create new demand"""
    try:
        print(f"Creating demand with data: {request.dict()}")
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Verify client and SPOC exist
                cur.execute("SELECT id FROM tbl_clients WHERE id = %s", (request.client_id,))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Client not found")
                
                cur.execute("SELECT id FROM tbl_client_spocs WHERE id = %s AND client_id = %s", 
                           (request.spoc_id, request.client_id))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="SPOC not found or doesn't belong to client")
                
                # Create demand (without created_by for now due to FK constraint issues)
                cur.execute("""
                    INSERT INTO tbl_demand_sheet (
                        client_id, spoc_id, job_title, skill, job_description, job_description_url,
                        no_of_positions, priority, experience_level, location, salary_range,
                        start_date, end_date, requirements, remarks
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    request.client_id, request.spoc_id, request.job_title, request.skill,
                    request.job_description, request.job_description_url, request.no_of_positions,
                    request.priority, request.experience_level, request.location, request.salary_range,
                    request.start_date, request.end_date, request.requirements, request.remarks
                ))
                
                demand_id = cur.fetchone()[0]
                conn.commit()
                
                return {
                    "message": "Demand created successfully",
                    "demand_id": demand_id
                }
                
    except HTTPException:
        raise
    except Exception as e:
        print(f"Create demand error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create demand: {str(e)}")

@router.put("/{demand_id}")
async def update_demand(
    demand_id: int, 
    request: DemandUpdateRequest, 
    current_user: Dict[str, Any] = Depends(require_admin_or_manager)
):
    """Update demand"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Check if demand exists
                cur.execute("SELECT id FROM tbl_demand_sheet WHERE id = %s", (demand_id,))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Demand not found")
                
                # Build update query
                update_fields = []
                params = []
                
                for field, value in request.dict(exclude_unset=True).items():
                    if value is not None:
                        update_fields.append(f"{field} = %s")
                        params.append(value)
                
                if not update_fields:
                    raise HTTPException(status_code=400, detail="No fields to update")
                
                update_fields.append("updated_at = NOW()")
                params.append(demand_id)
                
                cur.execute(f"""
                    UPDATE tbl_demand_sheet SET {', '.join(update_fields)}
                    WHERE id = %s
                """, params)
                
                conn.commit()
                
                return {"message": "Demand updated successfully"}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update demand: {str(e)}")

@router.delete("/{demand_id}")
async def delete_demand(demand_id: int, current_user: Dict[str, Any] = Depends(require_admin_or_manager)):
    """Delete demand"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Check if demand exists
                cur.execute("SELECT id FROM tbl_demand_sheet WHERE id = %s", (demand_id,))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Demand not found")
                
                # Delete demand (cascade will handle related records)
                cur.execute("DELETE FROM tbl_demand_sheet WHERE id = %s", (demand_id,))
                conn.commit()
                
                return {"message": "Demand deleted successfully"}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete demand: {str(e)}")

# Assignment Routes
@router.post("/{demand_id}/assign")
async def assign_recruiters(
    demand_id: int, 
    request: DemandAssignmentRequest, 
    current_user: Dict[str, Any] = Depends(require_admin_or_manager)
):
    """Assign recruiters to demand with multi-assignment support"""
    try:
        if not request.recruiter_ids:
            raise HTTPException(status_code=400, detail="At least one recruiter must be selected")
        
        if not request.tl_id:
            raise HTTPException(status_code=400, detail="Team Lead must be selected")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Verify demand exists
                cur.execute("SELECT id, status FROM tbl_demand_sheet WHERE id = %s", (demand_id,))
                demand_row = cur.fetchone()
                if not demand_row:
                    raise HTTPException(status_code=404, detail="Demand not found")
                
                # Create assignment data
                assigned_data = []
                for i, recruiter_id in enumerate(request.recruiter_ids):
                    is_primary = (recruiter_id == request.primary_recruiter_id) or (i == 0 and not request.primary_recruiter_id)
                    assignment_item = {
                        "recruiter_id": recruiter_id,
                        "tl_id": request.tl_id,
                        "primary_recruiter": is_primary,
                        "assigned_date": datetime.now().isoformat(),
                        "assigned_by": current_user.get("id", 1),
                        "notes": request.notes or ""
                    }
                    assigned_data.append(assignment_item)
                    print(f"Assignment Debug - Created assignment for recruiter {recruiter_id}: {assignment_item}")
                
                print(f"Assignment Debug - Full assignment data: {assigned_data}")
                
                # Update demand with assignment
                print(f"Assignment Debug - Updating demand {demand_id} with assignment data")
                cur.execute("""
                    UPDATE tbl_demand_sheet SET 
                        assigned_to = %s,
                        status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
                        updated_at = NOW()
                    WHERE id = %s
                """, (Json(assigned_data), demand_id))
                
                conn.commit()
                print(f"Assignment Debug - Successfully updated demand {demand_id}")
                
                # Get updated demand data
                cur.execute("""
                    SELECT 
                        ds.id, ds.demand_date, ds.client_id, ds.spoc_id,
                        ds.skill, ds.no_of_positions, ds.priority, ds.status,
                        ds.created_at, ds.updated_at,
                        c.client_name,
                        spoc.spoc_name, spoc.email as spoc_email,
                        COALESCE(ds.assigned_to, '[]'::jsonb) as assigned_to
                    FROM tbl_demand_sheet ds
                    LEFT JOIN tbl_clients c ON ds.client_id = c.id
                    LEFT JOIN tbl_client_spocs spoc ON ds.spoc_id = spoc.id
                    WHERE ds.id = %s
                """, (demand_id,))
                
                demand_row = cur.fetchone()
                if demand_row:
                    updated_demand = {
                        "id": demand_row[0],
                        "demand_date": demand_row[1].isoformat() if demand_row[1] else None,
                        "client_id": demand_row[2],
                        "spoc_id": demand_row[3],
                        "job_title": demand_row[4],
                        "skill": demand_row[4],
                        "no_of_positions": demand_row[5],
                        "priority": demand_row[6],
                        "status": demand_row[7],
                        "created_at": demand_row[8].isoformat() if demand_row[8] else None,
                        "updated_at": demand_row[9].isoformat() if demand_row[9] else None,
                        "client_name": demand_row[10],
                        "spoc_name": demand_row[11],
                        "spoc_email": demand_row[12],
                        "assigned_to": demand_row[13] if demand_row[13] else [],
                        "assigned_count": len(demand_row[13]) if demand_row[13] else 0
                    }
                else:
                    updated_demand = None
                
                return {
                    "message": "Recruiters assigned successfully",
                    "demand": updated_demand,
                    "assigned_recruiters": [
                        {
                            "recruiter_id": rid,
                            "primary_recruiter": rid == request.primary_recruiter_id
                        }
                        for rid in request.recruiter_ids
                    ]
                }
                
    except HTTPException:
        raise
    except Exception as e:
        print(f"Assignment error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to assign recruiters: {str(e)}")

@router.post("/{demand_id}/assign-new")
async def assign_recruiters_new(
    demand_id: int, 
    request: DemandAssignmentRequest, 
    current_user: Dict[str, Any] = Depends(require_admin_or_manager)
):
    """New assignment endpoint for testing"""
    return {
        "message": "New assignment endpoint working",
        "demand_id": demand_id,
        "recruiter_ids": request.recruiter_ids,
        "current_user": current_user
    }

@router.post("/{demand_id}/status")
async def update_demand_status(
    demand_id: int, 
    request: DemandStatusUpdateRequest, 
    current_user: Dict[str, Any] = Depends(require_admin_or_manager)
):
    """Update demand status, spoc_remark, and activity_status"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Check if demand exists
                cur.execute("SELECT id FROM tbl_demand_sheet WHERE id = %s", (demand_id,))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Demand not found")
                
                # Update status and spoc_remark in tbl_demand_sheet
                # Build the update query dynamically to handle None values
                update_fields = ["status = %s", "updated_at = NOW()"]
                params = [request.status]
                
                if request.remarks is not None:
                    update_fields.append("remarks = %s")
                    params.append(request.remarks)
                
                if request.spoc_remark is not None:
                    update_fields.append("spoc_remark = %s")
                    params.append(request.spoc_remark)
                
                params.append(demand_id)
                
                update_query = f"""
                    UPDATE tbl_demand_sheet SET 
                        {', '.join(update_fields)}
                    WHERE id = %s
                """
                
                cur.execute(update_query, params)
                
                # Update activity_status in tbl_recruiter_activity based on status
                # If status is "open", set activity_status = "open"
                # If status is not "open" (hold, close, cancel), set activity_status = "closed"
                if request.status.lower() == 'open':
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
        raise HTTPException(status_code=500, detail=f"Failed to update demand status: {str(e)}")

class ProfileActionRequest(BaseModel):
    recruiter_id: int
    candidate_name: str
    candidate_email: Optional[str] = None
    candidate_phone: Optional[str] = None
    cv_url: Optional[str] = None
    shortlisted: int  # 1 for accept, 0 for reject
    feedback: Optional[str] = None

@router.post("/{demand_id}/profile-action")
async def accept_reject_profile(
    demand_id: int,
    request: ProfileActionRequest,
    current_user: Dict[str, Any] = Depends(require_admin_or_manager)
):
    """Accept or reject a submitted profile - insert into tbl_submissions"""
    try:
        recruiter_id = request.recruiter_id
        candidate_name = request.candidate_name
        candidate_email = request.candidate_email
        candidate_phone = request.candidate_phone
        shortlisted = request.shortlisted  # 1 for accept, 0 for reject
        feedback = request.feedback
        
        if not recruiter_id or not candidate_name:
            raise HTTPException(status_code=400, detail="recruiter_id and candidate_name are required")
        
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
                from datetime import date
                today = date.today()
                submission_week = today.isocalendar()[1]
                
                # Check if record already exists for this candidate
                cur.execute("""
                    SELECT id FROM tbl_submissions 
                    WHERE demand_id = %s 
                    AND recruiter_id = %s 
                    AND candidate_name = %s
                    AND submission_date = %s
                """, (demand_id, recruiter_id, candidate_name, today))
                
                existing = cur.fetchone()
                
                if existing:
                    # Update existing record
                    cur.execute("""
                        UPDATE tbl_submissions 
                        SET shortlisted = %s, 
                            candidate_email = COALESCE(%s, candidate_email),
                            candidate_phone = COALESCE(%s, candidate_phone),
                            feedback = COALESCE(%s, feedback),
                            updated_at = NOW()
                        WHERE id = %s
                    """, (shortlisted, candidate_email, candidate_phone, feedback, existing[0]))
                else:
                    # Insert new record
                    cur.execute("""
                        INSERT INTO tbl_submissions 
                        (demand_id, recruiter_id, spoc_id, skill, candidate_name, 
                         candidate_email, candidate_phone, shortlisted, feedback, submission_date, submission_week, 
                         no_of_submissions, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1, NOW(), NOW())
                    """, (
                        demand_id,
                        recruiter_id,
                        spoc_id,
                        skill,
                        candidate_name,
                        candidate_email or None,
                        candidate_phone or None,
                        shortlisted,
                        feedback or None,
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
                
                action = "accepted" if shortlisted == 1 else "rejected"
                return {"message": f"Profile {action} successfully"}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process profile action: {str(e)}")

class ProfileActionRequest(BaseModel):
    recruiter_id: int
    candidate_name: str
    candidate_email: Optional[str] = None
    candidate_phone: Optional[str] = None
    cv_url: Optional[str] = None
    shortlisted: int  # 1 for accept, 0 for reject
    feedback: Optional[str] = None

@router.post("/{demand_id}/profile-action")
async def accept_reject_profile(
    demand_id: int,
    request: ProfileActionRequest,
    current_user: Dict[str, Any] = Depends(require_admin_or_manager)
):
    """Accept or reject a submitted profile - insert into tbl_submissions"""
    try:
        recruiter_id = request.recruiter_id
        candidate_name = request.candidate_name
        candidate_email = request.candidate_email
        candidate_phone = request.candidate_phone
        shortlisted = request.shortlisted  # 1 for accept, 0 for reject
        feedback = request.feedback
        
        if not recruiter_id or not candidate_name:
            raise HTTPException(status_code=400, detail="recruiter_id and candidate_name are required")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Ensure candidate columns exist in tbl_submissions
                cur.execute("""
                    ALTER TABLE tbl_submissions 
                    ADD COLUMN IF NOT EXISTS candidate_name VARCHAR(255),
                    ADD COLUMN IF NOT EXISTS candidate_email VARCHAR(255),
                    ADD COLUMN IF NOT EXISTS candidate_phone VARCHAR(50)
                """)
                conn.commit()
                
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
                from datetime import date
                today = date.today()
                submission_week = today.isocalendar()[1]
                
                # Check if record already exists for this candidate
                # Use COALESCE to handle NULL candidate_name values
                cur.execute("""
                    SELECT id FROM tbl_submissions 
                    WHERE demand_id = %s 
                    AND recruiter_id = %s 
                    AND COALESCE(candidate_name, '') = %s
                    AND submission_date = %s
                """, (demand_id, recruiter_id, candidate_name or '', today))
                
                existing = cur.fetchone()
                
                if existing:
                    # Update existing record
                    cur.execute("""
                        UPDATE tbl_submissions 
                        SET shortlisted = %s,
                            candidate_name = COALESCE(%s, candidate_name),
                            candidate_email = COALESCE(%s, candidate_email),
                            candidate_phone = COALESCE(%s, candidate_phone),
                            feedback = COALESCE(%s, feedback),
                            updated_at = NOW()
                        WHERE id = %s
                    """, (shortlisted, candidate_name, candidate_email, candidate_phone, feedback, existing[0]))
                else:
                    # Insert new record
                    cur.execute("""
                        INSERT INTO tbl_submissions 
                        (demand_id, recruiter_id, spoc_id, skill, candidate_name, 
                         candidate_email, candidate_phone, shortlisted, feedback, submission_date, submission_week, 
                         no_of_submissions, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1, NOW(), NOW())
                    """, (
                        demand_id,
                        recruiter_id,
                        spoc_id,
                        skill,
                        candidate_name,
                        candidate_email or None,
                        candidate_phone or None,
                        shortlisted,
                        feedback or None,
                        today,
                        submission_week
                    ))
                
                conn.commit()
                
                action = "accepted" if shortlisted == 1 else "rejected"
                return {"message": f"Profile {action} successfully"}
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process profile action: {str(e)}")

# Helper Routes
@router.get("/{demand_id}/recruiters")
async def get_demand_recruiters(demand_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get recruiters assigned to a demand"""
    try:
        assigned_recruiters = get_assigned_recruiters(demand_id)
        return {"recruiters": assigned_recruiters}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get demand recruiters: {str(e)}")


@router.get("/users/recruiters")
async def get_all_recruiters(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get all recruiters (for assignment purposes)"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, email, first_name, last_name, role
                    FROM tbl_users 
                    WHERE role = 'recruiter' AND (approval_status = TRUE OR is_approved = TRUE)
                    ORDER BY first_name, last_name
                """)
                
                recruiters = []
                for row in cur.fetchall():
                    recruiter_data = {
                        "id": row[0],
                        "name": f"{row[2] or ''} {row[3] or ''}".strip() or row[1],
                        "email": row[1],
                        "first_name": row[2],
                        "last_name": row[3],
                        "role": row[4]
                    }
                    recruiters.append(recruiter_data)
                
                return recruiters
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get recruiters: {str(e)}")

@router.get("/users/recruiters/{tl_id}")
async def get_recruiters_for_tl(
    tl_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get recruiters for a specific team lead"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, email, first_name, last_name, role
                    FROM tbl_users 
                    WHERE reporting_to = %s AND role = 'recruiter' AND (approval_status = TRUE OR is_approved = TRUE)
                    ORDER BY first_name, last_name
                """, (tl_id,))
                
                recruiters = []
                for row in cur.fetchall():
                    recruiter_data = {
                        "id": row[0],
                        "name": f"{row[2] or ''} {row[3] or ''}".strip() or row[1],
                        "email": row[1],
                        "first_name": row[2],
                        "last_name": row[3],
                        "role": row[4]
                    }
                    recruiters.append(recruiter_data)
                
                return recruiters
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get recruiters: {str(e)}")

@router.get("/clients/{client_id}/spocs")
async def get_client_spocs(
    client_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get SPOCs for a client (for demand creation/edit forms)"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, spoc_name, email
                    FROM tbl_client_spocs 
                    WHERE client_id = %s
                    ORDER BY spoc_name
                """, (client_id,))
                
                spocs = []
                for row in cur.fetchall():
                    spoc_data = {
                        "id": row[0],
                        "name": row[1],  # Using 'name' for consistency with frontend
                        "spoc_name": row[1],
                        "email": row[2]
                    }
                    spocs.append(spoc_data)
                
                return {"spocs": spocs}
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get SPOCs: {str(e)}")


