import os
import sys
import glob
import psycopg
from dotenv import load_dotenv, find_dotenv

# Fix Unicode encoding for Windows console
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')


def get_dsn() -> str:
    # Load environment variables from .env (backend or project root)
    load_dotenv(find_dotenv(), override=False)
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


def apply_sql_files(migrations_dir: str) -> int:
    files = sorted(glob.glob(os.path.join(migrations_dir, "*.sql")))
    if not files:
        print(f"No .sql files found in {migrations_dir}")
        return 0

    dsn = get_dsn()
    failed_files = []
    try:
        with psycopg.connect(dsn) as conn:
            with conn.cursor() as cur:
                for path in files:
                    filename = os.path.basename(path)
                    try:
                        print(f"Applying migration: {filename}")
                        with open(path, "r", encoding="utf-8") as f:
                            sql_text = f.read()
                        cur.execute(sql_text)
                        conn.commit()  # Commit after each successful migration
                    except Exception as e:
                        print(f"  ⚠️  Warning: {filename} failed: {e}")
                        print(f"  Continuing with next migration...")
                        conn.rollback()  # Rollback the failed migration
                        failed_files.append((filename, str(e)))
                        # Continue with next migration instead of stopping
        if failed_files:
            print(f"\n⚠️  {len(failed_files)} migration(s) had errors:")
            for filename, error in failed_files:
                print(f"  - {filename}: {error}")
            print("\n✅ Other migrations completed successfully.")
            return 1
        else:
            print("✅ All migrations applied successfully.")
            return 0
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        print(f"Using DSN: {dsn}")
        return 1


def main() -> int:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    migrations_dir = os.path.join(repo_root, "migrations")
    return apply_sql_files(migrations_dir)


if __name__ == "__main__":
    sys.exit(main())


