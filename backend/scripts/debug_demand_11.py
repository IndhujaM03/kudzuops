#!/usr/bin/env python3
"""
Debug script to check why demand ID 11 profiles are not showing in submitted tab
"""
import os
import sys
import json
import psycopg

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from app.config import settings
    DATABASE_DSN = settings.database_url
except Exception:
    DATABASE_DSN = os.getenv("DATABASE_URL", "")

def debug_demand_11():
    """Debug demand ID 11 to see why profiles aren't showing"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Check demand details
                print("=" * 80)
                print("DEMAND ID 11 DETAILS")
                print("=" * 80)
                cur.execute("""
                    SELECT id, skill, client_id, spoc_id, tl_id, status, created_at
                    FROM tbl_demand_sheet
                    WHERE id = 11
                """)
                demand = cur.fetchone()
                if demand:
                    print(f"Demand ID: {demand[0]}")
                    print(f"Skill: {demand[1]}")
                    print(f"Client ID: {demand[2]}")
                    print(f"SPOC ID: {demand[3]}")
                    print(f"TL ID: {demand[4]}")
                    print(f"Status: {demand[5]}")
                    print(f"Created At: {demand[6]}")
                else:
                    print("Demand ID 11 not found!")
                    return
                
                print("\n" + "=" * 80)
                print("RECRUITER ACTIVITY FOR DEMAND ID 11")
                print("=" * 80)
                cur.execute("""
                    SELECT 
                        ra.id,
                        ra.recruiter_id,
                        ra.demand_id,
                        ra.cv_list,
                        ra.uploaded_cv_count,
                        ra.required_cv_count,
                        ra.created_at,
                        ra.updated_at
                    FROM tbl_recruiter_activity ra
                    WHERE ra.demand_id = 11
                    ORDER BY ra.updated_at DESC
                """)
                activities = cur.fetchall()
                print(f"Found {len(activities)} recruiter activity records")
                
                for activity in activities:
                    print(f"\n--- Activity ID: {activity[0]} ---")
                    print(f"Recruiter ID: {activity[1]}")
                    print(f"Demand ID: {activity[2]}")
                    print(f"Uploaded CV Count: {activity[4]}")
                    print(f"Required CV Count: {activity[5]}")
                    
                    cv_list = activity[3]
                    if isinstance(cv_list, str):
                        try:
                            cv_list = json.loads(cv_list)
                        except:
                            cv_list = []
                    
                    if isinstance(cv_list, list):
                        print(f"CV List Length: {len(cv_list)}")
                        for idx, cv in enumerate(cv_list):
                            print(f"  CV {idx + 1}:")
                            print(f"    Candidate Name: {cv.get('candidate_name', 'N/A')}")
                            print(f"    Status: {cv.get('status')} (type: {type(cv.get('status'))})")
                            print(f"    CV URL: {cv.get('cv_url', 'N/A')}")
                    else:
                        print(f"CV List: {cv_list}")
                
                print("\n" + "=" * 80)
                print("PROFILES IN TBL_SUBMISSIONS FOR DEMAND ID 11")
                print("=" * 80)
                # First check what columns exist in tbl_submissions
                cur.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'tbl_submissions'
                    ORDER BY ordinal_position
                """)
                columns = cur.fetchall()
                print(f"tbl_submissions columns: {[c[0] for c in columns]}")
                
                cur.execute("""
                    SELECT demand_id, recruiter_id, candidate_name, created_at
                    FROM tbl_submissions
                    WHERE demand_id = 11
                """)
                submissions = cur.fetchall()
                print(f"Found {len(submissions)} submissions")
                for sub in submissions:
                    print(f"  Demand: {sub[0]}, Recruiter: {sub[1]}, Candidate: {sub[2]}, Created: {sub[3]}")
                
                print("\n" + "=" * 80)
                print("TESTING CV-SUBMITTED QUERY LOGIC")
                print("=" * 80)
                tl_id = demand[4]  # Get tl_id from demand
                print(f"Using TL ID: {tl_id}")
                
                cur.execute("""
                    SELECT 
                        ra.id,
                        ra.recruiter_id,
                        ra.demand_id,
                        ra.cv_list,
                        ds.tl_id
                    FROM tbl_recruiter_activity ra
                    INNER JOIN tbl_demand_sheet ds ON ra.demand_id = ds.id
                    WHERE ds.tl_id = %s
                    AND ra.demand_id = 11
                    AND ra.cv_list IS NOT NULL 
                    AND jsonb_array_length(ra.cv_list) > 0
                    AND EXISTS (
                        SELECT 1 FROM jsonb_array_elements(ra.cv_list) AS cv
                        WHERE cv->>'status' = '1'
                    )
                """, (tl_id,))
                matching_records = cur.fetchall()
                print(f"Found {len(matching_records)} records matching the query")
                
                for record in matching_records:
                    print(f"\n--- Record ID: {record[0]} ---")
                    print(f"Recruiter ID: {record[1]}")
                    print(f"Demand ID: {record[2]}")
                    print(f"TL ID: {record[4]}")
                    
                    cv_list = record[3]
                    if isinstance(cv_list, str):
                        try:
                            cv_list = json.loads(cv_list)
                        except:
                            cv_list = []
                    
                    if isinstance(cv_list, list):
                        status_1_cvs = [cv for cv in cv_list if cv.get('status') == 1 or cv.get('status') == '1']
                        print(f"CVs with status = 1: {len(status_1_cvs)}")
                        for cv in status_1_cvs:
                            print(f"  - {cv.get('candidate_name', 'N/A')} (status: {cv.get('status')})")
                
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_demand_11()

