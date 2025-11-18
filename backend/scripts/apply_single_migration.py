"""
Apply a single migration file by name or number.
Usage: python scripts/apply_single_migration.py 102
       python scripts/apply_single_migration.py 102_sync_current_schema.sql
"""
import os
import sys
import psycopg
from dotenv import load_dotenv, find_dotenv


def get_dsn() -> str:
    load_dotenv(find_dotenv(), override=False)
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


def apply_single_migration(migration_name: str) -> int:
    """Apply a single migration file."""
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    migrations_dir = os.path.join(repo_root, "migrations")
    
    # Find the migration file
    migration_file = None
    
    # If it's just a number, find the file
    if migration_name.isdigit():
        for filename in os.listdir(migrations_dir):
            if filename.startswith(f"{migration_name}_") and filename.endswith(".sql"):
                migration_file = os.path.join(migrations_dir, filename)
                break
    else:
        # It's a filename
        if not migration_name.endswith(".sql"):
            migration_name += ".sql"
        migration_file = os.path.join(migrations_dir, migration_name)
    
    if not migration_file or not os.path.exists(migration_file):
        print(f"❌ Migration file not found: {migration_name}")
        print(f"   Searched in: {migrations_dir}")
        return 1
    
    dsn = get_dsn()
    try:
        print(f"Applying migration: {os.path.basename(migration_file)}")
        with psycopg.connect(dsn) as conn:
            with conn.cursor() as cur:
                with open(migration_file, "r", encoding="utf-8") as f:
                    sql_text = f.read()
                cur.execute(sql_text)
            conn.commit()
        print("✅ Migration applied successfully!")
        return 0
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        print(f"Using DSN: {dsn}")
        return 1


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/apply_single_migration.py <migration_number_or_filename>")
        print("Example: python scripts/apply_single_migration.py 102")
        print("Example: python scripts/apply_single_migration.py 102_sync_current_schema.sql")
        sys.exit(1)
    
    migration_name = sys.argv[1]
    sys.exit(apply_single_migration(migration_name))

