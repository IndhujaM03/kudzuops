"""Verify that tl_id column was added successfully"""
import os
import sys
import psycopg
from dotenv import load_dotenv

load_dotenv()

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

try:
    dsn = get_dsn()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            # Check if column exists
            cur.execute("""
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = 'tbl_demand_sheet' 
                AND column_name = 'tl_id'
            """)
            result = cur.fetchone()
            
            if result:
                print("✅ Column 'tl_id' exists!")
                print(f"   Name: {result[0]}")
                print(f"   Type: {result[1]}")
                print(f"   Nullable: {result[2]}")
            else:
                print("❌ Column 'tl_id' not found!")
                sys.exit(1)
            
            # Check foreign key constraint
            cur.execute("""
                SELECT constraint_name 
                FROM information_schema.table_constraints 
                WHERE table_name = 'tbl_demand_sheet' 
                AND constraint_name = 'tbl_demand_sheet_tl_id_fkey'
            """)
            fk = cur.fetchone()
            
            if fk:
                print(f"✅ Foreign key constraint exists: {fk[0]}")
            else:
                print("⚠️  Foreign key constraint not found")
            
            # Check index
            cur.execute("""
                SELECT indexname 
                FROM pg_indexes 
                WHERE tablename = 'tbl_demand_sheet' 
                AND indexname = 'idx_tbl_demand_sheet_tl_id'
            """)
            idx = cur.fetchone()
            
            if idx:
                print(f"✅ Index exists: {idx[0]}")
            else:
                print("⚠️  Index not found")
            
            print("\n✅ Migration verification complete!")
            
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)


