import os
import sys
import psycopg
from psycopg.rows import tuple_row


def main() -> int:
    dbname = os.getenv("DB_NAME", "kudzuops")
    host = os.getenv("PGHOST", "127.0.0.1")
    port = int(os.getenv("PGPORT", "5432"))
    user = os.getenv("PGUSER", "postgres")
    password = os.getenv("PGPASSWORD", "")

    try:
        with psycopg.connect(dbname=dbname, host=host, port=port, user=user, password=password) as conn:
            with conn.cursor(row_factory=tuple_row) as cur:
                # Ensure table exists
                cur.execute("SELECT to_regclass('public.tbl_users')")
                reg = cur.fetchone()[0]
                if reg is None:
                    print("ERROR: 'tbl_users' table not found in schema 'public'.")
                    return 1
                # Count rows
                cur.execute("SELECT COUNT(*) FROM tbl_users")
                count = cur.fetchone()[0]
                if count != 0:
                    print(f"SKIPPED: tbl_users table has {count} rows; not resetting sequence.")
                    return 0
                # Get sequence name
                cur.execute("SELECT pg_get_serial_sequence('tbl_users','id')")
                seq = cur.fetchone()[0]
                if not seq:
                    print("ERROR: Could not determine sequence for tbl_users.id")
                    return 1
                # Reset so next nextval() returns 1
                cur.execute("SELECT setval(%s, 1, false)", (seq,))
                conn.commit()
                print(f"OK: reset sequence {seq} to start at 1 (tbl_users empty).")
                return 0
    except Exception as e:
        print(f"ERROR: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())


