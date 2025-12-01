"""
Script to update existing records in tbl_demand_sheet with Team Leader ID.

This script:
1. Fetches the Team Leader's user ID from tbl_users table
2. Updates all existing rows in tbl_demand_sheet where tl_id is NULL
3. Assigns the fetched Team Leader ID to the tl_id column
"""

import os
import sys
import psycopg
from dotenv import load_dotenv

# Add parent directory to path to import config
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

try:
    from app.config import settings
    DATABASE_DSN = settings.database_url
except Exception:
    # Fallback to environment variable
    load_dotenv()
    DATABASE_DSN = os.getenv("DATABASE_URL", "")

if not DATABASE_DSN:
    print("ERROR: DATABASE_URL not found in environment variables or config")
    sys.exit(1)


def get_team_leader_id(cur) -> int | None:
    """Fetch the Team Leader's user ID from tbl_users table based on role."""
    try:
        # Get the first active team leader (role = 'team_leader' or 'tl')
        cur.execute("""
            SELECT id FROM tbl_users 
            WHERE role IN ('team_leader', 'tl') 
            AND is_active = TRUE 
            AND approval_status = TRUE
            ORDER BY id ASC 
            LIMIT 1
        """)
        result = cur.fetchone()
        if result:
            return result[0]
        return None
    except Exception as e:
        print(f"Error fetching team leader ID: {e}")
        return None


def update_existing_demands():
    """Update all existing demands with Team Leader ID."""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # First, ensure the column exists (run migration if needed)
                try:
                    cur.execute("""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name = 'tbl_demand_sheet' 
                        AND column_name = 'tl_id'
                    """)
                    if not cur.fetchone():
                        print("ERROR: tl_id column does not exist. Please run migration 026_add_tl_id_to_demand_sheet.sql first.")
                        return False
                except Exception as e:
                    print(f"Error checking for tl_id column: {e}")
                    return False
                
                # Get Team Leader ID
                print("Fetching Team Leader ID...")
                tl_id = get_team_leader_id(cur)
                
                if not tl_id:
                    print("ERROR: No active Team Leader found in tbl_users table.")
                    print("Please ensure there is at least one user with role='team_leader' or role='tl'")
                    print("and is_active=TRUE and approval_status=TRUE")
                    return False
                
                print(f"Found Team Leader with ID: {tl_id}")
                
                # Count existing records without tl_id
                cur.execute("""
                    SELECT COUNT(*) FROM tbl_demand_sheet 
                    WHERE tl_id IS NULL
                """)
                count = cur.fetchone()[0]
                print(f"Found {count} demand records without tl_id")
                
                if count == 0:
                    print("All demand records already have tl_id assigned. Nothing to update.")
                    return True
                
                # Update all records where tl_id is NULL
                cur.execute("""
                    UPDATE tbl_demand_sheet 
                    SET tl_id = %s 
                    WHERE tl_id IS NULL
                """, (tl_id,))
                
                updated_count = cur.rowcount
                conn.commit()
                
                print(f"Successfully updated {updated_count} demand records with Team Leader ID: {tl_id}")
                return True
                
    except Exception as e:
        print(f"ERROR: Failed to update existing demands: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("Update Existing Demands with Team Leader ID")
    print("=" * 60)
    print()
    
    success = update_existing_demands()
    
    if success:
        print()
        print("=" * 60)
        print("Update completed successfully!")
        print("=" * 60)
        sys.exit(0)
    else:
        print()
        print("=" * 60)
        print("Update failed. Please check the errors above.")
        print("=" * 60)
        sys.exit(1)








