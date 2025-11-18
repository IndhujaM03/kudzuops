#!/usr/bin/env python3
"""Verify migration 023_update_no_of_submissions.sql results"""

import os
import psycopg
from dotenv import load_dotenv, find_dotenv

# Load environment variables
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

def main():
    dsn = get_dsn()
    try:
        with psycopg.connect(dsn) as conn:
            with conn.cursor() as cur:
                # Check if counts are consistent (only counting accepted submissions)
                cur.execute("""
                    SELECT 
                        demand_id,
                        COUNT(*) as total_records,
                        COUNT(*) FILTER (WHERE shortlisted = 1) as accepted_count,
                        COUNT(*) FILTER (WHERE shortlisted = 0) as rejected_count,
                        MAX(no_of_submissions) as max_no_of_submissions,
                        MIN(no_of_submissions) as min_no_of_submissions,
                        CASE 
                            WHEN COUNT(*) FILTER (WHERE shortlisted = 1) = MAX(no_of_submissions) 
                                 AND COUNT(*) FILTER (WHERE shortlisted = 1) = MIN(no_of_submissions)
                            THEN 'Consistent'
                            ELSE 'Inconsistent'
                        END as status
                    FROM tbl_submissions
                    WHERE demand_id IS NOT NULL
                    GROUP BY demand_id
                    ORDER BY demand_id
                """)
                
                results = cur.fetchall()
                
                if not results:
                    print("No submissions found in tbl_submissions table.")
                    return
                
                print("\nVerification Results:")
                print("=" * 100)
                print(f"{'Demand ID':<12} {'Total Records':<15} {'Accepted':<12} {'Rejected':<12} {'no_of_submissions':<20} {'Status':<15}")
                print("=" * 100)
                
                consistent_count = 0
                inconsistent_count = 0
                
                for row in results:
                    demand_id, total_records, accepted_count, rejected_count, max_val, min_val, status = row
                    print(f"{demand_id:<12} {total_records:<15} {accepted_count:<12} {rejected_count:<12} {max_val:<20} {status:<15}")
                    if status == 'Consistent':
                        consistent_count += 1
                    else:
                        inconsistent_count += 1
                
                print("=" * 100)
                print(f"\nSummary:")
                print(f"  Total demands with submissions: {len(results)}")
                print(f"  Consistent: {consistent_count}")
                print(f"  Inconsistent: {inconsistent_count}")
                
                if inconsistent_count == 0:
                    print("\n✅ All no_of_submissions values are consistent with accepted submission counts!")
                    print("   Note: Only accepted profiles (shortlisted = 1) are counted in no_of_submissions.")
                else:
                    print(f"\n⚠️  {inconsistent_count} demand(s) have inconsistent counts.")
                
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()

