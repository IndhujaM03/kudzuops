#!/usr/bin/env python3
"""Debug script to check CV count for a specific demand_id"""

import os
import json
import psycopg
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv(), override=False)

def get_dsn() -> str:
    host = os.getenv("DB_HOST")
    name = os.getenv("DB_NAME")
    user = os.getenv("DB_USER")
    password = os.getenv("DB_PASS")
    port = os.getenv("DB_PORT", "5432")
    if host and name and user and password:
        return f"host={host} port={port} dbname={name} user={user} password={password}"
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql://kudzuops:kudzu%40%402025@127.0.0.1:5432/kudzuops",
    )
    return database_url

def debug_demand_cv_count(demand_id: int):
    dsn = get_dsn()
    try:
        with psycopg.connect(dsn) as conn:
            with conn.cursor() as cur:
                print(f"\n{'='*80}")
                print(f"Debugging CV Count for Demand ID: {demand_id}")
                print(f"{'='*80}\n")
                
                # Get all recruiter activities for this demand
                cur.execute("""
                    SELECT 
                        id,
                        recruiter_id,
                        uploaded_cv_count,
                        required_cv_count,
                        cv_list,
                        activity_status
                    FROM tbl_recruiter_activity
                    WHERE demand_id = %s
                    ORDER BY id
                """, (demand_id,))
                
                activities = cur.fetchall()
                
                if not activities:
                    print(f"No recruiter activities found for demand_id {demand_id}")
                    return
                
                total_cv_count_from_list = 0
                total_uploaded_cv_count = 0
                
                print("Recruiter Activities:")
                print("-" * 80)
                for activity in activities:
                    activity_id, recruiter_id, uploaded_cv_count, required_cv_count, cv_list, activity_status = activity
                    
                    # Parse cv_list
                    if cv_list:
                        if isinstance(cv_list, str):
                            try:
                                cv_data = json.loads(cv_list)
                            except:
                                cv_data = []
                        else:
                            cv_data = cv_list
                        
                        # Count CVs (excluding rejected ones with status = 2)
                        cv_count = 0
                        rejected_count = 0
                        for cv in cv_data:
                            status = cv.get('status')
                            if status is not None:
                                try:
                                    status_int = int(status)
                                    if status_int != 2:  # Not rejected
                                        cv_count += 1
                                    else:
                                        rejected_count += 1
                                except:
                                    cv_count += 1
                            else:
                                cv_count += 1
                        
                        total_cv_count_from_list += cv_count
                        total_uploaded_cv_count += uploaded_cv_count or 0
                        
                        print(f"\nActivity ID: {activity_id}")
                        print(f"  Recruiter ID: {recruiter_id}")
                        print(f"  Activity Status: {activity_status}")
                        print(f"  uploaded_cv_count (in DB): {uploaded_cv_count}")
                        print(f"  required_cv_count: {required_cv_count}")
                        print(f"  CVs in cv_list (excluding rejected): {cv_count}")
                        print(f"  Rejected CVs: {rejected_count}")
                        print(f"  Total entries in cv_list: {len(cv_data)}")
                        print(f"  CV List Details:")
                        for idx, cv in enumerate(cv_data):
                            status = cv.get('status', 'null')
                            file = cv.get('file', 'N/A')
                            candidate_id = cv.get('candidate_id', 'N/A')
                            print(f"    [{idx+1}] File: {file}, Status: {status}, Candidate ID: {candidate_id}")
                    else:
                        print(f"\nActivity ID: {activity_id}")
                        print(f"  Recruiter ID: {recruiter_id}")
                        print(f"  uploaded_cv_count (in DB): {uploaded_cv_count}")
                        print(f"  cv_list: NULL or empty")
                
                print(f"\n{'='*80}")
                print("Summary:")
                print(f"  Total uploaded_cv_count (sum from DB): {total_uploaded_cv_count}")
                print(f"  Total CVs from cv_list (excluding rejected): {total_cv_count_from_list}")
                print(f"{'='*80}\n")
                
                # Check what the _check_and_update_demand_status function would calculate
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
                
                calculated_count = cur.fetchone()[0]
                print(f"  Calculated count (using SQL query): {calculated_count}")
                print(f"{'='*80}\n")
                
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    import sys
    demand_id = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    debug_demand_cv_count(demand_id)



