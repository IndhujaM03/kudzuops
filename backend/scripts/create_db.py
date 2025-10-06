import os
import sys
import psycopg
from psycopg import sql


def main() -> int:
    db_name = os.getenv("DB_NAME", "kudzuops")
    owner = os.getenv("DB_OWNER", "kudzuops")

    host = os.getenv("PGHOST", "127.0.0.1")
    port = int(os.getenv("PGPORT", "5432"))
    user = os.getenv("PGUSER", "postgres")
    password = os.getenv("PGPASSWORD", "")

    try:
        # Connect with autocommit for CREATE DATABASE
        with psycopg.connect(dbname="postgres", host=host, port=port, user=user, password=password, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM pg_database WHERE datname=%s", (db_name,))
                exists = cur.fetchone() is not None
            if not exists:
                with conn.cursor() as cur:
                    cur.execute(
                        sql.SQL("CREATE DATABASE {} OWNER {};").format(
                            sql.Identifier(db_name), sql.Identifier(owner)
                        )
                    )
                print(f"Created database: {db_name} (owner: {owner})")
            else:
                print(f"Database already exists: {db_name}")
        return 0
    except Exception as e:
        print(f"ERROR: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
