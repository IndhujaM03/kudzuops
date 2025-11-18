#!/usr/bin/env python3
"""Run migration 023_update_no_of_submissions.sql"""

import os
import sys
import psycopg
from dotenv import load_dotenv, find_dotenv

# Load environment variables
load_dotenv(find_dotenv(), override=False)

def get_dsn() -> str:
    # Prefer discrete vars to avoid URL-encoding issues for special chars in password
    host = os.getenv("DB_HOST")
    name = os.getenv("DB_NAME")
    user = os.getenv("DB_USER")
    password = os.getenv("DB_PASS")
    port = os.getenv("DB_PORT", "5432")
    if host and name and user and password:
        # libpq keyword conninfo is safe for special characters
        return f"host={host} port={port} dbname={name} user={user} password={password}"
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql://kudzuops:kudzu%40%402025@127.0.0.1:5432/kudzuops",
    )
    return database_url

def main():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    migration_file = os.path.join(repo_root, "migrations", "023_update_no_of_submissions.sql")
    
    if not os.path.exists(migration_file):
        print(f"Error: Migration file not found: {migration_file}")
        return 1
    
    dsn = get_dsn()
    print(f"Connecting to database...")
    print(f"DSN: {dsn.split('@')[0]}@...")  # Don't print full password
    
    try:
        with psycopg.connect(dsn) as conn:
            with conn.cursor() as cur:
                print(f"Applying migration: 023_update_no_of_submissions.sql")
                with open(migration_file, "r", encoding="utf-8") as f:
                    sql_text = f.read()
                cur.execute(sql_text)
            conn.commit()
        print("Migration applied successfully!")
        return 0
    except Exception as e:
        print(f"Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())



