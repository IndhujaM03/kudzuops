import os
import sys
import psycopg
from psycopg import sql

ROLE_NAME = "kudzuops"
ROLE_PASSWORD = os.getenv("KUDZUOPS_PASSWORD", "kudzu@@2025")


def main() -> int:
    host = os.getenv("PGHOST", "127.0.0.1")
    port = int(os.getenv("PGPORT", "5432"))
    user = os.getenv("PGUSER", "postgres")
    password = os.getenv("PGPASSWORD", "")

    try:
        with psycopg.connect(dbname="postgres", host=host, port=port, user=user, password=password) as conn:
            conn.execute("SET client_min_messages TO WARNING;")
            # Check if role exists
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM pg_roles WHERE rolname=%s", (ROLE_NAME,))
                exists = cur.fetchone() is not None

            if not exists:
                # Create role with login and password
                with conn.cursor() as cur:
                    cur.execute(
                        sql.SQL("CREATE ROLE {} WITH LOGIN PASSWORD {};").format(
                            sql.Identifier(ROLE_NAME), sql.Literal(ROLE_PASSWORD)
                        )
                    )

            # Ensure full privileges
            with conn.cursor() as cur:
                cur.execute(
                    sql.SQL(
                        "ALTER ROLE {} SUPERUSER CREATEDB CREATEROLE REPLICATION BYPASSRLS;"
                    ).format(sql.Identifier(ROLE_NAME))
                )

            conn.commit()

            with conn.cursor() as cur:
                cur.execute(
                    "SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls FROM pg_roles WHERE rolname=%s",
                    (ROLE_NAME,),
                )
                rec = cur.fetchone()
                if not rec:
                    print("ERROR: role not found after creation")
                    return 1
                print(
                    f"Created/updated role: {rec[0]} (superuser={rec[1]}, createdb={rec[2]}, createrole={rec[3]}, replication={rec[4]}, bypassrls={rec[5]})"
                )
                return 0
    except Exception as e:
        print(f"ERROR: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
