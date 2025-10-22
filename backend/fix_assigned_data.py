#!/usr/bin/env python3
"""
Script to check and fix assigned_to data format in the database
"""

import os
import json
import psycopg

# Database connection
try:
    from app.config import settings
    DATABASE_DSN = settings.database_url
except Exception:
    DATABASE_DSN = os.getenv(
        "DATABASE_URL",
        "postgresql://kudzuops:kudzu%40%402025@127.0.0.1:5432/kudzuops",
    )

def check_and_fix_assigned_data():
    """Check and fix assigned_to data format"""
    print("[INFO] Checking assigned_to data format...")
    
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Check current data
                cur.execute("""
                    SELECT id, assigned_to, status 
                    FROM tbl_demand_sheet 
                    WHERE assigned_to IS NOT NULL 
                    ORDER BY id DESC 
                    LIMIT 5
                """)
                rows = cur.fetchall()
                
                print(f"[INFO] Found {len(rows)} demands with assigned_to data:")
                for row in rows:
                    print(f"  ID: {row[0]}, assigned_to: {row[1]}, status: {row[2]}")
                
                # Check if we have any data
                if not rows:
                    print("[WARN] No demands found with assigned_to data")
                    return
                
                # Try to understand the current format
                sample_assigned_to = rows[0][1]
                print(f"[INFO] Sample assigned_to format: {type(sample_assigned_to)} - {sample_assigned_to}")
                
                # Check if it's already in JSON format
                if isinstance(sample_assigned_to, str) and sample_assigned_to.startswith('{'):
                    print("[INFO] Data appears to be in JSON format already")
                elif isinstance(sample_assigned_to, list):
                    print("[INFO] Data appears to be in array format")
                    # Convert array to JSON format
                    print("[CONVERT] Converting array format to JSON...")
                    for row in rows:
                        demand_id = row[0]
                        assigned_array = row[1]
                        if isinstance(assigned_array, list):
                            # Convert array to JSON format
                            json_data = json.dumps({"recruiter_ids": assigned_array})
                            cur.execute(
                                "UPDATE tbl_demand_sheet SET assigned_to = %s::json WHERE id = %s",
                                (json_data, demand_id)
                            )
                            print(f"  Updated demand {demand_id}: {assigned_array} -> {json_data}")
                    conn.commit()
                    print("[SUCCESS] Conversion completed!")
                else:
                    print(f"[WARN] Unknown format: {type(sample_assigned_to)}")
                
                # Test the queries after conversion
                print("[TEST] Testing queries...")
                
                # Test JSON query
                try:
                    cur.execute("SELECT COUNT(*) FROM tbl_demand_sheet WHERE assigned_to::jsonb ? %s", ("4",))
                    json_count = cur.fetchone()[0]
                    print(f"[TEST] JSON query result: {json_count} demands for recruiter 4")
                except Exception as e:
                    print(f"[TEST] JSON query failed: {e}")
                
                # Test array query
                try:
                    cur.execute("SELECT COUNT(*) FROM tbl_demand_sheet WHERE 4 = ANY(assigned_to)")
                    array_count = cur.fetchone()[0]
                    print(f"[TEST] Array query result: {array_count} demands for recruiter 4")
                except Exception as e:
                    print(f"[TEST] Array query failed: {e}")
                
    except Exception as e:
        print(f"[ERROR] Database operation failed: {e}")

if __name__ == "__main__":
    check_and_fix_assigned_data()
