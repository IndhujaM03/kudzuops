#!/usr/bin/env python3
"""
Script to assign test data to recruiter 4
"""

import os
import json
import psycopg

# Database connection
DATABASE_DSN = os.getenv(
    "DATABASE_URL",
    "postgresql://kudzuops:kudzu%40%402025@127.0.0.1:5432/kudzuops",
)

def assign_test_data():
    """Assign some test demands to recruiter 4"""
    print("[INFO] Assigning test data to recruiter 4...")
    
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Get the first 2 demands that don't have assigned_to data
                cur.execute("""
                    SELECT id, status, client_id 
                    FROM tbl_demand_sheet 
                    WHERE assigned_to IS NULL OR assigned_to = '[]'::json
                    ORDER BY id DESC 
                    LIMIT 2
                """)
                demands = cur.fetchall()
                
                if not demands:
                    print("[WARN] No unassigned demands found")
                    return
                
                print(f"[INFO] Found {len(demands)} unassigned demands")
                
                # Assign them to recruiter 4 using JSON format
                for demand in demands:
                    demand_id = demand[0]
                    # Create JSON format: {"recruiter_ids": [4]}
                    assigned_data = json.dumps({"recruiter_ids": [4]})
                    
                    cur.execute(
                        "UPDATE tbl_demand_sheet SET assigned_to = %s::json WHERE id = %s",
                        (assigned_data, demand_id)
                    )
                    print(f"[ASSIGN] Assigned demand {demand_id} to recruiter 4: {assigned_data}")
                
                conn.commit()
                print("[SUCCESS] Test data assigned successfully!")
                
                # Verify the assignment
                cur.execute("""
                    SELECT COUNT(*) FROM tbl_demand_sheet 
                    WHERE assigned_to::jsonb ? '4'
                """)
                count = cur.fetchone()[0]
                print(f"[VERIFY] Recruiter 4 now has {count} assigned demands")
                
    except Exception as e:
        print(f"[ERROR] Failed to assign test data: {e}")

if __name__ == "__main__":
    assign_test_data()
