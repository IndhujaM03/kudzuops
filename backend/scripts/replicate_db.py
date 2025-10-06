import os
import sys
import argparse
import glob
from typing import Optional

import psycopg
from psycopg import sql
from dotenv import load_dotenv, find_dotenv


def build_admin_conninfo(args: argparse.Namespace) -> str:
    host = args.host or os.getenv("PGHOST", "127.0.0.1")
    port = args.port or os.getenv("PGPORT", "5432")
    user = args.admin_user or os.getenv("PGUSER", "postgres")
    password = args.admin_password or os.getenv("PGPASSWORD", "")
    return f"host={host} port={port} dbname=postgres user={user} password={password}"


def build_target_conninfo(args: argparse.Namespace) -> str:
    # Prefer discrete env for safety; fallback to DATABASE_URL
    host = args.host or os.getenv("DB_HOST") or os.getenv("PGHOST", "127.0.0.1")
    port = args.port or os.getenv("DB_PORT") or os.getenv("PGPORT", "5432")
    name = args.db_name or os.getenv("DB_NAME", "kudzuops")
    user = args.db_user or os.getenv("DB_USER") or os.getenv("PGUSER", "postgres")
    password = args.db_password or os.getenv("DB_PASS") or os.getenv("PGPASSWORD", "")
    return f"host={host} port={port} dbname={name} user={user} password={password}"


def ensure_database_exists(admin_conninfo: str, db_name: str, owner: Optional[str]) -> None:
    with psycopg.connect(admin_conninfo, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname=%s", (db_name,))
            exists = cur.fetchone() is not None
        if not exists:
            with conn.cursor() as cur:
                if owner:
                    cur.execute(
                        sql.SQL("CREATE DATABASE {} OWNER {};").format(
                            sql.Identifier(db_name), sql.Identifier(owner)
                        )
                    )
                else:
                    cur.execute(sql.SQL("CREATE DATABASE {};").format(sql.Identifier(db_name)))
            print(f"Created database: {db_name}")
        else:
            print(f"Database exists: {db_name}")


def apply_migrations(target_conninfo: str, migrations_dir: str) -> None:
    files = sorted(glob.glob(os.path.join(migrations_dir, "*.sql")))
    if not files:
        print(f"No .sql files found in {migrations_dir}")
        return

    with psycopg.connect(target_conninfo) as conn:
        with conn.cursor() as cur:
            for path in files:
                print(f"Applying migration: {os.path.basename(path)}")
                with open(path, "r", encoding="utf-8") as f:
                    sql_text = f.read()
                cur.execute(sql_text)
        conn.commit()
    print("All migrations applied.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Replicate PostgreSQL database schema using migrations")
    parser.add_argument("--db-name", dest="db_name", help="Target database name (default: env DB_NAME or kudzuops)")
    parser.add_argument("--db-user", dest="db_user", help="Target database user (default: env DB_USER or PGUSER)")
    parser.add_argument("--db-password", dest="db_password", help="Target database password (default: env DB_PASS or PGPASSWORD)")
    parser.add_argument("--host", dest="host", help="Database host (default: env DB_HOST or PGHOST)")
    parser.add_argument("--port", dest="port", help="Database port (default: env DB_PORT or PGPORT)")
    parser.add_argument("--admin-user", dest="admin_user", help="Admin/superuser for CREATE DATABASE (default: env PGUSER=postgres)")
    parser.add_argument("--admin-password", dest="admin_password", help="Admin password (default: env PGPASSWORD)")
    parser.add_argument("--owner", dest="owner", help="Owner role for created database (default: same as --db-user)")
    parser.add_argument("--migrations-dir", dest="migrations_dir", help="Directory containing .sql migrations (default: backend/migrations)")
    return parser.parse_args()


def main() -> int:
    load_dotenv(find_dotenv(), override=False)
    args = parse_args()

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    migrations_dir = args.migrations_dir or os.path.join(repo_root, "migrations")

    # Step 1: Ensure DB exists
    admin_conninfo = build_admin_conninfo(args)
    target_conninfo = build_target_conninfo(args)

    db_name = args.db_name or os.getenv("DB_NAME", "kudzuops")
    owner = args.owner or args.db_user or os.getenv("DB_USER")

    try:
        ensure_database_exists(admin_conninfo, db_name, owner)
        # Step 2: Apply migrations
        apply_migrations(target_conninfo, migrations_dir)
        print("Schema replication complete.")
        return 0
    except Exception as e:
        print(f"ERROR: {e}")
        print("admin_conninfo:", admin_conninfo)
        print("target_conninfo:", target_conninfo)
        return 1


if __name__ == "__main__":
    sys.exit(main())


