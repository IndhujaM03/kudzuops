"""
HR Dashboard API endpoints
Provides analytics and statistics for HR dashboard
"""

import os
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional

import psycopg
from fastapi import APIRouter, HTTPException, Query

DATABASE_DSN = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/kudzu_operations",
)

router = APIRouter(prefix="/api/hr", tags=["HR Dashboard"])


def _serialize_value(value: Any) -> Any:
    """Serialize database values for JSON response."""
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


@router.get("/dashboard/key-highlights")
def get_hr_key_highlights() -> Dict[str, Any]:
    """Get HR dashboard key highlights."""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Total Candidates (from onboarding table)
                cur.execute("SELECT COUNT(*) FROM tbl_candidate_onboarding")
                total_candidates = int(cur.fetchone()[0] or 0)

                # Onboarding Pending (generated_link is empty)
                cur.execute("""
                    SELECT COUNT(*) 
                    FROM tbl_candidate_onboarding 
                    WHERE generated_link IS NULL OR generated_link = ''
                """)
                onboarding_pending = int(cur.fetchone()[0] or 0)

                # Onboarding Completed (status = 'completed')
                cur.execute("""
                    SELECT COUNT(*) 
                    FROM tbl_candidate_onboarding 
                    WHERE LOWER(status) = 'completed'
                """)
                onboarding_completed = int(cur.fetchone()[0] or 0)

                # Total Interviews Scheduled
                cur.execute("""
                    SELECT COUNT(*) 
                    FROM tbl_interview_schedule 
                    WHERE status IN ('scheduled', 'slot_allocated')
                """)
                total_interviews_scheduled = int(cur.fetchone()[0] or 0)

                return {
                    "total_candidates": total_candidates,
                    "onboarding_pending": onboarding_pending,
                    "onboarding_completed": onboarding_completed,
                    "total_interviews_scheduled": total_interviews_scheduled,
                }
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch HR key highlights: {exc}"
        ) from exc


@router.get("/dashboard/daily-candidate-registration")
def get_daily_candidate_registration(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    view: str = Query("monthly", description="View type: daily, weekly, monthly"),
) -> Dict[str, Any]:
    """Get daily candidate registration count."""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Default to last 30 days if no dates provided
                if not start_date:
                    start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
                if not end_date:
                    end_date = datetime.now().strftime("%Y-%m-%d")

                if view == "daily":
                    cur.execute("""
                        SELECT 
                            DATE(created_at) as registration_date,
                            COUNT(*) as count
                        FROM tbl_candidate_onboarding
                        WHERE DATE(created_at) BETWEEN %s AND %s
                        GROUP BY DATE(created_at)
                        ORDER BY registration_date ASC
                    """, (start_date, end_date))
                elif view == "weekly":
                    cur.execute("""
                        SELECT 
                            DATE_TRUNC('week', created_at)::DATE as registration_week,
                            COUNT(*) as count
                        FROM tbl_candidate_onboarding
                        WHERE DATE(created_at) BETWEEN %s AND %s
                        GROUP BY DATE_TRUNC('week', created_at)
                        ORDER BY registration_week ASC
                    """, (start_date, end_date))
                else:  # monthly
                    cur.execute("""
                        SELECT 
                            DATE_TRUNC('month', created_at)::DATE as registration_month,
                            COUNT(*) as count
                        FROM tbl_candidate_onboarding
                        WHERE DATE(created_at) BETWEEN %s AND %s
                        GROUP BY DATE_TRUNC('month', created_at)
                        ORDER BY registration_month ASC
                    """, (start_date, end_date))

                rows = cur.fetchall()
                daily_trend = []
                for row in rows:
                    date_value = row[0]
                    count = int(row[1] or 0)
                    if isinstance(date_value, date):
                        date_str = date_value.isoformat()
                    else:
                        date_str = str(date_value)
                    daily_trend.append({"date": date_str, "count": count})

                return {"daily_trend": daily_trend}
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch daily candidate registration: {exc}",
        ) from exc


@router.get("/dashboard/interview-status-overview")
def get_interview_status_overview(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
) -> Dict[str, Any]:
    """Get interview status overview (Scheduled, Completed, Cancelled)."""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                where_clause = ""
                params = []
                
                if start_date and end_date:
                    where_clause = "WHERE DATE(created_at) BETWEEN %s AND %s"
                    params = [start_date, end_date]

                # Get status counts from interview_schedule table
                cur.execute(f"""
                    SELECT 
                        status,
                        COUNT(*) as count
                    FROM tbl_interview_schedule
                    {where_clause}
                    GROUP BY status
                    ORDER BY status
                """, params)

                rows = cur.fetchall()
                status_counts = []
                for row in rows:
                    status = row[0] or "unknown"
                    count = int(row[1] or 0)
                    
                    # Map statuses to standard categories
                    if status in ["scheduled", "slot_allocated"]:
                        category = "Scheduled"
                    elif status in ["completed", "done"]:
                        category = "Completed"
                    elif status in ["cancelled", "cancelled", "reschedule"]:
                        category = "Cancelled"
                    else:
                        category = status.title()
                    
                    status_counts.append({"status": category, "count": count})

                # Also check tbl_interviews table
                cur.execute(f"""
                    SELECT 
                        status,
                        COUNT(*) as count
                    FROM tbl_interviews
                    {where_clause}
                    GROUP BY status
                    ORDER BY status
                """, params)

                interview_rows = cur.fetchall()
                for row in interview_rows:
                    status = row[0] or "unknown"
                    count = int(row[1] or 0)
                    
                    if status in ["scheduled"]:
                        category = "Scheduled"
                    elif status in ["completed", "done"]:
                        category = "Completed"
                    elif status in ["cancelled"]:
                        category = "Cancelled"
                    else:
                        category = status.title()
                    
                    # Merge with existing counts
                    found = False
                    for item in status_counts:
                        if item["status"] == category:
                            item["count"] += count
                            found = True
                            break
                    if not found:
                        status_counts.append({"status": category, "count": count})

                return {"status_overview": status_counts}
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch interview status overview: {exc}",
        ) from exc


@router.get("/dashboard/onboarding-status-graph")
def get_onboarding_status_graph(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
) -> Dict[str, Any]:
    """Get onboarding status distribution graph data."""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                where_clause = ""
                params = []
                
                if start_date and end_date:
                    where_clause = "WHERE DATE(created_at) BETWEEN %s AND %s"
                    params = [start_date, end_date]

                cur.execute(f"""
                    SELECT 
                        COALESCE(status, 'pending') as status,
                        COUNT(*) as count
                    FROM tbl_candidate_onboarding
                    {where_clause}
                    GROUP BY COALESCE(status, 'pending')
                    ORDER BY status
                """, params)

                rows = cur.fetchall()
                status_distribution = []
                total = 0
                
                for row in rows:
                    status = row[0] or "pending"
                    count = int(row[1] or 0)
                    total += count
                    status_distribution.append({
                        "status": status.title(),
                        "count": count,
                    })

                # Calculate percentages
                for item in status_distribution:
                    if total > 0:
                        item["percentage"] = round((item["count"] / total) * 100, 2)
                    else:
                        item["percentage"] = 0

                return {
                    "status_distribution": status_distribution,
                    "total": total,
                }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch onboarding status graph: {exc}",
        ) from exc

