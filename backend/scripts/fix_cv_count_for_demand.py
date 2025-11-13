#!/usr/bin/env python3
"""Fix CV count for a specific demand_id by recalculating from cv_list"""

import os
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

def fix_cv_count_for_demand(demand_id: int):
    dsn = get_dsn()
    try:
        with psycopg.connect(dsn) as conn:
            with conn.cursor() as cur:
                print(f"\n{'='*80}")
                print(f"Fixing CV Count for Demand ID: {demand_id}")
                print(f"{'='*80}\n")
                
                # Calculate the correct count from cv_list
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
                print(f"Calculated correct count from cv_list: {calculated_count}")
                
                # Get current uploaded_cv_count
                cur.execute("""
                    SELECT uploaded_cv_count 
                    FROM tbl_recruiter_activity 
                    WHERE demand_id = %s 
                    LIMIT 1
                """, (demand_id,))
                
                result = cur.fetchone()
                current_count = result[0] if result else 0
                print(f"Current uploaded_cv_count in DB: {current_count}")
                
                if calculated_count != current_count:
                    print(f"\n⚠️  Mismatch detected! Updating uploaded_cv_count from {current_count} to {calculated_count}")
                    
                    # Update all recruiter activities with the correct count
                    cur.execute("""
                        UPDATE tbl_recruiter_activity 
                        SET uploaded_cv_count = %s, updated_at = NOW()
                        WHERE demand_id = %s
                    """, (calculated_count, demand_id))
                    
                    conn.commit()
                    print(f"✅ Successfully updated uploaded_cv_count to {calculated_count} for all activities with demand_id {demand_id}")
                else:
                    print(f"\n✅ Count is already correct. No update needed.")
                
                print(f"{'='*80}\n")
                
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    import sys
    demand_id = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    fix_cv_count_for_demand(demand_id)



