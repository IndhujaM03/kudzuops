#!/usr/bin/env python3
"""
Migration script to change assigned_to column from jsonb[] to json
and update existing data to JSON format.
"""

import os
import json
import psycopg

# Database connection - try to use the same logic as the app
try:
    from app.config import settings
    DATABASE_DSN = settings.database_url
except Exception:
    DATABASE_DSN = os.getenv(
        "DATABASE_URL",
        "postgresql://kudzuops:kudzu%40%402025@127.0.0.1:5432/kudzuops",
    )

def migrate_assigned_to_column():
    """Migrate assigned_to column from jsonb[] to json format"""
    print("[MIGRATION] Starting migration of assigned_to column...")
    
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Step 1: Check current column type
                cur.execute("""
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = 'tbl_demand_sheet' 
                    AND column_name = 'assigned_to'
                """)
                result = cur.fetchone()
                if result:
                    print(f"[INFO] Current column type: {result[1]}")
                else:
                    print("[ERROR] assigned_to column not found")
                    return
                
                # Step 2: Create backup of current data
                print("[BACKUP] Creating backup of current assigned_to data...")
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS tbl_demand_sheet_backup_assigned_to AS
                    SELECT id, assigned_to FROM tbl_demand_sheet
                """)
                
                # Step 3: Convert existing data to JSON format
                print("[CONVERT] Converting existing data to JSON format...")
                cur.execute("""
                    UPDATE tbl_demand_sheet 
                    SET assigned_to = CASE 
                        WHEN assigned_to IS NULL THEN '[]'::json
                        WHEN jsonb_array_length(assigned_to::jsonb) = 0 THEN '[]'::json
                        ELSE jsonb_build_object('recruiter_ids', assigned_to)::json
                    END
                """)
                
                # Step 4: Change column type from jsonb[] to json
                print("[ALTER] Changing column type from jsonb[] to json...")
                cur.execute("""
                    ALTER TABLE tbl_demand_sheet 
                    ALTER COLUMN assigned_to TYPE json 
                    USING assigned_to::json
                """)
                
                # Step 5: Set default value
                cur.execute("""
                    ALTER TABLE tbl_demand_sheet 
                    ALTER COLUMN assigned_to SET DEFAULT '[]'::json
                """)
                
                # Step 6: Verify the migration
                print("[VERIFY] Verifying migration...")
                cur.execute("""
                    SELECT column_name, data_type, column_default
                    FROM information_schema.columns 
                    WHERE table_name = 'tbl_demand_sheet' 
                    AND column_name = 'assigned_to'
                """)
                result = cur.fetchone()
                print(f"[INFO] New column type: {result[1]}")
                print(f"[INFO] Default value: {result[2]}")
                
                # Step 7: Show sample data
                cur.execute("""
                    SELECT id, assigned_to 
                    FROM tbl_demand_sheet 
                    WHERE assigned_to IS NOT NULL 
                    AND assigned_to != '[]'::json
                    LIMIT 5
                """)
                samples = cur.fetchall()
                print("[SAMPLE] Sample data after migration:")
                for row in samples:
                    print(f"  ID: {row[0]}, assigned_to: {row[1]}")
                
                conn.commit()
                print("[SUCCESS] Migration completed successfully!")
                
    except Exception as e:
        print(f"[ERROR] Migration failed: {e}")
        raise

if __name__ == "__main__":
    migrate_assigned_to_column()
